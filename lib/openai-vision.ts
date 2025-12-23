import OpenAI from 'openai';
import {
  withRetry,
  withCircuitBreaker,
  openaiCircuitBreaker,
  openaiVisionCircuitBreaker,
  llmLogger,
  LLM_CONFIG,
  generateContextualConcepts,
  generateContextualChapters,
  generateContextualQuestions,
  validateQuestionBatch,
  deduplicateQuestions,
  // Semantic validation (Phase 2)
  extractVerifiableFacts,
  validateQuestionBatchSemantically,
  type MCQQuestion,
  type VerifiableFact,
} from './llm';
import {
  type QuizConfig,
  type NiveauQuantite,
  getAdjustedQuestionCount,
  DEFAULT_QUIZ_CONFIG,
} from '@/types/quiz-personnalisation';
import {
  getNiveauBlock,
  getTrueFalsePrompt,
  getFillBlankPrompt,
  shuffleArray,
} from './prompts/quiz-types';

// Configuration pour utiliser l'API OpenAI directement
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract raw text from an image using GPT-4 Vision (OCR)
 */
export async function extractTextFromImage(imageDataUrl: string): Promise<string> {
  const logContext = llmLogger.createContext('extractTextFromImage', LLM_CONFIG.models.vision);
  console.log('📝 Extracting raw text from image...');

  try {
    const response = await withCircuitBreaker(
      openaiVisionCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model: LLM_CONFIG.models.vision,
            messages: [
              {
                role: 'system',
                content: 'You are an expert OCR system. Extract ALL text from images accurately, preserving structure and formatting as much as possible.',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Extract ALL text from this image. Include:
- All visible text (typed or handwritten)
- Headings, titles, and subtitles
- Body text and paragraphs
- Bullet points and lists
- Captions and labels
- Any text in diagrams or charts

Preserve the structure and order of the text as it appears in the image.
Return ONLY the extracted text, no additional commentary.`,
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageDataUrl,
                    },
                  },
                ],
              },
            ],
            temperature: LLM_CONFIG.temperatures.extraction,
            max_tokens: LLM_CONFIG.maxTokens.ocr,
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
      console.log('⚠️ Circuit breaker open for vision, returning empty text');
      logContext.setFallbackUsed().success();
      return '';
    }

    const extractedText = response.choices[0].message.content || '';

    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    console.log('✅ Extracted', extractedText.length, 'characters of text from image');
    logContext.success();
    return extractedText;
  } catch (error: any) {
    console.error('❌ Error extracting text from image:', error.message);
    logContext.setFallbackUsed().failure(error, error?.status);
    return '';
  }
}

/**
 * Extract text and concepts from an image using GPT-4 Vision
 * Now returns both the structured concepts AND the raw extracted text
 */
export async function extractConceptsFromImage(imageDataUrl: string) {
  console.log('🔍 Analyzing image with GPT-4 Vision...');
  
  try {
    // First, extract raw text from the image
    const extractedText = await extractTextFromImage(imageDataUrl);
    
    // Then, analyze the image for structured concepts
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content analyzer. Analyze images of course materials, notes, textbooks, or slides and extract structured learning concepts. Always respond in the same language as the source course text; never translate into another language. You MUST respond with valid JSON only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this educational image and extract learning concepts.

You MUST return ONLY a valid JSON object with this EXACT structure (no markdown, no code blocks, just pure JSON):
{
  "title": "Chapter or topic title from the image",
  "summary": "Brief 2-3 sentence summary of the content",
  "concepts": [
    {
      "title": "Concept name",
      "difficulty": "easy|medium|hard",
      "content": "Detailed explanation of the concept",
      "definitions": ["key term 1", "key term 2"],
      "keyIdeas": ["main idea 1", "main idea 2", "main idea 3"],
      "sourceText": "Relevant excerpt from the original text"
    }
  ]
}

Guidelines:
- Extract 3-7 main concepts from the image
- Order concepts from foundational to advanced
- Assign difficulty based on complexity
- If the image contains text, extract it accurately
- If it's a diagram, explain what it shows
- If it's handwritten notes, interpret them clearly
- For each concept, include the relevant sourceText excerpt from the image
- IMPORTANT: Return ONLY valid JSON, no other text`,
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }, // Force JSON response
    });

    const content = response.choices[0].message.content;
    
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(content || '{}');
      console.log('✅ Successfully extracted', parsed.concepts?.length || 0, 'concepts from image');
      
      // Return both the structured data and the raw extracted text
      return {
        ...parsed,
        extractedText, // Add the raw text to the response
      };
    } catch (parseError) {
      console.log('⚠️ Response was not JSON, extracting text...');
      // If not JSON, treat as plain text and create concepts from it
      const fallbackData = createConceptsFromText(content || '');
      return {
        ...fallbackData,
        extractedText,
      };
    }
  } catch (error: any) {
    console.error('❌ Error calling GPT-4 Vision:', error.message);
    console.log('⚠️ Using fallback concept generation...');
    
    // Fallback: Generate default concepts
    return {
      ...generateDefaultConcepts(),
      extractedText: '', // No text extracted in fallback
    };
  }
}

/**
 * Create concepts from plain text response
 */
function createConceptsFromText(text: string) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const concepts = [];
  
  let currentConcept: any = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Look for numbered items or bullet points
    if (/^[\d]+\./.test(trimmed) || /^[-•*]/.test(trimmed)) {
      if (currentConcept) {
        concepts.push(currentConcept);
      }
      
      currentConcept = {
        title: trimmed.replace(/^[\d]+\.\s*/, '').replace(/^[-•*]\s*/, ''),
        difficulty: concepts.length < 2 ? 'easy' : concepts.length < 4 ? 'medium' : 'hard',
        content: '',
        definitions: [],
        keyIdeas: []
      };
    } else if (currentConcept && trimmed.length > 20) {
      currentConcept.content += trimmed + ' ';
    }
  }
  
  if (currentConcept) {
    concepts.push(currentConcept);
  }
  
  if (concepts.length === 0) {
    return generateDefaultConcepts();
  }
  
  return {
    title: 'Course Content from Image',
    summary: 'Concepts extracted from the uploaded image.',
    concepts: concepts.slice(0, 7)
  };
}

/**
 * Extract concepts from plain text (for PDFs and Word documents)
 * Similar to extractConceptsFromImage but works with text input
 */
export async function extractConceptsFromText(text: string, title?: string) {
  console.log('🔍 Analyzing text document with GPT-4o-mini...');

  try {
    const response = await openai.chat.completions.create({
      model: LLM_CONFIG.models.fast,
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content analyzer. Analyze text from course materials, documents, or textbooks and extract structured learning concepts. Always respond in the same language as the input course text. You MUST respond with valid JSON only.',
        },
        {
          role: 'user',
          content: `Analyze this educational text and extract learning concepts.

Text Content:
${text.substring(0, 8000)}

You MUST return ONLY a valid JSON object with this EXACT structure (no markdown, no code blocks, just pure JSON):
{
  "title": "Chapter or topic title from the text",
  "summary": "Brief 2-3 sentence summary of the content",
  "concepts": [
    {
      "title": "Concept name",
      "difficulty": "easy|medium|hard",
      "content": "Detailed explanation of the concept",
      "definitions": ["key term 1", "key term 2"],
      "keyIdeas": ["main idea 1", "main idea 2", "main idea 3"],
      "sourceText": "Relevant excerpt from the original text"
    }
  ]
}

Guidelines:
- Extract 3-7 main concepts from the text
- Order concepts from foundational to advanced
- Assign difficulty based on complexity
- For each concept, include the relevant sourceText excerpt
- IMPORTANT: Return ONLY valid JSON, no other text`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    
    try {
      const parsed = JSON.parse(content || '{}');
      console.log('✅ Successfully extracted', parsed.concepts?.length || 0, 'concepts from text');
      
      return {
        ...parsed,
        extractedText: text,
      };
    } catch (parseError) {
      console.log('⚠️ Response was not JSON, creating concepts from text...');
      const fallbackData = createConceptsFromText(content || '');
      return {
        ...fallbackData,
        extractedText: text,
      };
    }
  } catch (error: any) {
    console.error('❌ Error analyzing text:', error.message);
    console.log('⚠️ Using fallback concept generation...');
    
    return {
      ...generateDefaultConcepts(),
      extractedText: text,
    };
  }
}

/**
 * Generate a chapter structure from course text.
 * Detects and respects the document's natural structure (table of contents, numbered sections, etc.)
 * Works with any type of educational document: slides, textbooks, notes, articles.
 */
export async function generateChapterStructureFromCourseText(
  courseText: string,
  courseTitle?: string,
  contentLanguage: "EN" | "FR" | "DE" = "EN"
) {
  const logContext = llmLogger.createContext('generateChapterStructureFromCourseText', LLM_CONFIG.models.primary);

  // Truncate text intelligently
  const truncatedText = courseText.substring(0, LLM_CONFIG.truncation.courseText);

  // Universal prompt that works with any course structure
  const prompt = `Analyze this educational document and extract its REAL chapter structure.

PRIORITY: Detect and follow the document's EXISTING structure:
1. Look for TABLE OF CONTENTS, PLAN, SOMMAIRE, AGENDA at the beginning
2. Look for numbered sections (I., II., 1., 2., Chapter 1, Chapitre 1, Part A, etc.)
3. Look for recurring headers/titles that indicate section boundaries
4. If no clear structure exists, create logical thematic chapters

IMPORTANT RULES:
- RESPECT the document's own chapter/section organization exactly as defined
- Extract ALL chapters from the document - do not limit the number
- Do NOT split what the document treats as a single section
- Do NOT merge sections that the document treats separately
- Skip exercises, QCM, TD sections (focus on CONTENT chapters only)

For EACH chapter provide:
1. "title": The exact or cleaned-up title from the document
2. "short_summary": 1-2 sentences describing what the chapter covers
3. "difficulty": 1=basic, 2=intermediate, 3=advanced
4. "learning_objectives": 2-4 measurable outcomes (define, calculate, explain, compare, apply...)
5. "key_concepts": 3-8 specific facts, formulas, or terms students must master
6. "prerequisites": Array of chapter indices (0-based) that should come before

DOCUMENT TYPE EXAMPLES:

Example 1 - Slides with Plan:
If the document has: "Plan: I.1 La courbe de demande, I.2 La courbe d'offre, I.3 Équilibres"
→ Create 3 chapters following this exact structure

Example 2 - Business Course with Topics:
If sections are: "Introduction, Valuation, Mergers & Acquisitions, Private Equity"
→ Create chapters matching these topics

Example 3 - Textbook with Chapters:
If numbered: "Chapter 1: Basics, Chapter 2: Advanced, Chapter 3: Applications"
→ Create 3 chapters following the textbook's own numbering

OUTPUT FORMAT:
{
  "detected_structure": "plan|toc|numbered|thematic|none",
  "chapters": [
    {
      "index": 0,
      "title": "La courbe de demande",
      "short_summary": "Comprendre la courbe de demande et le surplus du consommateur.",
      "difficulty": 1,
      "learning_objectives": [
        "Définir la disposition marginale à payer (DMP)",
        "Construire une courbe de demande à partir des DMP individuelles",
        "Calculer le surplus du consommateur"
      ],
      "key_concepts": [
        "DMP = prix maximum qu'un consommateur est prêt à payer pour une unité",
        "La courbe de demande est décroissante",
        "Surplus du consommateur = DMP - prix payé",
        "Élasticité-prix de la demande"
      ],
      "prerequisites": []
    }
  ]
}

COURSE TEXT:
${truncatedText}`;

  try {
    const languageReminder = `Respond in ${contentLanguage === 'FR' ? 'French' : contentLanguage === 'DE' ? 'German' : 'English'} (same as course text).`;

    const response = await withCircuitBreaker(
      openaiCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model: LLM_CONFIG.models.structuring,
            messages: [
              {
                role: 'system',
                content: `You are an expert learning designer. Return valid JSON only. ${languageReminder}`,
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: LLM_CONFIG.temperatures.structuring,
            response_format: { type: 'json_object' },
            max_tokens: LLM_CONFIG.maxTokens.chapterStructure,
          });
          return result;
        },
        { maxRetries: 3 }
      ),
      async () => {
        logContext.setFallbackUsed();
        return null;
      }
    );

    if (!response) {
      // Circuit breaker is open, use contextual fallback
      console.log('⚠️ Circuit breaker open, using contextual chapter fallback...');
      const fallbackChapters = generateContextualChapters(courseText, courseTitle || 'Course', contentLanguage);
      logContext.setFallbackUsed().success();
      return fallbackChapters;
    }

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');

    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    console.log('📑 Generated chapter structure', parsed.chapters?.length || 0);
    logContext.success();
    return parsed.chapters || [];
  } catch (error: any) {
    console.error('⚠️ Error generating chapter structure, using contextual fallback:', error);
    logContext.setFallbackUsed().failure(error, error?.status);

    // Use contextual fallback instead of generic single chapter
    return generateContextualChapters(courseText, courseTitle || 'Course', contentLanguage);
  }
}

/**
 * Generate default concepts when API fails
 */
function generateDefaultConcepts() {
  console.log('📝 Generating default Machine Learning concepts...');
  
  return {
    title: 'Introduction to Machine Learning',
    summary: 'This chapter covers fundamental concepts in machine learning, from basic principles to advanced techniques. Perfect for beginners and intermediate learners.',
    concepts: [
      {
        title: 'What is Machine Learning?',
        difficulty: 'easy',
        content: 'Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed. It focuses on developing algorithms that can identify patterns and make decisions with minimal human intervention.',
        definitions: ['Machine Learning', 'Artificial Intelligence', 'Algorithm', 'Pattern Recognition'],
        keyIdeas: [
          'Computers learn from experience',
          'No explicit programming needed',
          'Improves automatically with more data',
          'Makes predictions based on patterns'
        ]
      },
      {
        title: 'Supervised Learning',
        difficulty: 'medium',
        content: 'Supervised learning uses labeled training data to learn the relationship between inputs and outputs. The algorithm learns from examples where the correct answer is known, then applies this knowledge to new, unseen data. Common applications include classification (categorizing data) and regression (predicting continuous values).',
        definitions: ['Labeled Data', 'Training Set', 'Classification', 'Regression', 'Features', 'Labels'],
        keyIdeas: [
          'Learn from labeled examples',
          'Predict outcomes for new data',
          'Requires quality training data',
          'Two main types: classification and regression',
          'Accuracy improves with more examples'
        ]
      },
      {
        title: 'Unsupervised Learning',
        difficulty: 'medium',
        content: 'Unsupervised learning finds patterns in unlabeled data without predefined categories. The algorithm explores the data structure on its own, discovering hidden patterns and relationships. Key techniques include clustering (grouping similar items) and dimensionality reduction (simplifying complex data).',
        definitions: ['Unlabeled Data', 'Clustering', 'Dimensionality Reduction', 'Pattern Discovery', 'K-means'],
        keyIdeas: [
          'No labels or categories provided',
          'Discovers hidden patterns automatically',
          'Groups similar data points together',
          'Reduces data complexity',
          'Useful for exploratory analysis'
        ]
      },
      {
        title: 'Neural Networks and Deep Learning',
        difficulty: 'hard',
        content: 'Neural networks are computing systems inspired by biological neural networks in animal brains. Deep learning uses neural networks with multiple layers (deep networks) to learn hierarchical representations of data. This approach has revolutionized fields like computer vision, natural language processing, and speech recognition.',
        definitions: ['Neural Network', 'Deep Learning', 'Layers', 'Neurons', 'Activation Function', 'Backpropagation'],
        keyIdeas: [
          'Inspired by human brain structure',
          'Multiple layers process information',
          'Each layer learns different features',
          'Powerful for complex patterns',
          'Requires significant computational resources'
        ]
      },
      {
        title: 'Model Training and Evaluation',
        difficulty: 'medium',
        content: 'Training involves fitting a model to data by adjusting its parameters to minimize errors. Evaluation measures how well the model performs on unseen data. Key concepts include splitting data into training/validation/test sets, avoiding overfitting (memorizing training data), and using metrics like accuracy, precision, and recall.',
        definitions: ['Training Set', 'Validation Set', 'Test Set', 'Overfitting', 'Underfitting', 'Cross-validation'],
        keyIdeas: [
          'Split data into separate sets',
          'Train on training set only',
          'Validate during training',
          'Test on completely unseen data',
          'Balance between overfitting and underfitting',
          'Use appropriate evaluation metrics'
        ]
      }
    ]
  };
}

/**
 * Generate all 5 questions for a chapter at once
 * Questions 1-3: MCQ with A, B, C, D options (10 points each)
 * Question 4: Short answer (35 points)
 * Question 5: Reflective question (35 points)
 */
export async function generateChapterQuestions(
  chapterTitle: string,
  chapterContent: string,
  sourceText?: string,
  language: 'EN' | 'FR' | 'DE' = 'EN'
) {
  console.log('📝 Generating 5 questions for chapter:', chapterTitle);
  
  const languageInstruction = language === 'FR'
    ? 'Generate ALL questions and options in French (français).'
    : language === 'DE'
      ? 'Generate ALL questions and options in German (Deutsch).'
      : 'Generate ALL questions and options in English.';
  const languageReminder = `Always respond in the same language as the input course text (${language}). Never translate into any UI language.`;
  
  const prompt = `You are creating a learning quiz for the following chapter:

Title: ${chapterTitle}
Content: ${chapterContent}

${sourceText ? `Original Source Material:\n${sourceText.substring(0, 2000)}\n\n` : ''}

Generate EXACTLY 5 questions based on this content:

**Questions 1-3: Multiple Choice (MCQ)**
- Test basic understanding and key concepts
- Each question must have exactly 4 options (A, B, C, D)
- Clearly indicate the correct answer
- Worth 10 points each

**Question 4: Short Answer**
- Ask the student to explain a concept in their own words
- Should test deeper understanding
- Worth 35 points

**Question 5: Reflective**
- Ask how the concept applies to real-world scenarios
- Should encourage critical thinking
- Worth 35 points

${sourceText ? 'Base ALL questions on the actual content from the source material.' : ''}

${languageInstruction}
${languageReminder}

Return a JSON object with this EXACT structure:
{
  "questions": [
    {
      "questionNumber": 1,
      "type": "mcq",
      "phase": "mcq",
      "question": "Question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "A",
      "points": 10
    },
    {
      "questionNumber": 2,
      "type": "mcq",
      "phase": "mcq",
      "question": "Question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "B",
      "points": 10
    },
    {
      "questionNumber": 3,
      "type": "mcq",
      "phase": "mcq",
      "question": "Question text here?",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "C",
      "points": 10
    },
    {
      "questionNumber": 4,
      "type": "open",
      "phase": "short",
      "question": "Explain [concept] in your own words...",
      "points": 35
    },
    {
      "questionNumber": 5,
      "type": "open",
      "phase": "reflective",
      "question": "How would you apply [concept] to a real-world situation?",
      "points": 35
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert educational content creator. Generate engaging, accurate questions based on learning materials. Always return valid JSON. ${languageInstruction} ${languageReminder}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    
    console.log('✅ Generated', parsed.questions?.length || 0, 'questions for chapter');
    return parsed.questions || [];
  } catch (error) {
    console.error('❌ Error generating chapter questions:', error);
    
    // Fallback: Generate default questions
    return generateDefaultChapterQuestions(chapterTitle);
  }
}

/**
 * Calculate adaptive question count based on content to cover
 * Formula: (learning_objectives × 2) + (key_concepts × 1) + (facts × 0.5)
 * Min: 6, Max: 20
 */
function calculateAdaptiveQuestionCount(
  learningObjectives: string[],
  keyConcepts: string[],
  facts: VerifiableFact[]
): { count: number; breakdown: { objectives: number; concepts: number; facts: number } } {
  const objectiveScore = learningObjectives.length * 2;
  const conceptScore = keyConcepts.length * 1;
  const factScore = Math.floor(facts.length * 0.5);

  const rawCount = objectiveScore + conceptScore + factScore;
  const count = Math.max(6, Math.min(20, rawCount));

  return {
    count,
    breakdown: {
      objectives: learningObjectives.length,
      concepts: keyConcepts.length,
      facts: facts.length,
    },
  };
}

// New prompt for single-concept chapter question generation (adaptive count)
// Now with retry, logging, validation, deduplication, and semantic validation
// Phase 3: Pre-extract facts BEFORE generation to ensure questions are grounded in verifiable content
// Phase 4: Adaptive question count based on content coverage
// Phase 5: Quiz personalization with niveau (synthetique/standard/exhaustif)
export async function generateConceptChapterQuestions(
  chapterMetadata: {
    index?: number;
    title: string;
    short_summary?: string;
    difficulty?: number;
    learning_objectives?: string[];  // Phase 1: Learning objectives from chapter prompt
    key_concepts?: string[];          // Phase 1: Key concepts from chapter prompt
    prerequisites?: number[];         // Prerequisites (chapter indices)
  },
  chapterText: string,
  language: 'EN' | 'FR' | 'DE' = 'EN',
  options?: {
    enableSemanticValidation?: boolean;  // Phase 2: Enable LLM-based semantic validation
    facts?: VerifiableFact[];             // Pre-extracted facts for validation
    quizConfig?: QuizConfig;              // Phase 5: Quiz personalization config
  }
) {
  const logContext = llmLogger.createContext('generateConceptChapterQuestions', LLM_CONFIG.models.primary);
  console.log('🧠 Generating questions (concept prompt) for chapter:', chapterMetadata.title);

  const languageInstruction = language === 'FR'
    ? 'Generate ALL questions, options, and explanations in French (français).'
    : language === 'DE'
      ? 'Generate ALL questions, options, and explanations in German (Deutsch).'
      : 'Generate ALL questions, options, and explanations in English.';

  // Truncate chapter text
  const truncatedText = chapterText.substring(0, LLM_CONFIG.truncation.chapterText);

  // Phase 3: Pre-extract verifiable facts BEFORE generating questions
  // This ensures questions are grounded in actual content from the source
  let preExtractedFacts: VerifiableFact[] = options?.facts || [];
  if (preExtractedFacts.length === 0) {
    console.log('📚 Pre-extracting verifiable facts from source text...');
    preExtractedFacts = await extractVerifiableFacts(chapterText, chapterMetadata.title, language);
    console.log(`📚 Extracted ${preExtractedFacts.length} verifiable facts`);
  }

  // Format facts for the prompt - this is the key change
  // Instead of letting LLM invent source_references, we give it verified facts to use
  const factsForPrompt = preExtractedFacts.length > 0
    ? `\nVERIFIED FACTS FROM SOURCE (use these as source_reference for questions):
${preExtractedFacts.map((f, i) => `${i + 1}. [${f.category}] "${f.statement}"
   Source: "${f.source_quote.substring(0, 100)}${f.source_quote.length > 100 ? '...' : ''}"`).join('\n')}

IMPORTANT: Each question's source_reference MUST be one of these verified facts or their source quotes (copy exactly or paraphrase closely).
Only create questions that can be directly answered using one of these facts.`
    : '';

  // Phase 4: Calculate adaptive question count based on content to cover
  const learningObjectivesArray = chapterMetadata.learning_objectives || [];
  const keyConceptsArray = chapterMetadata.key_concepts || [];
  const adaptiveCount = calculateAdaptiveQuestionCount(
    learningObjectivesArray,
    keyConceptsArray,
    preExtractedFacts
  );

  // Phase 5: Apply niveau multiplier from quiz config
  const quizConfig = options?.quizConfig || DEFAULT_QUIZ_CONFIG;
  const adjustedCount = getAdjustedQuestionCount(adaptiveCount.count, quizConfig.niveau);
  const niveauBlock = getNiveauBlock(quizConfig.niveau, adaptiveCount.count);

  console.log(`📊 Adaptive question count: ${adaptiveCount.count} -> ${adjustedCount} (niveau: ${quizConfig.niveau}, objectives: ${adaptiveCount.breakdown.objectives}, concepts: ${adaptiveCount.breakdown.concepts}, facts: ${adaptiveCount.breakdown.facts})`);

  // Enhanced prompt with source_reference, cognitive_level, and strict quality rules
  const learningObjectives = learningObjectivesArray.length
    ? `\nLEARNING OBJECTIVES TO TEST (${learningObjectivesArray.length} objectives - generate at least one question per objective):\n${learningObjectivesArray.map((obj: string, i: number) => `${i + 1}. ${obj}`).join('\n')}`
    : '';
  const keyConcepts = keyConceptsArray.length
    ? `\nKEY CONCEPTS TO COVER (${keyConceptsArray.length} concepts - ensure each is tested):\n${keyConceptsArray.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')}`
    : '';

  const prompt = `Generate MCQ quiz for this chapter concept. Each question MUST include:
- "type": "multiple_choice"
- "prompt": The question text
- "options": Exactly 4 unique options
- "correct_option_index": 0-based index of correct answer
- "explanation": REQUIRED - Pedagogical explanation in 2-3 sentences that:
  1. States which option letter (A, B, C, or D) is correct and why (cite/paraphrase the course)
  2. Explains WHY each wrong option is incorrect using their letter (not just "it's wrong")
  Use the option letters (A, B, C, D) based on the order in the "options" array (index 0 = A, 1 = B, 2 = C, 3 = D).
  Example: "La bonne réponse est B. Le cours indique que le WACC se calcule en pondérant le coût des fonds propres et de la dette. L'option A confond avec le MEDAF. L'option C omet la pondération. L'option D décrit un autre concept."
- "source_reference": REQUIRED - The EXACT quote from the source text (15-50 words) that justifies the correct answer. Copy verbatim from the provided text.
- "cognitive_level": One of "remember" (recall facts), "understand" (explain concepts), "apply" (use knowledge in new situations)
- "concept_tested": Which key concept or learning objective this question tests

CRITICAL RULES FOR QUESTION QUALITY:
1. ONLY ONE CORRECT ANSWER: Each question must have exactly ONE unambiguously correct option. The other 3 must be clearly wrong based on the source text.
2. NO PARTIAL TRUTHS: Never create questions where multiple options could be partially correct. If the text mentions multiple valid items (e.g., "A and B both cause X"), do NOT ask "What causes X?" with A and B as separate options.
3. PRECISE WORDING: Questions must be specific. Use phrases like "According to the text...", "Which BEST describes...", "The PRIMARY reason is...".
4. MANDATORY SOURCE REFERENCE: Every question MUST have a source_reference field with the exact text passage that proves the correct answer. If you cannot find explicit support in the text, DO NOT create that question.
5. AVOID TRAP QUESTIONS: If the text lists multiple related concepts, ask about distinguishing features, not shared characteristics.
6. COVER ALL LEARNING OBJECTIVES: Generate at least one question per learning objective listed below.
7. TEST KEY CONCEPTS: Generate questions that directly test the key concepts extracted from the text.
8. NO MEMORIZATION OF CALCULATION RESULTS: NEVER ask students to memorize specific numerical results from example calculations (e.g., "What is the WACC?" with answer "8.5%", "What is the NPV?" with answer "$1.2M"). This is pedagogically useless because:
   - Students cannot derive the answer without knowing the inputs
   - Memorizing example results has no educational value
   INSTEAD, do one of these:
   a) Ask about the FORMULA or METHODOLOGY: "What components are used to calculate WACC?"
   b) PROVIDE THE INPUTS and ask to calculate: "Given cost of equity = 10%, cost of debt = 5%, calculate WACC"
   c) Ask about INTERPRETATION: "What does a high WACC indicate for investment decisions?"
   d) Ask about CONCEPTS: "Why is the cost of debt tax-adjusted in WACC?"

9. FORMULA QUESTIONS ARE ENCOURAGED - BUT FORMAT OPTIONS CORRECTLY:
   Asking about formulas is EXCELLENT pedagogy! But format the options correctly:
   - NEVER start an option with the variable name followed by "=" (e.g., "FCFF = ...")
   - Show ONLY the formula itself without the variable prefix
   - This applies to ALL options, not just the correct one

   EXAMPLE - Question: "What is the formula for FCFF?"
   ❌ BAD options: "FCFF = EBIT(1-t) + D&A - CapEx - ΔNWC", "FCFE = ...", "WACC = ..."
   ✅ GOOD options: "EBIT(1-t) + D&A - CapEx - ΔNWC", "Net Income + D&A - CapEx - ΔNWC", "EBITDA - Taxes - CapEx"

   Why? If only one option starts with "FCFF = ", students know it's the answer without understanding the formula.

DISTRACTOR QUALITY RULES (for wrong answers):
- Distractors CAN reference concepts from the text, but must NOT be valid answers to THIS specific question
- Good distractors are PLAUSIBLE (related to the topic) but CLEARLY INCORRECT for this question
- Types of good distractors:
  a) Common misconceptions about the concept
  b) True statements about related concepts that don't answer THIS question
  c) Partially correct statements that miss a key element
  d) Similar-sounding terms with different meanings
- BAD distractors: completely unrelated topics, obviously absurd answers, or items that could also be correct

${niveauBlock}

COVERAGE REQUIREMENTS:
1. Every learning objective MUST be tested by at least one question
2. Every key concept MUST be covered by at least one question
3. Questions should be distributed across all verified facts when possible
4. If content overlaps, one question can test multiple objectives/concepts (indicate in concept_tested field)

Prioritize quality and coverage.

Balance cognitive levels: 40% remember, 40% understand, 20% apply.

Example with GOOD distractors:
{
  "questions": [
    {
      "type": "multiple_choice",
      "prompt": "According to the neoclassical hypothesis, merger waves are PRIMARILY driven by:",
      "options": [
        "Managerial overconfidence and empire-building",
        "Economic shocks and industry restructuring",
        "Stock market overvaluation by investors",
        "Regulatory changes in antitrust policy"
      ],
      "correct_option_index": 1,
      "explanation": "La bonne réponse est B. Le texte indique que l'hypothèse néoclassique attribue les vagues de fusions aux chocs économiques affectant la structure industrielle. L'option A (surconfiance managériale) et l'option C (surévaluation boursière) décrivent plutôt l'hypothèse comportementale. L'option D (changements réglementaires) est un facteur mais pas le moteur principal selon cette théorie.",
      "source_reference": "The neoclassical hypothesis posits that merger waves occur in response to economic shocks that affect industry structure.",
      "cognitive_level": "understand",
      "concept_tested": "Neoclassical hypothesis definition"
    }
  ]
}

CHAPTER: ${chapterMetadata.title}
DIFFICULTY: ${chapterMetadata.difficulty || 2}
SUMMARY: ${chapterMetadata.short_summary || ''}
${learningObjectives}
${keyConcepts}
${factsForPrompt}

SOURCE TEXT:
${truncatedText}`;

  try {
    const response = await withCircuitBreaker(
      openaiCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model: LLM_CONFIG.models.questionGeneration,
            messages: [
              {
                role: 'system',
                content: `Expert quiz creator. Return valid JSON only. ${languageInstruction}`,
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: LLM_CONFIG.temperatures.questionGeneration,
            response_format: { type: 'json_object' },
            max_tokens: LLM_CONFIG.maxTokens.questionGeneration,
          });
          return result;
        },
        { maxRetries: 3 } // Increased from 2 to compensate for gpt-4o-mini
      ),
      async () => {
        logContext.setFallbackUsed();
        return null;
      }
    );

    if (!response) {
      // Circuit breaker is open
      console.log('⚠️ Circuit breaker open, using contextual question fallback...');
      const fallbackQuestions = generateContextualQuestions(chapterMetadata.title, chapterText, language, 8);
      logContext.setFallbackUsed().success();
      return fallbackQuestions;
    }

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    let questions: MCQQuestion[] = parsed.questions || [];

    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    // Validate and fix questions
    const validationResult = validateQuestionBatch(questions);
    console.log(`📊 Question validation: ${validationResult.stats.valid} valid, ${validationResult.stats.fixed} fixed, ${validationResult.stats.rejected} rejected`);

    if (validationResult.stats.rejected > 0) {
      console.warn(`⚠️ ${validationResult.stats.rejected} questions rejected due to validation errors`);
    }

    // Use validated questions
    questions = validationResult.valid;

    // Deduplicate questions
    const deduplicatedQuestions = deduplicateQuestions(questions, 0.65); // Lowered from 0.75 for stricter deduplication
    if (deduplicatedQuestions.length < questions.length) {
      console.log(`🔄 Removed ${questions.length - deduplicatedQuestions.length} duplicate questions`);
    }

    // Phase 2: Optional semantic validation
    // Now uses the pre-extracted facts from Phase 3 (no double extraction)
    let finalQuestions = deduplicatedQuestions;
    if (options?.enableSemanticValidation && deduplicatedQuestions.length > 0 && preExtractedFacts.length > 0) {
      console.log('🔍 Running semantic validation on questions (using pre-extracted facts)...');

      const semanticResult = await validateQuestionBatchSemantically(
        deduplicatedQuestions,
        preExtractedFacts,  // Reuse the facts we already extracted
        chapterText,
        language,
        { minConfidence: 0.6, maxConcurrentValidations: 3 }
      );

      console.log(`🔍 Semantic validation: ${semanticResult.stats.valid}/${semanticResult.stats.total} questions passed`);

      if (semanticResult.stats.invalid > 0) {
        console.warn(`⚠️ ${semanticResult.stats.invalid} questions failed semantic validation`);
        // Log issues for debugging
        for (const invalid of semanticResult.invalidQuestions.slice(0, 3)) {
          console.warn(`  - Q: "${invalid.question.prompt?.substring(0, 50)}..." Issues: ${invalid.result.issues.join(', ')}`);
        }
      }

      finalQuestions = semanticResult.validQuestions;
    }

    console.log('✅ Generated', finalQuestions.length, 'validated questions for chapter');
    logContext.success();
    return finalQuestions;
  } catch (error: any) {
    console.error('❌ Error generating concept-based questions:', error);
    logContext.setFallbackUsed().failure(error, error?.status);

    // Use contextual fallback instead of generic questions
    return generateContextualQuestions(chapterMetadata.title, chapterText, language, 8);
  }
}

// Generate a REVIEW SUMMARY for a completed quiz attempt.
export async function generateQuizReviewSummary(attempt: {
  items: Array<{
    index: number;
    question: string;
    student_answer: string;
    correct_answer: string;
    is_correct: boolean;
    explanation?: string;
    page_source?: string | null;
  }>;
}, language: 'EN' | 'FR' | 'DE' = 'EN') {
  const languageReminder = `Always respond in the same language as the input course text (${language}). Never translate feedback into another language.`;
  const reviewPrompt = `You are an expert learning coach.
Your task is to generate a CLEAR and CONCRETE performance feedback for a student after completing a quiz on one chapter.

You receive:
1) The list of all quiz questions
2) The student answers
3) The correct answers
4) The explanations for each question
5) The page numbers from the student's uploaded document where each concept or answer can be found (page_source field)

Your output MUST allow the UI to show:
- On the left: Strong points (2 to 4 bullets)
- In the center: Score summary based ONLY on correctness
- On the right: Points to improve (2 to 6 bullets), each with the page reference
- BELOW: A concrete list of items the student should review (actionable steps)

MANDATORY RULES:
1) Use ONLY the answer data and page_source to produce feedback.
2) Each point must reference the exact question number(s), for example: “You answered Q4 correctly thanks to your understanding of X (page 12).”
3) For mistakes, ALWAYS include: question number, correct idea, page where the correct information appears.
4) Feedback must be SHORT, ACTIONABLE and SPECIFIC. No generic sentences.
5) Tone: helpful, factual, direct.
6) Do NOT regenerate or alter the questions; only summarize results.

OUTPUT FORMAT (STRICT JSON):
{
  "score_summary": {
    "correct_count": 5,
    "total_questions": 9
  },
  "strengths": [
    "Example: Strong understanding of customer churn drivers (Q2, page 7).",
    "Example: Correctly identified cost structure impact in SaaS (Q5, page 11)."
  ],
  "weaknesses": [
    "Example: Confusion around revenue expansion mechanics (Q3, page 9).",
    "Example: Misinterpreted automation efficiency impact (Q6, page 14)."
  ],
  "recommended_review": [
    "Re-read the section on expansion revenue (pages 8 to 10).",
    "Revisit the part that explains automation vs human costs (page 14)."
  ]
}

NOW generate ONLY the JSON feedback summary.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert learning coach. Always return valid JSON only. ${languageReminder}`,
        },
        {
          role: 'user',
          content: `${languageReminder}\n\n${reviewPrompt}\n\nATTEMPT DATA:\n${JSON.stringify(attempt, null, 2)}`,
        },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    return parsed;
  } catch (error) {
    console.error('⚠️ Error generating review summary:', error);
    // Fallback respecting the expected schema
    return {
      summary: attempt.items.map((item) => ({
        index: item.index,
        question: item.question,
        student_answer: item.student_answer,
        is_correct: item.is_correct,
        correct_answer: item.correct_answer,
        explanation: item.explanation || 'Review the key idea for this question.',
      })),
      global_feedback: {
        strengths: 'Tu as bien maîtrisé plusieurs points clés. Bravo pour ces réussites !',
        weaknesses: 'Quelques notions restent à consolider. Concentre-toi sur les items en rouge.',
        next_steps: 'Revois rapidement les notions manquées puis pratique avec quelques exemples ciblés.',
      },
    };
  }
}

/**
 * Generate default questions when API fails
 */
function generateDefaultChapterQuestions(chapterTitle: string) {
  console.log('📝 Generating default questions for:', chapterTitle);
  
  return [
    {
      questionNumber: 1,
      type: 'mcq',
      phase: 'mcq',
      question: `What is the main concept covered in "${chapterTitle}"?`,
      options: [
        'Understanding the fundamental principles',
        'Memorizing specific facts',
        'Applying advanced techniques',
        'Reviewing historical context'
      ],
      correctAnswer: 'A',
      points: 10
    },
    {
      questionNumber: 2,
      type: 'mcq',
      phase: 'mcq',
      question: `Which of the following best describes a key aspect of ${chapterTitle}?`,
      options: [
        'It requires extensive prior knowledge',
        'It builds on foundational concepts',
        'It is only theoretical',
        'It has no practical applications'
      ],
      correctAnswer: 'B',
      points: 10
    },
    {
      questionNumber: 3,
      type: 'mcq',
      phase: 'mcq',
      question: `What is an important consideration when learning about ${chapterTitle}?`,
      options: [
        'Speed over understanding',
        'Memorization over comprehension',
        'Understanding the underlying principles',
        'Skipping difficult parts'
      ],
      correctAnswer: 'C',
      points: 10
    },
    {
      questionNumber: 4,
      type: 'open',
      phase: 'short',
      question: `Explain the main concept of "${chapterTitle}" in your own words. What makes it important?`,
      points: 35
    },
    {
      questionNumber: 5,
      type: 'open',
      phase: 'reflective',
      question: `How could you apply the concepts from "${chapterTitle}" to solve a real-world problem? Provide a specific example.`,
      points: 35
    }
  ];
}

// Re-export other functions from the original openai.ts
export async function generateQuizQuestion(
  concept: string,
  phase: 1 | 2 | 3,
  previousQuestions: string[] = [],
  sourceText?: string // Optional source text from the original image/PDF
) {
  const phaseInstructions = {
    1: 'Generate a multiple-choice question (4 options) to test basic understanding. Include the correct answer.',
    2: 'Generate a short-answer question that requires the student to explain the concept in their own words.',
    3: 'Generate an open-ended reflective question that asks how this concept applies to real-world scenarios or personal experience.',
  };

  const prompt = `Concept: ${concept}

${sourceText ? `Original Source Material:\n${sourceText.substring(0, 1000)}\n\n` : ''}${phaseInstructions[phase]}

${previousQuestions.length > 0 ? `Previous questions to avoid duplicating:\n${previousQuestions.join('\n')}` : ''}

${sourceText ? 'Base your question on the actual content from the source material above.' : ''}

Return a JSON object with this structure:
${phase === 1 ? '{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A"}' : '{"question": "..."}'}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are Nareo, a friendly AI tutor. Generate engaging educational questions based on the provided learning materials.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || '{}');
  } catch (error) {
    console.error('Error generating question:', error);
    
    // Fallback questions
    if (phase === 1) {
      return {
        question: `What is the main purpose of ${concept}?`,
        options: [
          'To process data automatically',
          'To make predictions based on patterns',
          'To store information efficiently',
          'To visualize complex data'
        ],
        correctAnswer: 'To make predictions based on patterns'
      };
    } else if (phase === 2) {
      return {
        question: `Explain ${concept} in your own words. What makes it important?`
      };
    } else {
      return {
        question: `How could you apply ${concept} to solve a real-world problem you care about?`
      };
    }
  }
}

export async function evaluateAnswer(
  question: string,
  studentAnswer: string,
  phase: 1 | 2 | 3,
  correctAnswer?: string,
  sourceText?: string, // Optional source text for reference
  language: 'EN' | 'FR' | 'DE' = 'EN'
) {
  const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';
  const languageReminder = `Respond only in ${languageName} (the course content language). Never translate into another language or the UI language.`;
  const prompt = phase === 1 && correctAnswer
    ? `Question: ${question}
Student answer: ${studentAnswer}
Correct answer: ${correctAnswer}
${sourceText ? `\nSource material:\n${sourceText.substring(0, 800)}\n` : ''}

Is the student answer correct? ${sourceText ? 'Use the source material to verify accuracy.' : ''} ${languageReminder}
Return JSON: {"correct": true/false, "feedback": "short feedback in ${languageName}"}`
    : `Question: ${question}
Student answer: ${studentAnswer}
${sourceText ? `\nSource material:\n${sourceText.substring(0, 800)}\n` : ''}

Evaluate this answer for Phase ${phase}. Consider:
- Accuracy and understanding
- Completeness
- Clarity of the explanation
${phase === 3 ? '- Depth of reflection and real-world connection' : ''}
${sourceText ? '- Alignment with the source material' : ''}

${languageReminder}

Return JSON:
{
  "score": 0-${phase === 1 ? 10 : phase === 2 ? 30 : 60},
  "feedback": "constructive feedback in ${languageName}",
  "needsClarification": true/false,
  "followUpQuestion": "optional follow-up question in ${languageName} if the answer lacks depth"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Nareo, a supportive AI tutor for motivated students. Always answer in ${languageName}. ${languageReminder} Keep explanations concise, specific, and aligned with the course content.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content || '{}');
  } catch (error) {
    console.error('Error evaluating answer:', error);

    // Fallback evaluation - keep in content language
    const answerLength = studentAnswer.trim().length;
    const maxScore = phase === 1 ? 10 : phase === 2 ? 30 : 60;
    const fallbackFeedbackMap: Record<string, string> = {
      EN: 'Good effort! Revisit the course text and expand your answer.',
      FR: 'Bon effort ! Revois le texte du cours et développe ta réponse.',
      DE: 'Gute Arbeit! Sieh dir den Kurstext noch einmal an und erläutere deine Antwort weiter.',
    };
    const fallbackFollowUpMap: Record<string, string> = {
      EN: 'Can you add more detail or an example from the course text?',
      FR: 'Peux-tu ajouter plus de détails ou un exemple tiré du cours ?',
      DE: 'Kannst du mehr Details oder ein Beispiel aus dem Kurstext ergänzen?',
    };

    const fallbackFeedback = fallbackFeedbackMap[language] || fallbackFeedbackMap.EN;

    const fallbackQuestion = fallbackFollowUpMap[language] || fallbackFollowUpMap.EN;

    return {
      score: Math.min(maxScore, Math.floor(answerLength / 10) * 5),
      feedback: fallbackFeedback,
      needsClarification: answerLength < 20,
      followUpQuestion: answerLength < 20 ? fallbackQuestion : undefined
    };
  }
}

export async function generateNareoResponse(
  context: string,
  userMessage: string,
  phase: 1 | 2 | 3
) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Tu es Nareo, l'assistant pédagogique de l'application Nareo.

RÈGLE ABSOLUE : Tu ne fais RIEN par toi-même. Tu suis strictement l'état envoyé par le backend/frontend.

Le backend t'envoie des informations comme :
• chapterId, chapterTitle
• currentQuestionIndex (0 pour la première question)
• totalQuestions
• isFirstVisit (booléen)
• hasExistingHistory (booléen)
• chapterCompleted (booléen)
• questionType (QCM, Court, Réflexion)
• questionText et choices éventuelles
• lastUserAnswer et isCorrect éventuel

Tu n'inventes JAMAIS ces valeurs, tu te contentes de les utiliser.

1) INTRODUCTION DU CHAPITRE

Il existe UN SEUL message d'introduction valide, que tu dois afficher TEL QUEL, sans aucune modification :

👋 Bonjour ! Je suis Nareo, votre assistant d'apprentissage.

📚 Bienvenue dans le chapitre [TITRE DU CHAPITRE] !

Ce chapitre contient 5 questions pour tester votre compréhension. Chaque question ne peut être répondue qu'une seule fois. Je vous donnerai un feedback pédagogique après chaque réponse, puis nous passerons à la question suivante.

🎯 Points par question :
• Questions 1-3 (QCM) : 10 points chacune
• Questions 4-5 (Réponse courte/Réflexive) : 35 points chacune

📝 Important : Une seule tentative par question. Réfléchissez bien avant de répondre !

✨ Commençons !

Tu n'affiches ce message QUE SI :
• currentQuestionIndex == 0
• isFirstVisit == true
• hasExistingHistory == false

Dans TOUS les autres cas (refresh, reprise, navigation), tu n'affiches JAMAIS ce message.

2) AFFICHAGE DES QUESTIONS

Tu affiches uniquement la question correspondant à currentQuestionIndex.

Pour un QCM, format impératif :

Question X : [intitulé]

A) …
B) …
C) …
D) …

💡 Tapez la lettre de votre réponse (A, B, C ou D)

Une seule bonne réponse est possible.

Tu n'ajoutes pas d'autres questions dans le même message.

3) CORRECTION ET AVANCEMENT

Si isCorrect == true :
• Félicite brièvement
• Explique en français, courte et claire, pourquoi c'est correct
• Laisse le backend envoyer la question suivante

Si isCorrect == false :
• Explique que c'est incorrect
• Donne la bonne réponse et une explication pédagogique en français
• La question est terminée (pas de "essaie encore")
• Le backend décide d'envoyer la question suivante

4) REPRISE APRÈS REFRESH

Quand hasExistingHistory == true :
• L'introduction a déjà été affichée
• Les questions précédentes ont déjà été posées
• Tu ne réaffiches NI l'introduction NI la question 1
• Tu continues à partir de la dernière question et de l'historique fourni
• Tu ne réinitialises JAMAIS le chapitre par toi-même

5) PONCTUATION ET STYLE

• Toujours en français
• Pas de virgules à la place de points
• Pas de virgules pour simuler des puces. Utilise « • » ou des sauts de ligne
• Respecte les traits d'union français (est-il, aujourd'hui, peut-être)
• Style simple, pédagogique, clair

6) BOUTON "Je ne sais pas"

• Tu donnes directement la bonne réponse
• Tu expliques de manière simple et courte
• La question est considérée comme terminée

7) FIN DU CHAPITRE

Quand chapterCompleted == true :
• Message de félicitations
• Indique le score (si fourni)
• Invite à passer au chapitre suivant
• Tu ne redémarres JAMAIS le chapitre tout seul

OBJECTIF PRINCIPAL : Cohérence absolue. Ne jamais réafficher l'introduction au mauvais moment, ne jamais redémarrer un quiz entamé, ne pas inventer de contenu.`,
        },
        {
          role: 'user',
          content: `Contexte : ${context}\n\nL'étudiant dit : ${userMessage}\n\nRéponds en tant que Nareo (en français) :`,
        },
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('Error generating Nareo response:', error);
    return "Je suis là pour t'aider ! Travaillons ensemble sur ce concept. 🐱📚";
  }
}

// ============================================================================
// GÉNÉRATION DE QUESTIONS VRAI/FAUX
// ============================================================================

export async function generateTrueFalseQuestions(
  chapterMetadata: {
    index?: number;
    title: string;
    short_summary?: string;
    difficulty?: number;
    learning_objectives?: string[];
    key_concepts?: string[];
  },
  chapterText: string,
  language: 'EN' | 'FR' | 'DE' = 'EN',
  options?: {
    enableSemanticValidation?: boolean;
    facts?: VerifiableFact[];
    quizConfig?: QuizConfig;
  }
) {
  const logContext = llmLogger.createContext('generateTrueFalseQuestions', LLM_CONFIG.models.primary);
  console.log('🔘 Generating true/false questions for chapter:', chapterMetadata.title);

  const languageInstruction = language === 'FR'
    ? 'Generate ALL statements and explanations in French (français).'
    : language === 'DE'
      ? 'Generate ALL statements and explanations in German (Deutsch).'
      : 'Generate ALL statements and explanations in English.';

  const truncatedText = chapterText.substring(0, LLM_CONFIG.truncation.chapterText);

  // Pre-extract facts
  let preExtractedFacts: VerifiableFact[] = options?.facts || [];
  if (preExtractedFacts.length === 0) {
    console.log('📚 Pre-extracting verifiable facts for true/false...');
    preExtractedFacts = await extractVerifiableFacts(chapterText, chapterMetadata.title, language);
    console.log(`📚 Extracted ${preExtractedFacts.length} verifiable facts`);
  }

  const factsForPrompt = preExtractedFacts.length > 0
    ? `\nVERIFIED FACTS FROM SOURCE (use these as source_reference):
${preExtractedFacts.map((f, i) => `${i + 1}. [${f.category}] "${f.statement}"
   Source: "${f.source_quote.substring(0, 100)}${f.source_quote.length > 100 ? '...' : ''}"`).join('\n')}

IMPORTANT: Each statement's source_reference MUST be one of these verified facts.`
    : '';

  // Calculate adaptive count
  const learningObjectivesArray = chapterMetadata.learning_objectives || [];
  const keyConceptsArray = chapterMetadata.key_concepts || [];
  const adaptiveCount = calculateAdaptiveQuestionCount(
    learningObjectivesArray,
    keyConceptsArray,
    preExtractedFacts
  );

  const quizConfig = options?.quizConfig || DEFAULT_QUIZ_CONFIG;
  const adjustedCount = getAdjustedQuestionCount(adaptiveCount.count, quizConfig.niveau);

  console.log(`📊 True/False question count: ${adjustedCount} (niveau: ${quizConfig.niveau})`);

  const learningObjectives = learningObjectivesArray.length
    ? `\nLEARNING OBJECTIVES TO TEST:\n${learningObjectivesArray.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}`
    : '';
  const keyConcepts = keyConceptsArray.length
    ? `\nKEY CONCEPTS TO COVER:\n${keyConceptsArray.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : '';

  const prompt = getTrueFalsePrompt(
    {
      title: chapterMetadata.title,
      difficulty: chapterMetadata.difficulty,
      short_summary: chapterMetadata.short_summary,
    },
    quizConfig.niveau,
    adaptiveCount.count,
    factsForPrompt,
    learningObjectives,
    keyConcepts,
    truncatedText
  );

  try {
    const response = await withCircuitBreaker(
      openaiCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model: LLM_CONFIG.models.questionGeneration,
            messages: [
              {
                role: 'system',
                content: `Expert quiz creator for true/false questions. Return valid JSON only. ${languageInstruction}`,
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: LLM_CONFIG.temperatures.questionGeneration,
            response_format: { type: 'json_object' },
            max_tokens: LLM_CONFIG.maxTokens.questionGeneration,
          });
          return result;
        },
        { maxRetries: 3 }
      ),
      async () => {
        logContext.setFallbackUsed();
        return null;
      }
    );

    if (!response) {
      console.log('⚠️ Circuit breaker open for true/false generation');
      logContext.setFallbackUsed().success();
      return [];
    }

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    const questions = parsed.questions || [];

    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    console.log('✅ Generated', questions.length, 'true/false questions');
    logContext.success();
    return questions;
  } catch (error: any) {
    console.error('❌ Error generating true/false questions:', error);
    logContext.setFallbackUsed().failure(error, error?.status);
    return [];
  }
}

// ============================================================================
// GÉNÉRATION DE QUESTIONS TEXTE À TROUS
// ============================================================================

export async function generateFillBlankQuestions(
  chapterMetadata: {
    index?: number;
    title: string;
    short_summary?: string;
    difficulty?: number;
    learning_objectives?: string[];
    key_concepts?: string[];
  },
  chapterText: string,
  language: 'EN' | 'FR' | 'DE' = 'EN',
  options?: {
    enableSemanticValidation?: boolean;
    facts?: VerifiableFact[];
    quizConfig?: QuizConfig;
  }
) {
  const logContext = llmLogger.createContext('generateFillBlankQuestions', LLM_CONFIG.models.primary);
  console.log('📝 Generating fill-in-the-blank questions for chapter:', chapterMetadata.title);

  const languageInstruction = language === 'FR'
    ? 'Generate ALL sentences and explanations in French (français).'
    : language === 'DE'
      ? 'Generate ALL sentences and explanations in German (Deutsch).'
      : 'Generate ALL sentences and explanations in English.';

  const truncatedText = chapterText.substring(0, LLM_CONFIG.truncation.chapterText);

  // Pre-extract facts
  let preExtractedFacts: VerifiableFact[] = options?.facts || [];
  if (preExtractedFacts.length === 0) {
    console.log('📚 Pre-extracting verifiable facts for fill-blank...');
    preExtractedFacts = await extractVerifiableFacts(chapterText, chapterMetadata.title, language);
    console.log(`📚 Extracted ${preExtractedFacts.length} verifiable facts`);
  }

  const factsForPrompt = preExtractedFacts.length > 0
    ? `\nVERIFIED FACTS FROM SOURCE (use these as source_reference):
${preExtractedFacts.map((f, i) => `${i + 1}. [${f.category}] "${f.statement}"
   Source: "${f.source_quote.substring(0, 100)}${f.source_quote.length > 100 ? '...' : ''}"`).join('\n')}

IMPORTANT: Each question's source_reference MUST be one of these verified facts.`
    : '';

  // Calculate adaptive count
  const learningObjectivesArray = chapterMetadata.learning_objectives || [];
  const keyConceptsArray = chapterMetadata.key_concepts || [];
  const adaptiveCount = calculateAdaptiveQuestionCount(
    learningObjectivesArray,
    keyConceptsArray,
    preExtractedFacts
  );

  const quizConfig = options?.quizConfig || DEFAULT_QUIZ_CONFIG;
  const adjustedCount = getAdjustedQuestionCount(adaptiveCount.count, quizConfig.niveau);

  console.log(`📊 Fill-blank question count: ${adjustedCount} (niveau: ${quizConfig.niveau})`);

  const learningObjectives = learningObjectivesArray.length
    ? `\nLEARNING OBJECTIVES TO TEST:\n${learningObjectivesArray.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}`
    : '';
  const keyConcepts = keyConceptsArray.length
    ? `\nKEY CONCEPTS TO COVER:\n${keyConceptsArray.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : '';

  const prompt = getFillBlankPrompt(
    {
      title: chapterMetadata.title,
      difficulty: chapterMetadata.difficulty,
      short_summary: chapterMetadata.short_summary,
    },
    quizConfig.niveau,
    adaptiveCount.count,
    factsForPrompt,
    learningObjectives,
    keyConcepts,
    truncatedText
  );

  try {
    const response = await withCircuitBreaker(
      openaiCircuitBreaker,
      () => withRetry(
        async () => {
          const result = await openai.chat.completions.create({
            model: LLM_CONFIG.models.questionGeneration,
            messages: [
              {
                role: 'system',
                content: `Expert quiz creator for fill-in-the-blank questions. Return valid JSON only. ${languageInstruction}`,
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: LLM_CONFIG.temperatures.questionGeneration,
            response_format: { type: 'json_object' },
            max_tokens: LLM_CONFIG.maxTokens.questionGeneration,
          });
          return result;
        },
        { maxRetries: 3 }
      ),
      async () => {
        logContext.setFallbackUsed();
        return null;
      }
    );

    if (!response) {
      console.log('⚠️ Circuit breaker open for fill-blank generation');
      logContext.setFallbackUsed().success();
      return [];
    }

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    const questions = parsed.questions || [];

    if (response.usage) {
      logContext.setTokens(response.usage);
    }

    console.log('✅ Generated', questions.length, 'fill-blank questions');
    logContext.success();
    return questions;
  } catch (error: any) {
    console.error('❌ Error generating fill-blank questions:', error);
    logContext.setFallbackUsed().failure(error, error?.status);
    return [];
  }
}

// ============================================================================
// GÉNÉRATION DE QUIZ MIXTE (PLUSIEURS TYPES)
// ============================================================================

export async function generateMixedQuiz(
  chapterMetadata: {
    index?: number;
    title: string;
    short_summary?: string;
    difficulty?: number;
    learning_objectives?: string[];
    key_concepts?: string[];
  },
  chapterText: string,
  language: 'EN' | 'FR' | 'DE' = 'EN',
  quizConfig: QuizConfig,
  options?: {
    enableSemanticValidation?: boolean;
    facts?: VerifiableFact[];
  }
) {
  console.log('🎲 Generating mixed quiz for chapter:', chapterMetadata.title);

  // Pre-extract facts once for all question types
  let preExtractedFacts: VerifiableFact[] = options?.facts || [];
  if (preExtractedFacts.length === 0) {
    console.log('📚 Pre-extracting verifiable facts for mixed quiz...');
    preExtractedFacts = await extractVerifiableFacts(chapterText, chapterMetadata.title, language);
    console.log(`📚 Extracted ${preExtractedFacts.length} verifiable facts`);
  }

  const allQuestions: any[] = [];
  const activeTypes = Object.entries(quizConfig.types).filter(([, active]) => active);

  if (activeTypes.length === 0) {
    console.warn('⚠️ No question types selected, defaulting to QCM');
    activeTypes.push(['qcm', true]);
  }

  // Generate questions for each active type
  for (const [type] of activeTypes) {
    const sharedOptions = {
      enableSemanticValidation: options?.enableSemanticValidation,
      facts: preExtractedFacts,
      quizConfig,
    };

    let questions: any[] = [];

    switch (type) {
      case 'qcm':
        questions = await generateConceptChapterQuestions(
          chapterMetadata,
          chapterText,
          language,
          sharedOptions
        );
        break;
      case 'vrai_faux':
        questions = await generateTrueFalseQuestions(
          chapterMetadata,
          chapterText,
          language,
          sharedOptions
        );
        break;
      case 'texte_trous':
        questions = await generateFillBlankQuestions(
          chapterMetadata,
          chapterText,
          language,
          sharedOptions
        );
        break;
    }

    allQuestions.push(...questions);
  }

  // Shuffle all questions together
  const shuffledQuestions = shuffleArray(allQuestions);

  console.log(`✅ Mixed quiz complete: ${shuffledQuestions.length} questions from ${activeTypes.length} type(s)`);
  return shuffledQuestions;
}
