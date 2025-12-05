/**
 * LLM Utilities - Main Export
 *
 * Central module for all LLM-related utilities including:
 * - Retry with exponential backoff
 * - LRU Caching
 * - Question validation
 * - Circuit breaker pattern
 * - Contextual fallbacks
 * - Structured logging
 */

// Retry utilities
export {
  withRetry,
  makeRetryable,
  CRITICAL_RETRY_OPTIONS,
  FAST_RETRY_OPTIONS,
  type RetryOptions,
} from './retry';

// Cache utilities
export {
  LLMCache,
  withCache,
  makeCached,
  languageDetectionCache,
  translationCache,
  conceptExtractionCache,
  type CacheOptions,
} from './cache';

// Question validation
export {
  validateMCQQuestion,
  validateQuestionBatch,
  normalizeQuestion,
  deduplicateQuestions,
  checkConceptCoverage,
  CourseDeduplicationTracker,
  type MCQQuestion,
  type ValidationResult,
  type ValidationError,
} from './question-validator';

// Circuit breaker
export {
  CircuitBreaker,
  CircuitOpenError,
  withCircuitBreaker,
  openaiCircuitBreaker,
  openaiVisionCircuitBreaker,
  type CircuitState,
  type CircuitBreakerOptions,
} from './circuit-breaker';

// Contextual fallbacks
export {
  extractKeywords,
  extractSectionTitles,
  detectSubject,
  generateContextualConcepts,
  generateContextualChapters,
  generateContextualQuestions,
  type FallbackConcept,
  type FallbackChapter,
  type FallbackQuestion,
} from './contextual-fallback';

// Logging
export {
  llmLogger,
  LLMLogContext,
  withLogging,
  type LLMLogEntry,
  type LLMStats,
  type LLMLoggerOptions,
} from './logger';

// Text chunking
export {
  extractChapterText,
  equalDivisionChunking,
  type ChapterBoundary,
} from './text-chunking';

// Quality audit
export {
  auditQuestion,
  auditChapter,
  auditCourse,
  getQualityRating,
  type QuestionAudit,
  type ChapterAudit,
  type CourseAudit,
} from './quality-audit';

// Semantic validation (Phase 2)
export {
  extractVerifiableFacts,
  validateQuestionSemantically,
  validateQuestionBatchSemantically,
  generateQualityReport,
  type VerifiableFact,
  type SemanticValidationResult,
} from './semantic-validator';

// Document structure detection (real chapters)
export {
  detectDocumentStructure,
  detectStructureQuick,
  structureToChapters,
  type DetectedSection,
  type DocumentStructure,
} from './document-structure-detector';

// Configuration constants
export const LLM_CONFIG = {
  // Model selections
  // Cost optimization: Most tasks use gpt-4o-mini (~16x cheaper than gpt-4o)
  // Only vision/OCR requires gpt-4o (vision capabilities)
  models: {
    primary: 'gpt-4o',
    fast: 'gpt-4o-mini',
    vision: 'gpt-4o',
    // Fact extraction: gpt-4o-mini for cost savings
    factExtraction: 'gpt-4o-mini',
    // Chapter structuring: gpt-4o-mini (structured JSON output)
    structuring: 'gpt-4o-mini',
    // Question generation: gpt-4o-mini (validated by semantic validator)
    questionGeneration: 'gpt-4o-mini',
    // Answer evaluation: gpt-4o-mini (rule-based grading)
    evaluation: 'gpt-4o-mini',
  },

  // Optimized temperatures for each task type
  temperatures: {
    extraction: 0.2,      // Text/chapter extraction - very deterministic
    structuring: 0.3,     // Chapter/concept structuring
    questionGeneration: 0.3, // Question generation - lowered from 0.4 for more consistent output
    evaluation: 0.3,      // Answer evaluation - consistent scoring
    translation: 0.2,     // Translation - accurate
    languageDetection: 0,  // Language detection - deterministic
    conversation: 0.6,    // Nareo responses - more natural
  },

  // Max tokens by task
  maxTokens: {
    chapterStructure: 4000,
    conceptExtraction: 2500,
    questionGeneration: 3000,
    evaluation: 500,
    translation: 200,
    languageDetection: 100,
    conversation: 400,
    ocr: 3000,
  },

  // Text truncation limits
  truncation: {
    courseText: 30000,    // Increased from 20000 for better context
    chapterText: 8000,    // Increased from 6000 for richer questions
    sourceText: 2000,
    questionContext: 1000,
  },

  // Retry configuration
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
  },

  // Cache TTLs in milliseconds
  cacheTtl: {
    languageDetection: 7 * 24 * 60 * 60 * 1000, // 7 days
    translation: 30 * 24 * 60 * 60 * 1000,      // 30 days
    conceptExtraction: 24 * 60 * 60 * 1000,     // 24 hours
  },
} as const;

/**
 * Helper to get model for a specific task
 */
export function getModelForTask(task: keyof typeof LLM_CONFIG.models): string {
  return LLM_CONFIG.models[task];
}

/**
 * Helper to get temperature for a specific task type
 */
export function getTemperatureForTask(
  task: keyof typeof LLM_CONFIG.temperatures
): number {
  return LLM_CONFIG.temperatures[task];
}

/**
 * Helper to get max tokens for a specific task
 */
export function getMaxTokensForTask(
  task: keyof typeof LLM_CONFIG.maxTokens
): number {
  return LLM_CONFIG.maxTokens[task];
}
