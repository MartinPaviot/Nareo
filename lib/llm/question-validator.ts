/**
 * Question Validator
 *
 * Validates LLM-generated questions to ensure quality and correctness
 * before they are stored in the database.
 */

export interface MCQQuestion {
  type?: string;
  prompt?: string;
  question?: string;
  options?: string[];
  correct_option_index?: number;
  correctAnswer?: string;
  explanation?: string;
  concept_ids?: string[];
  points?: number;
  phase?: string;
  questionNumber?: number;
  // New fields for improved quality tracking
  source_reference?: string;      // Exact quote from source text supporting the answer
  cognitive_level?: 'remember' | 'understand' | 'apply';  // Bloom's taxonomy level
  concept_tested?: string;        // Which concept/learning objective this tests
  // Fields for true/false questions
  statement?: string;             // Statement for true/false questions
  correct_answer?: boolean;       // Boolean answer for true/false questions
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  fixedQuestion?: MCQQuestion;
}

/**
 * Normalize a question to a standard format
 */
export function normalizeQuestion(q: MCQQuestion): MCQQuestion {
  return {
    type: q.type || 'mcq',
    prompt: q.prompt || q.question || '',
    options: q.options || [],
    correct_option_index: q.correct_option_index,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || '',
    concept_ids: q.concept_ids || [],
    points: q.points || 10,
    phase: q.phase || 'mcq',
    questionNumber: q.questionNumber,
    // New quality fields
    source_reference: q.source_reference || undefined,
    cognitive_level: q.cognitive_level || undefined,
    concept_tested: q.concept_tested || undefined,
  };
}

/**
 * Validate a single MCQ question
 */
export function validateMCQQuestion(q: MCQQuestion, existingQuestions: MCQQuestion[] = []): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const normalized = normalizeQuestion(q);

  // 1. Check that prompt exists and has minimum length
  const questionText = normalized.prompt || '';
  if (!questionText || questionText.length < 10) {
    errors.push({
      field: 'prompt',
      message: `Question text too short (${questionText.length} chars). Minimum: 10 characters.`,
      severity: 'error',
    });
  }

  // 2. Check that we have exactly 4 options
  const options = normalized.options || [];
  if (options.length !== 4) {
    errors.push({
      field: 'options',
      message: `Expected 4 options, got ${options.length}.`,
      severity: 'error',
    });
  }

  // 3. Check that all options are non-empty
  const emptyOptions = options.filter((opt, idx) => !opt || opt.trim().length === 0);
  if (emptyOptions.length > 0) {
    errors.push({
      field: 'options',
      message: `${emptyOptions.length} empty option(s) found.`,
      severity: 'error',
    });
  }

  // 4. Check that options are unique
  const uniqueOptions = new Set(options.map(o => o?.toLowerCase().trim()));
  if (uniqueOptions.size !== options.length) {
    errors.push({
      field: 'options',
      message: 'Duplicate options detected.',
      severity: 'error',
    });
  }

  // 5. Check correct_option_index is valid
  let correctIndex = normalized.correct_option_index;

  // Try to derive from correctAnswer if index is missing
  if (correctIndex === undefined || correctIndex === null) {
    const correctAnswerLetter = normalized.correctAnswer?.toUpperCase().trim();
    if (correctAnswerLetter && /^[A-D]$/.test(correctAnswerLetter)) {
      correctIndex = correctAnswerLetter.charCodeAt(0) - 65;
    }
  }

  if (correctIndex === undefined || correctIndex < 0 || correctIndex > 3) {
    errors.push({
      field: 'correct_option_index',
      message: `Invalid correct option index: ${correctIndex}. Must be 0-3.`,
      severity: 'error',
    });
  }

  // 6. Check for duplicate questions (similarity check)
  const isDuplicate = existingQuestions.some(existing => {
    const existingText = (existing.prompt || existing.question || '').toLowerCase().trim();
    const currentText = questionText.toLowerCase().trim();

    // Exact match
    if (existingText === currentText) return true;

    // High similarity (Jaccard coefficient > 0.8)
    const similarity = calculateSimilarity(existingText, currentText);
    return similarity > 0.8;
  });

  if (isDuplicate) {
    warnings.push({
      field: 'prompt',
      message: 'Question appears to be a duplicate or very similar to an existing question.',
      severity: 'warning',
    });
  }

  // 7. Check explanation exists
  if (!normalized.explanation || normalized.explanation.length < 10) {
    warnings.push({
      field: 'explanation',
      message: 'Missing or too short explanation.',
      severity: 'warning',
    });
  }

  // 7b. Check source_reference exists and is meaningful (new quality requirement)
  if (!normalized.source_reference || normalized.source_reference.length < 15) {
    warnings.push({
      field: 'source_reference',
      message: 'Missing or too short source reference. Questions should cite the source text.',
      severity: 'warning',
    });
  } else if (normalized.source_reference.length > 300) {
    warnings.push({
      field: 'source_reference',
      message: 'Source reference is too long. Keep it concise (15-100 words).',
      severity: 'warning',
    });
  }

  // 7c. Check cognitive_level is valid
  if (normalized.cognitive_level &&
      !['remember', 'understand', 'apply'].includes(normalized.cognitive_level)) {
    warnings.push({
      field: 'cognitive_level',
      message: `Invalid cognitive level: ${normalized.cognitive_level}. Must be remember, understand, or apply.`,
      severity: 'warning',
    });
  }

  // 8. Check options aren't too similar to each other
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      const similarity = calculateSimilarity(options[i] || '', options[j] || '');
      if (similarity > 0.85) {
        warnings.push({
          field: 'options',
          message: `Options ${i + 1} and ${j + 1} are very similar (${Math.round(similarity * 100)}%).`,
          severity: 'warning',
        });
      }
    }
  }

  // 9. Check for ambiguous question patterns (questions that might have multiple valid answers)
  const ambiguousPatterns = detectAmbiguousPatterns(questionText, options);
  if (ambiguousPatterns.length > 0) {
    warnings.push({
      field: 'prompt',
      message: `Potentially ambiguous question: ${ambiguousPatterns.join('; ')}`,
      severity: 'warning',
    });
  }

  // Build fixed question if there are fixable issues
  let fixedQuestion: MCQQuestion | undefined;
  if (errors.length > 0 || correctIndex !== normalized.correct_option_index) {
    fixedQuestion = {
      ...normalized,
      correct_option_index: correctIndex ?? 0,
    };

    // Fix options count if needed
    if (options.length < 4) {
      const defaultOptions = ['Option A', 'Option B', 'Option C', 'Option D'];
      fixedQuestion.options = [
        ...options,
        ...defaultOptions.slice(options.length),
      ].slice(0, 4);
    } else if (options.length > 4) {
      fixedQuestion.options = options.slice(0, 4);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fixedQuestion,
  };
}

/**
 * Validate a batch of questions
 */
export function validateQuestionBatch(questions: MCQQuestion[]): {
  valid: MCQQuestion[];
  invalid: { question: MCQQuestion; result: ValidationResult }[];
  stats: {
    total: number;
    valid: number;
    fixed: number;
    rejected: number;
    duplicatesRemoved: number;
  };
} {
  const valid: MCQQuestion[] = [];
  const invalid: { question: MCQQuestion; result: ValidationResult }[] = [];
  let fixed = 0;
  let duplicatesRemoved = 0;

  for (const question of questions) {
    const result = validateMCQQuestion(question, valid);

    if (result.isValid) {
      // Check if it's a duplicate of an already validated question
      const isDupe = result.warnings.some(w => w.message.includes('duplicate'));
      if (isDupe) {
        duplicatesRemoved++;
        continue;
      }
      valid.push(normalizeQuestion(question));
    } else if (result.fixedQuestion) {
      // Try the fixed version
      const fixedResult = validateMCQQuestion(result.fixedQuestion, valid);
      if (fixedResult.isValid) {
        valid.push(result.fixedQuestion);
        fixed++;
      } else {
        invalid.push({ question, result });
      }
    } else {
      invalid.push({ question, result });
    }
  }

  return {
    valid,
    invalid,
    stats: {
      total: questions.length,
      valid: valid.length,
      fixed,
      rejected: invalid.length,
      duplicatesRemoved,
    },
  };
}

/**
 * Detect patterns that suggest a question might be ambiguous
 * (i.e., multiple options could be considered correct)
 * Phase 1: Added FR/DE patterns for multilingual support
 */
function detectAmbiguousPatterns(questionText: string, options: string[]): string[] {
  const issues: string[] = [];
  const lowerQuestion = questionText.toLowerCase();
  const lowerOptions = options.map(o => (o || '').toLowerCase());

  // Pattern 1: Question asks "which" without specifying "which ONE" or "which BEST"
  // Phase 1: Added French and German equivalents
  const vaguePhrases = [
    // English
    /^which\s+(?!one|best|primary|main|most)/i,
    /^what\s+(?!is the main|is the primary|best)/i,
    // French - "Lequel/Laquelle/Quel/Quelle" without "principal/meilleur/unique"
    /^(?:le)?quel(?:le)?s?\s+(?!.*(?:principal|meilleur|unique|seul|premier))/i,
    /^qu(?:'|e\s)(?!.*(?:principal|meilleur|unique|seul))/i,
    // German - "Welche/Welcher/Welches" without "hauptsächlich/beste/einzige"
    /^welche[rsmn]?\s+(?!.*(?:hauptsächlich|beste|einzige|wichtigste|erste))/i,
    /^was\s+(?!.*(?:hauptsächlich|wichtigste|beste))/i,
  ];

  const hasVaguePhrase = vaguePhrases.some(pattern => pattern.test(questionText));
  if (hasVaguePhrase) {
    // Check if multiple options could plausibly answer the question
    const questionKeywords = extractKeywords(lowerQuestion);
    let matchingOptions = 0;

    for (const option of lowerOptions) {
      const optionKeywords = extractKeywords(option);
      const overlap = questionKeywords.filter(kw => optionKeywords.includes(kw) || option.includes(kw)).length;
      if (overlap > 0) {
        matchingOptions++;
      }
    }

    if (matchingOptions > 2) {
      issues.push('Question phrasing may allow multiple valid answers');
    }
  }

  // Pattern 2: Options that are conceptually similar categories
  // Phase 1: Added French and German category terms
  const categoryTerms = [
    // English
    'hypothesis', 'theory', 'approach', 'method', 'model', 'type', 'factor', 'reason',
    // French
    'hypothèse', 'théorie', 'approche', 'méthode', 'modèle', 'facteur', 'raison', 'principe',
    // German
    'hypothese', 'theorie', 'ansatz', 'methode', 'modell', 'faktor', 'grund', 'prinzip',
  ];
  const optionsWithCategory = lowerOptions.filter(opt =>
    categoryTerms.some(term => opt.includes(term))
  );

  if (optionsWithCategory.length >= 3 &&
      (lowerQuestion.includes('which') || lowerQuestion.includes('what') ||
       lowerQuestion.includes('quel') || lowerQuestion.includes('welch'))) {
    // Check if the question is asking about a category without disambiguation
    // Phase 1: Added FR/DE disambiguators
    const hasDisambiguator = /\b(primary|main|first|best|most important|only|principal|meilleur|unique|seul|premier|hauptsächlich|beste|einzige|wichtigste|erste)\b/i.test(questionText);
    if (!hasDisambiguator) {
      issues.push('Multiple categorical options without clear disambiguation');
    }
  }

  // Pattern 3: Question contains "or" suggesting multiple valid items
  // Phase 1: Added FR/DE conjunctions
  if (/\b(and|or|both|et|ou|les deux|und|oder|beide)\b/.test(lowerQuestion) &&
      !/(true or false|yes or no|either.*or|vrai ou faux|oui ou non|wahr oder falsch|ja oder nein)/i.test(lowerQuestion)) {
    issues.push('Question mentions multiple items that might all be valid');
  }

  // Pattern 4: Question asks to memorize a calculation result (bad pedagogy)
  // Questions like "What is the WACC?" with answer "8.5%" are useless
  const calculationTerms = [
    // English
    'wacc', 'npv', 'irr', 'roi', 'ebitda', 'eps', 'p/e', 'roe', 'roa', 'capm',
    'cost of capital', 'cost of equity', 'cost of debt', 'beta', 'discount rate',
    'present value', 'future value', 'net present value', 'internal rate',
    // French
    'cmpc', 'van', 'tri', 'rsi', 'bna', 'per', 'valeur actuelle', 'valeur future',
    'taux d\'actualisation', 'coût du capital', 'coût des fonds propres',
    // German
    'kapitalkosten', 'barwert', 'kapitalwert', 'rendite', 'abzinsungssatz',
  ];

  const numericalPatterns = [
    /^\d+([.,]\d+)?%$/,           // "8.5%", "10%"
    /^\$?\d+([.,]\d+)?[MBK]?$/i,  // "$1.2M", "500K", "1.5B"
    /^€?\d+([.,]\d+)?[MBK]?$/i,   // "€1.2M"
    /^\d+([.,]\d+)?$/,            // Plain numbers "0.85", "1.5"
  ];

  const questionAsksCalculationResult = calculationTerms.some(term =>
    lowerQuestion.includes(term)
  );

  if (questionAsksCalculationResult) {
    // Check if the correct answer is just a number/percentage (memorization)
    const correctOption = lowerOptions[0]; // We don't have the correct index here, check all
    const hasNumericalAnswer = lowerOptions.some(opt =>
      numericalPatterns.some(pattern => pattern.test(opt.trim()))
    );

    // If all/most options are numerical values, it's likely asking to memorize a result
    const numericalOptionsCount = lowerOptions.filter(opt =>
      numericalPatterns.some(pattern => pattern.test(opt.trim())) ||
      /^\d/.test(opt.trim()) // Starts with a digit
    ).length;

    if (numericalOptionsCount >= 3) {
      issues.push('Question asks to memorize a calculation result instead of testing understanding');
    }
  }

  // Pattern 5: Options that are synonyms or near-synonyms
  // Phase 1: Added FR/DE synonym groups
  const synonymGroups = [
    // English
    ['increase', 'rise', 'grow', 'expand'],
    ['decrease', 'fall', 'decline', 'reduce'],
    ['economic', 'financial', 'monetary'],
    ['behavioral', 'psychological', 'cognitive'],
    // French
    ['augmenter', 'croître', 'hausser', 'accroître'],
    ['diminuer', 'baisser', 'réduire', 'décroître'],
    ['économique', 'financier', 'monétaire'],
    ['comportemental', 'psychologique', 'cognitif'],
    // German
    ['erhöhen', 'steigen', 'wachsen', 'zunehmen'],
    ['verringern', 'sinken', 'reduzieren', 'abnehmen'],
    ['wirtschaftlich', 'finanziell', 'monetär'],
    ['verhaltensbezogen', 'psychologisch', 'kognitiv'],
  ];

  for (const synonyms of synonymGroups) {
    const matchingOptions = lowerOptions.filter(opt =>
      synonyms.some(syn => opt.includes(syn))
    );
    if (matchingOptions.length >= 2) {
      issues.push('Options may contain synonymous concepts');
      break;
    }
  }

  // Pattern 6: Option reveals answer by starting with the asked term
  // Example: Question "What is the formula for FCFF?" with option "FCFF = ..." gives away the answer
  // The correct option should just show the formula without the variable name prefix
  const formulaTerms = [
    // Finance formulas
    'fcff', 'fcfe', 'wacc', 'capm', 'npv', 'irr', 'ebitda', 'ebit', 'eps', 'roe', 'roa',
    'van', 'tri', 'cmpc', 'bna', // French equivalents
    'kapitalwert', 'rendite', // German equivalents
    // General terms that might be asked as formulas
    'beta', 'alpha', 'sigma', 'delta', 'gamma',
  ];

  // Check if question asks for a formula/definition of a specific term
  const formulaQuestionPattern = /(?:formula|formule|formel|équation|equation|définition|definition|calculate|calculer|berechnen)\s+(?:for|of|de|du|des|für|von)?\s*(?:the\s+)?(\w+)/i;
  const formulaMatch = lowerQuestion.match(formulaQuestionPattern);

  if (formulaMatch) {
    const askedTerm = formulaMatch[1]?.toLowerCase();

    // Also check if any known formula term is in the question
    const askedFormulaTerm = formulaTerms.find(term =>
      lowerQuestion.includes(term) ||
      (askedTerm && askedTerm.includes(term))
    );

    if (askedFormulaTerm) {
      // Check if any option starts with the asked term followed by "="
      const revealingOptionPattern = new RegExp(`^\\s*${askedFormulaTerm}\\s*=`, 'i');
      const hasRevealingOption = options.some(opt => revealingOptionPattern.test(opt));

      if (hasRevealingOption) {
        issues.push(`Option reveals answer by starting with "${askedFormulaTerm.toUpperCase()} =" - remove the variable name prefix from formula options`);
      }
    }
  }

  // Also catch simpler patterns like "What is FCFF?" where options have "FCFF = ..."
  for (const term of formulaTerms) {
    if (lowerQuestion.includes(term)) {
      const revealingPattern = new RegExp(`^\\s*${term}\\s*=`, 'i');
      const hasRevealingOption = options.some(opt => revealingPattern.test(opt));

      if (hasRevealingOption) {
        // Check that at least 2 other options don't start with their formula name
        // (to avoid false positives when all options are properly formatted)
        const nonRevealingOptions = options.filter(opt => {
          return !formulaTerms.some(t => new RegExp(`^\\s*${t}\\s*=`, 'i').test(opt));
        });

        if (nonRevealingOptions.length >= 2) {
          issues.push(`Option starting with "${term.toUpperCase()} =" reveals the answer - use formula only without the variable prefix`);
          break;
        }
      }
    }
  }

  return issues;
}

/**
 * Extract meaningful keywords from text
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'under', 'again', 'further', 'then', 'once', 'here',
    'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
    'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'which', 'what', 'who', 'whom', 'this', 'that', 'these', 'those',
  ]);

  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .map(word => word.replace(/[^a-z]/g, ''))
    .filter(word => word.length > 3);
}

/**
 * Calculate Jaccard similarity between two strings
 */
function calculateSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const set2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

/**
 * Deduplicate questions based on similarity
 */
export function deduplicateQuestions(questions: MCQQuestion[], threshold: number = 0.8): MCQQuestion[] {
  const unique: MCQQuestion[] = [];

  for (const question of questions) {
    const questionText = (question.prompt || question.question || '').toLowerCase().trim();

    const isDuplicate = unique.some(existing => {
      const existingText = (existing.prompt || existing.question || '').toLowerCase().trim();
      return calculateSimilarity(questionText, existingText) > threshold;
    });

    if (!isDuplicate) {
      unique.push(question);
    }
  }

  return unique;
}

/**
 * Course-level question deduplication tracker
 * Maintains a cache of all questions generated for a course to detect cross-chapter duplicates
 */
export class CourseDeduplicationTracker {
  private questionTexts: Map<string, { chapterIndex: number; questionText: string }> = new Map();
  private threshold: number;

  constructor(threshold: number = 0.65) {
    this.threshold = threshold;
  }

  /**
   * Check if a question is a duplicate of any previously added question
   * Returns the chapter index where the duplicate was found, or -1 if not a duplicate
   */
  isDuplicate(questionText: string): { isDuplicate: boolean; duplicateOfChapter?: number; similarity?: number } {
    const normalizedText = questionText.toLowerCase().trim();

    for (const [id, existing] of this.questionTexts.entries()) {
      const similarity = calculateSimilarity(normalizedText, existing.questionText);
      if (similarity > this.threshold) {
        return {
          isDuplicate: true,
          duplicateOfChapter: existing.chapterIndex,
          similarity,
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Add a question to the tracker
   */
  addQuestion(questionId: string, questionText: string, chapterIndex: number): void {
    this.questionTexts.set(questionId, {
      chapterIndex,
      questionText: questionText.toLowerCase().trim(),
    });
  }

  /**
   * Filter questions, removing cross-chapter duplicates
   * Returns the filtered questions and stats about removed duplicates
   */
  filterQuestions(
    questions: MCQQuestion[],
    chapterIndex: number
  ): {
    filtered: MCQQuestion[];
    duplicatesRemoved: number;
    duplicateDetails: Array<{ question: string; duplicateOfChapter: number; similarity: number }>;
  } {
    const filtered: MCQQuestion[] = [];
    const duplicateDetails: Array<{ question: string; duplicateOfChapter: number; similarity: number }> = [];

    for (const question of questions) {
      const questionText = question.prompt || question.question || '';
      const check = this.isDuplicate(questionText);

      if (check.isDuplicate) {
        duplicateDetails.push({
          question: questionText.substring(0, 80) + '...',
          duplicateOfChapter: check.duplicateOfChapter!,
          similarity: check.similarity!,
        });
      } else {
        // Add to tracker and keep the question
        const questionId = `ch${chapterIndex}_q${filtered.length}`;
        this.addQuestion(questionId, questionText, chapterIndex);
        filtered.push(question);
      }
    }

    return {
      filtered,
      duplicatesRemoved: questions.length - filtered.length,
      duplicateDetails,
    };
  }

  /**
   * Get stats about the tracker
   */
  getStats(): { totalQuestions: number; questionsByChapter: Map<number, number> } {
    const questionsByChapter = new Map<number, number>();

    for (const entry of this.questionTexts.values()) {
      const current = questionsByChapter.get(entry.chapterIndex) || 0;
      questionsByChapter.set(entry.chapterIndex, current + 1);
    }

    return {
      totalQuestions: this.questionTexts.size,
      questionsByChapter,
    };
  }

  /**
   * Clear the tracker (for reuse)
   */
  clear(): void {
    this.questionTexts.clear();
  }
}

/**
 * ============================================================================
 * ADMINISTRATIVE CONTENT FILTER
 * ============================================================================
 * Filters out questions about course logistics, exam format, materials, etc.
 * These questions test memorization of course structure, not academic content.
 */

// Keywords that indicate administrative/logistics content (case-insensitive)
const ADMIN_KEYWORDS_FR = [
  // Exam/Assessment structure
  'examen final', 'examen partiel', 'durée de l\'examen', 'durée totale',
  'parties de l\'examen', 'nombre de parties', 'format de l\'examen',
  'barème', 'notation', 'coefficient', 'note finale', 'points bonus',
  'évaluation continue', 'contrôle continu',

  // Course structure
  'séance', 'séances', 'travaux dirigés', 'travaux pratiques', 'td', 'tp',
  'première partie de chaque', 'deuxième partie de chaque',
  'structure du cours', 'organisation du cours', 'déroulement du cours',
  'objectif principal du cours', 'objectif du cours', 'objectifs du cours',
  'activités pédagogiques', 'méthode pédagogique', 'méthodes utilisées',

  // Materials
  'support de cours', 'supports de cours', 'diapositives', 'polycopié',
  'ressources du cours', 'ressources mentionnées', 'matériel fourni',
  'manuel recommandé', 'bibliographie', 'lectures obligatoires',

  // Schedule/Timing
  'horaire', 'emploi du temps', 'calendrier', 'semestre', 'trimestre',
  'nombre d\'heures', 'heures de cours', 'crédits ects',

  // Administrative
  'professeur', 'enseignant', 'assistant', 'chargé de td',
  'inscription', 'prérequis administratif', 'bureau', 'contact',
];

const ADMIN_KEYWORDS_EN = [
  // Exam/Assessment structure
  'final exam', 'midterm exam', 'exam duration', 'total duration',
  'exam parts', 'number of parts', 'exam format', 'grading policy',
  'grading scale', 'grade breakdown', 'bonus points', 'continuous assessment',

  // Course structure
  'lecture session', 'lab session', 'tutorial session', 'recitation',
  'first part of each', 'second part of each', 'course structure',
  'course organization', 'main objective of the course', 'course objective',
  'course objectives', 'teaching methods', 'pedagogical activities',

  // Materials
  'course materials', 'lecture slides', 'handouts', 'course resources',
  'resources mentioned', 'required textbook', 'recommended reading',
  'bibliography', 'required readings',

  // Schedule/Timing
  'class schedule', 'course calendar', 'semester', 'quarter',
  'credit hours', 'ects credits',

  // Administrative
  'professor', 'instructor', 'teaching assistant',
  'enrollment', 'prerequisites administrative', 'office hours', 'contact info',
];

const ADMIN_KEYWORDS_DE = [
  // Exam/Assessment structure
  'abschlussprüfung', 'zwischenprüfung', 'prüfungsdauer', 'gesamtdauer',
  'prüfungsteile', 'anzahl der teile', 'prüfungsformat', 'bewertungsschema',
  'notenverteilung', 'bonuspunkte', 'fortlaufende bewertung',

  // Course structure
  'vorlesung', 'übung', 'seminar', 'praktikum',
  'kursstruktur', 'kursorganisation', 'hauptziel des kurses',
  'kursziele', 'lehrmethoden', 'pädagogische aktivitäten',

  // Materials
  'kursmaterialien', 'vorlesungsfolien', 'handouts', 'kursressourcen',
  'empfohlenes lehrbuch', 'pflichtlektüre', 'literaturverzeichnis',

  // Schedule/Timing
  'stundenplan', 'kurskalender', 'semester', 'ects-punkte',

  // Administrative
  'dozent', 'professor', 'tutor', 'einschreibung', 'sprechstunden',
];

// Patterns that strongly indicate administrative content
const ADMIN_PATTERNS = [
  // Exam structure questions
  /combien de parties?\s+(?:compose|comporte|comprend)/i,
  /quelle est la durée/i,
  /quel(?:le)? est (?:l[''])?(?:objectif|but) (?:principal )?du cours/i,
  /quels sont les objectifs du cours/i,

  // Course logistics
  /(?:première|seconde|deuxième|dernière) partie de (?:chaque|la) séance/i,
  /méthodes? utilisée?s? dans (?:les|le) (?:cours|td|travaux)/i,
  /ressources? mentionnée?s? (?:pour|dans)/i,
  /comment (?:est|sont) (?:organisé|structuré)/i,

  // English patterns
  /how many parts does the exam/i,
  /what is the duration of/i,
  /what is the (?:main )?objective of (?:the|this) course/i,
  /what are the course objectives/i,
  /methods? used in (?:the )?(?:course|lectures|tutorials)/i,
  /resources mentioned (?:for|in)/i,

  // German patterns
  /wie viele teile hat die prüfung/i,
  /wie lange dauert/i,
  /was ist das (?:haupt)?ziel des kurses/i,
];

/**
 * Check if a question is about administrative/logistics content
 * Returns true if the question should be FILTERED OUT (is administrative)
 */
export function isAdministrativeQuestion(questionText: string): {
  isAdmin: boolean;
  reason?: string;
  matchedKeyword?: string;
} {
  const lowerText = questionText.toLowerCase();

  // Check patterns first (strongest signal)
  for (const pattern of ADMIN_PATTERNS) {
    if (pattern.test(lowerText)) {
      return {
        isAdmin: true,
        reason: 'Matches administrative pattern',
        matchedKeyword: pattern.source
      };
    }
  }

  // Check French keywords
  for (const keyword of ADMIN_KEYWORDS_FR) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return {
        isAdmin: true,
        reason: 'Contains French administrative keyword',
        matchedKeyword: keyword
      };
    }
  }

  // Check English keywords
  for (const keyword of ADMIN_KEYWORDS_EN) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return {
        isAdmin: true,
        reason: 'Contains English administrative keyword',
        matchedKeyword: keyword
      };
    }
  }

  // Check German keywords
  for (const keyword of ADMIN_KEYWORDS_DE) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return {
        isAdmin: true,
        reason: 'Contains German administrative keyword',
        matchedKeyword: keyword
      };
    }
  }

  return { isAdmin: false };
}

/**
 * Filter out administrative questions from a batch
 * Returns only questions about actual academic content
 */
export function filterAdministrativeQuestions(
  questions: MCQQuestion[]
): {
  filtered: MCQQuestion[];
  removed: Array<{ question: string; reason: string; keyword?: string }>;
  stats: { total: number; kept: number; removed: number };
} {
  const filtered: MCQQuestion[] = [];
  const removed: Array<{ question: string; reason: string; keyword?: string }> = [];

  for (const question of questions) {
    const questionText = question.prompt || question.question || '';
    const check = isAdministrativeQuestion(questionText);

    if (check.isAdmin) {
      removed.push({
        question: questionText.substring(0, 100) + (questionText.length > 100 ? '...' : ''),
        reason: check.reason || 'Administrative content',
        keyword: check.matchedKeyword,
      });
    } else {
      filtered.push(question);
    }
  }

  return {
    filtered,
    removed,
    stats: {
      total: questions.length,
      kept: filtered.length,
      removed: removed.length,
    },
  };
}

/**
 * Check coverage of concepts by questions
 */
export function checkConceptCoverage(
  questions: MCQQuestion[],
  conceptIds: string[]
): {
  coverage: number;
  coveredConcepts: string[];
  uncoveredConcepts: string[];
  conceptQuestionCount: Map<string, number>;
} {
  const conceptQuestionCount = new Map<string, number>();

  // Initialize all concepts with 0
  for (const id of conceptIds) {
    conceptQuestionCount.set(id, 0);
  }

  // Count questions per concept
  for (const question of questions) {
    const ids = question.concept_ids || [];
    for (const id of ids) {
      if (conceptQuestionCount.has(id)) {
        conceptQuestionCount.set(id, (conceptQuestionCount.get(id) || 0) + 1);
      }
    }
  }

  const coveredConcepts = conceptIds.filter(id => (conceptQuestionCount.get(id) || 0) > 0);
  const uncoveredConcepts = conceptIds.filter(id => (conceptQuestionCount.get(id) || 0) === 0);

  return {
    coverage: conceptIds.length > 0 ? coveredConcepts.length / conceptIds.length : 1,
    coveredConcepts,
    uncoveredConcepts,
    conceptQuestionCount,
  };
}
