/**
 * Quality Audit System
 *
 * Analyzes the quality and relevance of generated chapters and questions
 * compared to the source course content.
 */

export interface QuestionAudit {
  questionId: string;
  prompt: string;
  correctAnswer: string;
  correctAnswerIndex: number;
  relevanceScore: number; // 0-100
  sourceMatch: {
    found: boolean;
    matchedText?: string;
    matchPosition?: number;
    confidence: number;
  };
  ambiguityWarnings: string[];
  optionsAnalysis: {
    option: string;
    isCorrect: boolean;
    foundInSource: boolean;
    potentiallyValid: boolean;
  }[];
}

export interface ChapterAudit {
  chapterId: string;
  title: string;
  shortSummary?: string;
  relevanceScore: number; // 0-100
  titleFoundInSource: boolean;
  conceptsCovered: string[];
  questionCount: number;
  questionAudits: QuestionAudit[];
  averageQuestionRelevance: number;
  issues: string[];
}

export interface CourseAudit {
  courseId: string;
  title: string;
  sourceTextLength: number;
  sourceTextPreview: string;
  sourceTextFull: string;
  chapterCount: number;
  totalQuestionCount: number;
  overallRelevanceScore: number; // 0-100
  chapterAudits: ChapterAudit[];
  summary: {
    excellentQuestions: number; // relevance >= 80
    goodQuestions: number; // relevance 60-79
    fairQuestions: number; // relevance 40-59
    poorQuestions: number; // relevance < 40
    ambiguousQuestions: number;
    questionsWithSourceMatch: number;
  };
  recommendations: string[];
}

/**
 * Extract keywords from text for matching
 */
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'que',
    'qui', 'est', 'sont', 'dans', 'pour', 'sur', 'avec', 'par', 'ce', 'cette',
    'der', 'die', 'das', 'und', 'ist', 'sind', 'ein', 'eine', 'nicht', 'mit',
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-zA-ZÀ-ÿ\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  );
}

/**
 * Calculate similarity between two texts using keyword overlap
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  let overlap = 0;
  for (const word of keywords1) {
    if (keywords2.has(word)) overlap++;
  }

  // Jaccard similarity
  const union = new Set([...keywords1, ...keywords2]).size;
  return union > 0 ? (overlap / union) * 100 : 0;
}

/**
 * Find if a phrase or its key terms appear in the source text
 */
function findInSource(
  phrase: string,
  sourceText: string,
  minMatchRatio: number = 0.5
): { found: boolean; matchedText?: string; position?: number; confidence: number } {
  const lowerSource = sourceText.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();

  // Try exact match first
  const exactPos = lowerSource.indexOf(lowerPhrase);
  if (exactPos !== -1) {
    return {
      found: true,
      matchedText: sourceText.substring(exactPos, exactPos + phrase.length),
      position: exactPos,
      confidence: 100,
    };
  }

  // Try keyword matching
  const phraseKeywords = Array.from(extractKeywords(phrase));
  if (phraseKeywords.length === 0) {
    return { found: false, confidence: 0 };
  }

  let matchedCount = 0;
  let firstMatchPos = -1;

  for (const keyword of phraseKeywords) {
    const pos = lowerSource.indexOf(keyword);
    if (pos !== -1) {
      matchedCount++;
      if (firstMatchPos === -1) firstMatchPos = pos;
    }
  }

  const matchRatio = matchedCount / phraseKeywords.length;
  const confidence = Math.round(matchRatio * 100);

  if (matchRatio >= minMatchRatio) {
    // Extract context around first match
    const contextStart = Math.max(0, firstMatchPos - 50);
    const contextEnd = Math.min(sourceText.length, firstMatchPos + 100);

    return {
      found: true,
      matchedText: sourceText.substring(contextStart, contextEnd),
      position: firstMatchPos,
      confidence,
    };
  }

  return { found: false, confidence };
}

/**
 * Check if a string is primarily numeric (for calculation questions)
 */
function isNumericOption(option: string): boolean {
  // Remove common numeric suffixes/prefixes like %, €, $, etc.
  const cleaned = option.replace(/[%€$£¥,.\s]/g, '').trim();
  // Check if it's mostly digits (allows for some text like "50 millions")
  const digits = cleaned.replace(/[^0-9]/g, '').length;
  const total = cleaned.length;
  return total > 0 && digits / total >= 0.5;
}

/**
 * Detect potential ambiguity in a question
 * Skip ambiguity checks for numeric/calculation questions as they are inherently precise
 */
function detectAmbiguity(
  prompt: string,
  options: string[],
  correctIndex: number,
  sourceText: string
): string[] {
  const warnings: string[] = [];

  // Skip ambiguity detection if no source text available
  if (!sourceText || sourceText.length < 100) {
    return warnings;
  }

  // Check if this is a calculation/numeric question - these are inherently precise
  const isCalculationQuestion = options.every(opt => isNumericOption(opt)) ||
    /calcul|comput|résultat|result|combien|how much|how many|montant|valeur|value|total|somme|sum/i.test(prompt);

  if (isCalculationQuestion) {
    // Don't flag ambiguity for calculation questions - numbers are precise by nature
    return warnings;
  }

  // Check if multiple options are found in source
  let optionsInSource = 0;
  const foundOptions: string[] = [];

  for (let i = 0; i < options.length; i++) {
    const result = findInSource(options[i], sourceText, 0.6);
    if (result.found && result.confidence >= 60) {
      optionsInSource++;
      foundOptions.push(options[i]);
    }
  }

  if (optionsInSource > 1 && !foundOptions.includes(options[correctIndex])) {
    warnings.push(`Multiple options found in source but correct answer "${options[correctIndex]}" was not`);
  }

  if (optionsInSource > 2) {
    warnings.push(`${optionsInSource} options found in source text - may be ambiguous`);
  }

  // Check for vague question phrasing (only for non-calculation questions)
  const vaguePatterns = [
    { pattern: /^which\s+(?!one|best|primary|main|most)/i, msg: 'Question starts with "Which" without disambiguation' },
    { pattern: /^what\s+is\s+a\s+/i, msg: 'Generic "What is a..." question' },
    { pattern: /can be|could be|might be/i, msg: 'Question suggests multiple possibilities' },
  ];

  for (const { pattern, msg } of vaguePatterns) {
    if (pattern.test(prompt)) {
      warnings.push(msg);
    }
  }

  // Check for similar options (only for text-based options, not numeric)
  const hasNumericOptions = options.some(opt => isNumericOption(opt));
  if (!hasNumericOptions) {
    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        const similarity = calculateTextSimilarity(options[i], options[j]);
        if (similarity > 60) {
          warnings.push(`Options "${options[i]}" and "${options[j]}" are very similar (${Math.round(similarity)}%)`);
        }
      }
    }
  }

  return warnings;
}

/**
 * Audit a single question against source text
 */
export function auditQuestion(
  question: {
    id: string;
    prompt: string;
    options: string[];
    correct_option_index: number;
    explanation?: string;
    source_reference?: string;  // Phase 1: Use source_reference for better scoring
    cognitive_level?: 'remember' | 'understand' | 'apply';  // Phase 1: Weight by cognitive level
  },
  sourceText: string
): QuestionAudit {
  const correctAnswer = question.options[question.correct_option_index] || '';

  // Check if correct answer is in source
  const sourceMatch = findInSource(correctAnswer, sourceText, 0.5);

  // Phase 1: Also check source_reference if provided (more reliable than searching)
  const hasValidSourceReference = question.source_reference && question.source_reference.length >= 15;
  let sourceReferenceMatch: { found: boolean; confidence: number } = { found: false, confidence: 0 };
  if (hasValidSourceReference) {
    sourceReferenceMatch = findInSource(question.source_reference!, sourceText, 0.4);
  }

  // Check if question prompt relates to source
  const promptRelevance = calculateTextSimilarity(question.prompt, sourceText);

  // Analyze each option
  const optionsAnalysis = question.options.map((option, idx) => {
    const inSource = findInSource(option, sourceText, 0.5);
    return {
      option,
      isCorrect: idx === question.correct_option_index,
      foundInSource: inSource.found,
      potentiallyValid: inSource.found && inSource.confidence >= 60,
    };
  });

  // Detect ambiguity
  const ambiguityWarnings = detectAmbiguity(
    question.prompt,
    question.options,
    question.correct_option_index,
    sourceText
  );

  // Calculate overall relevance score with new weights
  // Phase 1: New formula incorporating source_reference and cognitive_level
  // Base weights add up to 100% so questions without source_reference can still score 100%
  // source_reference and cognitive_level provide BONUS points (up to +8%)
  let relevanceScore = 0;

  // Prompt relevance (30% weight - same as before)
  relevanceScore += Math.min(promptRelevance, 100) * 0.30;

  // Correct answer found in source (35% weight)
  // If source_reference is available and found, boost confidence
  if (hasValidSourceReference && sourceReferenceMatch.found && sourceReferenceMatch.confidence >= 50) {
    // Source reference found in text = high confidence (use better of the two)
    const bestConfidence = Math.max(sourceReferenceMatch.confidence, sourceMatch.confidence);
    relevanceScore += Math.min(bestConfidence + 10, 100) * 0.35;
  } else if (sourceMatch.found) {
    // Standard answer search
    relevanceScore += sourceMatch.confidence * 0.35;
  }

  // Distractor quality - wrong answers should NOT be the correct answer (25% weight)
  // Phase 1: Changed logic - distractors CAN appear in source, they just shouldn't be the BEST answer
  // We now only penalize if distractor is found with HIGH confidence (suggesting it might also be correct)
  const problematicDistractors = optionsAnalysis.filter(
    o => !o.isCorrect && o.foundInSource && o.potentiallyValid
  ).length;
  const distractorScore = Math.max(0, 25 - problematicDistractors * 8);
  relevanceScore += distractorScore;

  // No ambiguity warnings (10% weight)
  if (ambiguityWarnings.length === 0) {
    relevanceScore += 10;
  } else {
    relevanceScore += Math.max(0, 10 - ambiguityWarnings.length * 3);
  }

  // BONUS: Source reference quality (+5 points if valid reference is found in source)
  // This rewards questions with explicit source citations
  if (hasValidSourceReference && sourceReferenceMatch.found) {
    relevanceScore = Math.min(100, relevanceScore + 5);
  }

  // BONUS: Cognitive level (+3 for apply, +1 for understand)
  // Apply-level questions are harder to create well
  if (question.cognitive_level === 'apply') {
    relevanceScore = Math.min(100, relevanceScore + 3);
  } else if (question.cognitive_level === 'understand') {
    relevanceScore = Math.min(100, relevanceScore + 1);
  }

  return {
    questionId: question.id,
    prompt: question.prompt,
    correctAnswer,
    correctAnswerIndex: question.correct_option_index,
    relevanceScore: Math.round(relevanceScore),
    sourceMatch,
    ambiguityWarnings,
    optionsAnalysis,
  };
}

/**
 * Audit a chapter and its questions
 */
export function auditChapter(
  chapter: {
    id: string;
    title: string;
    short_summary?: string;
    questions: Array<{
      id: string;
      prompt: string;
      options: string[];
      correct_option_index: number;
      explanation?: string;
      source_reference?: string;  // Phase 1: Support source_reference
      cognitive_level?: 'remember' | 'understand' | 'apply';  // Phase 1: Support cognitive_level
    }>;
  },
  sourceText: string
): ChapterAudit {
  const issues: string[] = [];

  // Check if chapter title is in source
  const titleMatch = findInSource(chapter.title, sourceText, 0.6);

  // Extract concepts from chapter (based on title and summary)
  const conceptText = `${chapter.title} ${chapter.short_summary || ''}`;
  const conceptsCovered = Array.from(extractKeywords(conceptText)).slice(0, 10);

  // Audit all questions
  const questionAudits = chapter.questions.map(q => auditQuestion(q, sourceText));

  // Calculate average question relevance
  const avgRelevance = questionAudits.length > 0
    ? questionAudits.reduce((sum, q) => sum + q.relevanceScore, 0) / questionAudits.length
    : 0;

  // Calculate chapter relevance score
  let relevanceScore = 0;

  // Title found in source (25% weight)
  if (titleMatch.found) {
    relevanceScore += titleMatch.confidence * 0.25;
  }

  // Average question relevance (60% weight)
  relevanceScore += avgRelevance * 0.6;

  // Question count appropriate (15% weight)
  if (chapter.questions.length >= 5 && chapter.questions.length <= 15) {
    relevanceScore += 15;
  } else if (chapter.questions.length > 0) {
    relevanceScore += 8;
  }

  // Identify issues
  if (!titleMatch.found) {
    issues.push('Chapter title not found in source text');
  }

  if (chapter.questions.length < 5) {
    issues.push(`Only ${chapter.questions.length} questions - consider adding more`);
  }

  const poorQuestions = questionAudits.filter(q => q.relevanceScore < 40);
  if (poorQuestions.length > 0) {
    issues.push(`${poorQuestions.length} questions with low relevance score`);
  }

  const ambiguousQuestions = questionAudits.filter(q => q.ambiguityWarnings.length > 0);
  if (ambiguousQuestions.length > 0) {
    issues.push(`${ambiguousQuestions.length} questions with ambiguity warnings`);
  }

  return {
    chapterId: chapter.id,
    title: chapter.title,
    shortSummary: chapter.short_summary,
    relevanceScore: Math.round(relevanceScore),
    titleFoundInSource: titleMatch.found,
    conceptsCovered,
    questionCount: chapter.questions.length,
    questionAudits,
    averageQuestionRelevance: Math.round(avgRelevance),
    issues,
  };
}

/**
 * Full course audit
 * Note: If no source text is available, relevance scores will be set to -1 (N/A)
 */
export function auditCourse(
  course: {
    id: string;
    title: string;
    source_text: string;
    chapters: Array<{
      id: string;
      title: string;
      short_summary?: string;
      questions: Array<{
        id: string;
        prompt: string;
        options: string[];
        correct_option_index: number;
        explanation?: string;
        source_reference?: string;  // Phase 1: Support source_reference
        cognitive_level?: 'remember' | 'understand' | 'apply';  // Phase 1: Support cognitive_level
      }>;
    }>;
  }
): CourseAudit {
  const sourceText = course.source_text || '';
  const hasSourceText = sourceText.length >= 100;

  // If no source text, we can't properly audit relevance
  // Return a special "not auditable" state
  if (!hasSourceText) {
    const totalQuestions = course.chapters.reduce(
      (sum, ch) => sum + ch.questions.length,
      0
    );

    return {
      courseId: course.id,
      title: course.title,
      sourceTextLength: sourceText.length,
      sourceTextPreview: sourceText.length > 0 ? sourceText.substring(0, 500) : '(No source text available)',
      sourceTextFull: sourceText,
      chapterCount: course.chapters.length,
      totalQuestionCount: totalQuestions,
      overallRelevanceScore: -1, // -1 indicates "not auditable"
      chapterAudits: course.chapters.map(ch => ({
        chapterId: ch.id,
        title: ch.title,
        shortSummary: ch.short_summary,
        relevanceScore: -1, // Not auditable
        titleFoundInSource: false,
        conceptsCovered: [],
        questionCount: ch.questions.length,
        questionAudits: ch.questions.map(q => ({
          questionId: q.id,
          prompt: q.prompt,
          correctAnswer: q.options[q.correct_option_index] || '',
          correctAnswerIndex: q.correct_option_index,
          relevanceScore: -1, // Not auditable
          sourceMatch: { found: false, confidence: 0 },
          ambiguityWarnings: [],
          optionsAnalysis: q.options.map((opt, idx) => ({
            option: opt,
            isCorrect: idx === q.correct_option_index,
            foundInSource: false,
            potentiallyValid: false,
          })),
        })),
        averageQuestionRelevance: -1,
        issues: ['No source text available - cannot audit relevance'],
      })),
      summary: {
        excellentQuestions: 0,
        goodQuestions: 0,
        fairQuestions: 0,
        poorQuestions: 0,
        ambiguousQuestions: 0,
        questionsWithSourceMatch: 0,
      },
      recommendations: ['No source text available - upload source material to enable quality audit'],
    };
  }

  // Audit all chapters (only if we have source text)
  const chapterAudits = course.chapters.map(ch => auditChapter(ch, sourceText));

  // Calculate summary stats
  const allQuestionAudits = chapterAudits.flatMap(ch => ch.questionAudits);
  const totalQuestions = allQuestionAudits.length;

  const summary = {
    excellentQuestions: allQuestionAudits.filter(q => q.relevanceScore >= 80).length,
    goodQuestions: allQuestionAudits.filter(q => q.relevanceScore >= 60 && q.relevanceScore < 80).length,
    fairQuestions: allQuestionAudits.filter(q => q.relevanceScore >= 40 && q.relevanceScore < 60).length,
    poorQuestions: allQuestionAudits.filter(q => q.relevanceScore < 40).length,
    ambiguousQuestions: allQuestionAudits.filter(q => q.ambiguityWarnings.length > 0).length,
    questionsWithSourceMatch: allQuestionAudits.filter(q => q.sourceMatch.found).length,
  };

  // Calculate overall score
  const avgChapterRelevance = chapterAudits.length > 0
    ? chapterAudits.reduce((sum, ch) => sum + ch.relevanceScore, 0) / chapterAudits.length
    : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  if (summary.poorQuestions > totalQuestions * 0.2) {
    recommendations.push(`${summary.poorQuestions} questions have low relevance - review and regenerate`);
  }

  if (summary.ambiguousQuestions > totalQuestions * 0.1) {
    recommendations.push(`${summary.ambiguousQuestions} questions may be ambiguous - review wording`);
  }

  if (summary.questionsWithSourceMatch < totalQuestions * 0.6) {
    recommendations.push('Many correct answers not found in source - verify question accuracy');
  }

  const chaptersWithIssues = chapterAudits.filter(ch => ch.issues.length > 0);
  if (chaptersWithIssues.length > 0) {
    recommendations.push(`${chaptersWithIssues.length} chapters have issues to address`);
  }

  if (course.chapters.length < 3) {
    recommendations.push('Consider adding more chapters for better content coverage');
  }

  return {
    courseId: course.id,
    title: course.title,
    sourceTextLength: sourceText.length,
    sourceTextPreview: sourceText.substring(0, 500) + (sourceText.length > 500 ? '...' : ''),
    sourceTextFull: sourceText,
    chapterCount: course.chapters.length,
    totalQuestionCount: totalQuestions,
    overallRelevanceScore: Math.round(avgChapterRelevance),
    chapterAudits,
    summary,
    recommendations,
  };
}

/**
 * Get a quality rating based on score
 */
export function getQualityRating(score: number): {
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  color: string;
  label: string;
} {
  if (score >= 80) {
    return { rating: 'excellent', color: 'green', label: 'Excellent' };
  } else if (score >= 60) {
    return { rating: 'good', color: 'blue', label: 'Good' };
  } else if (score >= 40) {
    return { rating: 'fair', color: 'yellow', label: 'Fair' };
  } else {
    return { rating: 'poor', color: 'red', label: 'Poor' };
  }
}
