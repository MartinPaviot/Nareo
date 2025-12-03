/**
 * Semantic Validator
 *
 * Provides semantic validation for LLM-generated questions by:
 * 1. Extracting verifiable facts from source text
 * 2. Validating questions against these facts
 * 3. Checking that answers are explicitly supported by the source
 */

import OpenAI from 'openai';
import { LLM_CONFIG } from './index';
import { withRetry } from './retry';
import { withCircuitBreaker, openaiCircuitBreaker } from './circuit-breaker';
import { llmLogger } from './logger';
import type { MCQQuestion } from './question-validator';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * A verifiable fact extracted from source text
 */
export interface VerifiableFact {
  id: string;
  statement: string;           // The factual statement
  source_quote: string;        // Exact quote from source supporting this fact
  category: 'definition' | 'formula' | 'process' | 'relationship' | 'statistic' | 'example';
  confidence: number;          // 0-1 confidence that this is a testable fact
  keywords: string[];          // Key terms for matching
}

/**
 * Result of semantic validation for a question
 */
export interface SemanticValidationResult {
  questionIndex: number;
  isValid: boolean;
  confidence: number;           // 0-1 confidence in validation result
  matchedFacts: string[];       // IDs of facts that support this question
  issues: string[];             // Any issues found
  suggestion?: string;          // Suggested improvement if invalid
}

/**
 * Extract verifiable facts from source text
 * This creates a "fact bank" that questions can be validated against
 */
export async function extractVerifiableFacts(
  sourceText: string,
  chapterTitle: string,
  language: 'EN' | 'FR' | 'DE' = 'EN'
): Promise<VerifiableFact[]> {
  // Use configurable model for fact extraction (default: gpt-4o-mini for cost savings)
  // Change LLM_CONFIG.models.factExtraction to 'gpt-4o' if quality drops
  const model = LLM_CONFIG.models.factExtraction;
  const logContext = llmLogger.createContext('extractVerifiableFacts', model);

  const truncatedText = sourceText.substring(0, LLM_CONFIG.truncation.chapterText);

  const languageInstruction = language === 'FR'
    ? 'Extract facts in French.'
    : language === 'DE'
      ? 'Extract facts in German.'
      : 'Extract facts in English.';

  const prompt = `Extract all verifiable, testable facts from this text about "${chapterTitle}".

For each fact, provide:
1. "statement": A clear, standalone factual statement that could be tested in a quiz
2. "source_quote": The exact text passage (10-50 words) that supports this fact
3. "category": One of: definition, formula, process, relationship, statistic, example
4. "confidence": 0.0-1.0 how certain you are this is a testable fact
5. "keywords": Array of 2-5 key terms for matching

Focus on:
- Definitions of key terms and concepts
- Formulas, equations, and calculations
- Step-by-step processes or procedures
- Cause-effect relationships
- Statistics, numbers, and percentages
- Specific examples and case studies

AVOID extracting:
- Opinions or subjective statements
- Vague generalizations
- Information that requires external knowledge to verify

Example output:
{
  "facts": [
    {
      "statement": "Customer Lifetime Value (CLV) is calculated as Average Purchase Value × Purchase Frequency × Customer Lifespan",
      "source_quote": "CLV = Average Purchase Value × Purchase Frequency × Customer Lifespan, representing the total revenue expected from a customer.",
      "category": "formula",
      "confidence": 0.95,
      "keywords": ["CLV", "customer lifetime value", "formula", "calculation"]
    },
    {
      "statement": "A 1% monthly churn rate compounds to approximately 11.4% annual churn",
      "source_quote": "While 1% monthly churn seems small, it compounds to roughly 11.4% annual customer loss.",
      "category": "statistic",
      "confidence": 0.9,
      "keywords": ["churn rate", "monthly", "annual", "compounding"]
    }
  ]
}

${languageInstruction}

SOURCE TEXT:
${truncatedText}`;

  try {
    const response = await withCircuitBreaker(
      openaiCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model, // Uses LLM_CONFIG.models.factExtraction (configurable)
            messages: [
              {
                role: 'system',
                content: 'You are an expert at extracting testable facts from educational content. Return valid JSON only.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: LLM_CONFIG.temperatures.extraction,
            response_format: { type: 'json_object' },
            max_tokens: 2000, // Reduced from 4000 - facts don't need as many tokens
          });
          return result;
        },
        { maxRetries: 2 }
      ),
      async () => {
        logContext.setFallbackUsed();
        return null;
      }
    );

    if (!response) {
      console.log('⚠️ Circuit breaker open for fact extraction, returning empty facts');
      logContext.setFallbackUsed().success();
      return [];
    }

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');

    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    const facts: VerifiableFact[] = (parsed.facts || []).map((f: any, index: number) => ({
      id: `fact_${index}`,
      statement: f.statement || '',
      source_quote: f.source_quote || '',
      category: f.category || 'definition',
      confidence: f.confidence || 0.5,
      keywords: f.keywords || [],
    }));

    console.log(`📚 Extracted ${facts.length} verifiable facts from chapter`);
    logContext.success();
    return facts;
  } catch (error: any) {
    console.error('❌ Error extracting verifiable facts:', error);
    logContext.failure(error, error?.status);
    return [];
  }
}

/**
 * Validate a question semantically against extracted facts
 */
export async function validateQuestionSemantically(
  question: MCQQuestion,
  questionIndex: number,
  facts: VerifiableFact[],
  sourceText: string,
  language: 'EN' | 'FR' | 'DE' = 'EN'
): Promise<SemanticValidationResult> {
  const logContext = llmLogger.createContext('validateQuestionSemantically', LLM_CONFIG.models.fast);

  // If no facts available, skip semantic validation
  if (facts.length === 0) {
    return {
      questionIndex,
      isValid: true,
      confidence: 0.5,
      matchedFacts: [],
      issues: ['No facts available for validation'],
    };
  }

  const questionText = question.prompt || question.question || '';
  const correctAnswer = question.options?.[question.correct_option_index || 0] || '';
  const sourceRef = question.source_reference || '';

  // First, try keyword matching to find relevant facts
  const matchedFacts = findMatchingFacts(questionText, correctAnswer, facts);

  // If we have keyword matches AND a source reference, skip LLM validation (save cost)
  // This is the most common case for well-formed questions
  if (matchedFacts.length > 0 && sourceRef.length > 15) {
    // Strong match found without LLM call - save ~$0.001 per question
    return {
      questionIndex,
      isValid: true,
      confidence: 0.80,
      matchedFacts,
      issues: [],
    };
  }

  // If we have any keyword matches, trust them without LLM call
  if (matchedFacts.length >= 1) {
    return {
      questionIndex,
      isValid: true,
      confidence: 0.70,
      matchedFacts,
      issues: matchedFacts.length < 2 ? ['Weak fact match - consider reviewing'] : [],
    };
  }

  // For uncertain cases, use LLM to verify
  const truncatedSource = sourceText.substring(0, 2000);

  const languageInstruction = language === 'FR'
    ? 'Respond in French.'
    : language === 'DE'
      ? 'Respond in German.'
      : 'Respond in English.';

  const prompt = `Validate this MCQ question against the source text.

QUESTION: ${questionText}
CORRECT ANSWER: ${correctAnswer}
PROVIDED SOURCE REFERENCE: ${sourceRef || 'None provided'}

SOURCE TEXT (excerpt):
${truncatedSource}

Determine:
1. Is the correct answer EXPLICITLY supported by the source text?
2. Are the wrong options clearly incorrect based on the source?
3. Is the question unambiguous (only one answer could be correct)?

Return JSON:
{
  "is_valid": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list of issues if any"],
  "suggestion": "improvement suggestion if invalid",
  "answer_supported": true/false,
  "distractors_valid": true/false
}

${languageInstruction}`;

  try {
    const response = await withCircuitBreaker(
      openaiCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model: LLM_CONFIG.models.fast, // Use faster model for validation
            messages: [
              {
                role: 'system',
                content: 'You are a quality assurance expert validating educational quiz questions. Return valid JSON only.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.1, // Very low temperature for consistent validation
            response_format: { type: 'json_object' },
            max_tokens: 500,
          });
          return result;
        },
        { maxRetries: 1 }
      ),
      async () => {
        logContext.setFallbackUsed();
        return null;
      }
    );

    if (!response) {
      // Fallback: trust the question if it has a source reference
      return {
        questionIndex,
        isValid: sourceRef.length > 15,
        confidence: 0.5,
        matchedFacts,
        issues: ['Validation service unavailable'],
      };
    }

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');

    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    logContext.success();

    return {
      questionIndex,
      isValid: parsed.is_valid ?? true,
      confidence: parsed.confidence ?? 0.7,
      matchedFacts,
      issues: parsed.issues || [],
      suggestion: parsed.suggestion,
    };
  } catch (error: any) {
    console.error('❌ Error in semantic validation:', error);
    logContext.failure(error, error?.status);

    // Fallback: trust the question if it has a source reference
    return {
      questionIndex,
      isValid: sourceRef.length > 15,
      confidence: 0.3,
      matchedFacts,
      issues: ['Validation error occurred'],
    };
  }
}

/**
 * Validate a batch of questions and filter out invalid ones
 */
export async function validateQuestionBatchSemantically(
  questions: MCQQuestion[],
  facts: VerifiableFact[],
  sourceText: string,
  language: 'EN' | 'FR' | 'DE' = 'EN',
  options: { minConfidence?: number; maxConcurrentValidations?: number } = {}
): Promise<{
  validQuestions: MCQQuestion[];
  invalidQuestions: { question: MCQQuestion; result: SemanticValidationResult }[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    avgConfidence: number;
  };
}> {
  const minConfidence = options.minConfidence ?? 0.6;
  const maxConcurrent = options.maxConcurrentValidations ?? 3;

  const results: SemanticValidationResult[] = [];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < questions.length; i += maxConcurrent) {
    const batch = questions.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map((q, idx) =>
        validateQuestionSemantically(q, i + idx, facts, sourceText, language)
      )
    );
    results.push(...batchResults);
  }

  const validQuestions: MCQQuestion[] = [];
  const invalidQuestions: { question: MCQQuestion; result: SemanticValidationResult }[] = [];

  for (let i = 0; i < questions.length; i++) {
    const result = results[i];
    if (result.isValid && result.confidence >= minConfidence) {
      validQuestions.push(questions[i]);
    } else {
      invalidQuestions.push({ question: questions[i], result });
    }
  }

  const avgConfidence = results.length > 0
    ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    : 0;

  console.log(`🔍 Semantic validation: ${validQuestions.length}/${questions.length} questions passed (avg confidence: ${(avgConfidence * 100).toFixed(1)}%)`);

  return {
    validQuestions,
    invalidQuestions,
    stats: {
      total: questions.length,
      valid: validQuestions.length,
      invalid: invalidQuestions.length,
      avgConfidence,
    },
  };
}

/**
 * Find facts that match a question using keyword overlap
 */
function findMatchingFacts(
  questionText: string,
  correctAnswer: string,
  facts: VerifiableFact[]
): string[] {
  const questionWords = new Set(
    (questionText + ' ' + correctAnswer)
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
  );

  const matchedFactIds: string[] = [];

  for (const fact of facts) {
    // Check keyword overlap
    const keywordMatches = fact.keywords.filter(kw =>
      questionWords.has(kw.toLowerCase()) ||
      questionText.toLowerCase().includes(kw.toLowerCase()) ||
      correctAnswer.toLowerCase().includes(kw.toLowerCase())
    );

    // Check statement overlap
    const statementWords = new Set(
      fact.statement.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );
    let overlap = 0;
    for (const word of questionWords) {
      if (statementWords.has(word)) overlap++;
    }

    const overlapRatio = questionWords.size > 0 ? overlap / questionWords.size : 0;

    // Consider it a match if good keyword overlap or statement overlap
    if (keywordMatches.length >= 2 || overlapRatio > 0.3) {
      matchedFactIds.push(fact.id);
    }
  }

  return matchedFactIds;
}

/**
 * Generate a quality report for a chapter's questions
 */
export function generateQualityReport(
  chapterTitle: string,
  facts: VerifiableFact[],
  questions: MCQQuestion[],
  validationResults: SemanticValidationResult[]
): {
  chapterTitle: string;
  factCount: number;
  questionCount: number;
  validCount: number;
  avgConfidence: number;
  coverageByCategory: Record<string, number>;
  cognitiveDistribution: Record<string, number>;
  issues: string[];
  recommendations: string[];
} {
  const validCount = validationResults.filter(r => r.isValid).length;
  const avgConfidence = validationResults.length > 0
    ? validationResults.reduce((sum, r) => sum + r.confidence, 0) / validationResults.length
    : 0;

  // Calculate coverage by fact category
  const coverageByCategory: Record<string, number> = {};
  for (const fact of facts) {
    const category = fact.category;
    const isCovered = validationResults.some(r =>
      r.matchedFacts.includes(fact.id)
    );
    if (!coverageByCategory[category]) {
      coverageByCategory[category] = 0;
    }
    if (isCovered) {
      coverageByCategory[category]++;
    }
  }

  // Calculate cognitive level distribution
  const cognitiveDistribution: Record<string, number> = {
    remember: 0,
    understand: 0,
    apply: 0,
    unknown: 0,
  };
  for (const q of questions) {
    const level = q.cognitive_level || 'unknown';
    cognitiveDistribution[level] = (cognitiveDistribution[level] || 0) + 1;
  }

  // Identify issues
  const issues: string[] = [];
  const allIssues = validationResults.flatMap(r => r.issues);
  const uniqueIssues = [...new Set(allIssues)];
  issues.push(...uniqueIssues.slice(0, 5));

  // Generate recommendations
  const recommendations: string[] = [];

  if (avgConfidence < 0.7) {
    recommendations.push('Consider regenerating questions with more explicit source references');
  }

  const applyRatio = questions.length > 0
    ? cognitiveDistribution.apply / questions.length
    : 0;
  if (applyRatio < 0.15) {
    recommendations.push('Add more application-level questions to test deeper understanding');
  }

  const formulaFacts = facts.filter(f => f.category === 'formula');
  if (formulaFacts.length > 0 && !coverageByCategory['formula']) {
    recommendations.push('Include questions testing formulas and calculations');
  }

  return {
    chapterTitle,
    factCount: facts.length,
    questionCount: questions.length,
    validCount,
    avgConfidence,
    coverageByCategory,
    cognitiveDistribution,
    issues,
    recommendations,
  };
}
