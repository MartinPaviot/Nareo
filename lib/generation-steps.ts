/**
 * Generation Steps - Constants and types for progressive loading UI
 *
 * This module defines the steps shown during content generation
 * with their associated progress percentages and translation keys.
 */

export type GenerationStepKey =
  | 'analyzing_document'
  | 'extracting_chapter'
  | 'identifying_concepts'
  | 'generating_content'
  | 'verifying_content'
  | 'saving_content'
  | 'finalizing';

export interface GenerationStep {
  key: GenerationStepKey;
  translationKey: string;
  minProgress: number;
  maxProgress: number;
}

/**
 * Quiz generation steps
 */
export const QUIZ_GENERATION_STEPS: GenerationStep[] = [
  { key: 'analyzing_document', translationKey: 'gen_step_analyzing_document', minProgress: 0, maxProgress: 5 },
  { key: 'extracting_chapter', translationKey: 'gen_step_extracting_chapter', minProgress: 5, maxProgress: 10 },
  { key: 'identifying_concepts', translationKey: 'gen_step_identifying_concepts', minProgress: 10, maxProgress: 15 },
  { key: 'generating_content', translationKey: 'gen_step_generating_questions', minProgress: 15, maxProgress: 85 },
  { key: 'verifying_content', translationKey: 'gen_step_verifying_duplicates', minProgress: 85, maxProgress: 95 },
  { key: 'finalizing', translationKey: 'gen_step_finalizing', minProgress: 95, maxProgress: 100 },
];

/**
 * Flashcard generation steps
 */
export const FLASHCARD_GENERATION_STEPS: GenerationStep[] = [
  { key: 'analyzing_document', translationKey: 'gen_step_analyzing_document', minProgress: 0, maxProgress: 10 },
  { key: 'identifying_concepts', translationKey: 'gen_step_identifying_concepts', minProgress: 10, maxProgress: 20 },
  { key: 'generating_content', translationKey: 'gen_step_generating_flashcards', minProgress: 20, maxProgress: 90 },
  { key: 'saving_content', translationKey: 'gen_step_saving_flashcards', minProgress: 90, maxProgress: 100 },
];

/**
 * Note (A+ Note) generation steps
 */
export const NOTE_GENERATION_STEPS: GenerationStep[] = [
  { key: 'analyzing_document', translationKey: 'gen_step_analyzing_structure', minProgress: 0, maxProgress: 15 },
  { key: 'extracting_chapter', translationKey: 'gen_step_transcribing_sections', minProgress: 15, maxProgress: 70 },
  { key: 'verifying_content', translationKey: 'gen_step_verifying_completeness', minProgress: 70, maxProgress: 80 },
  { key: 'generating_content', translationKey: 'gen_step_generating_glossary', minProgress: 80, maxProgress: 95 },
  { key: 'finalizing', translationKey: 'gen_step_saving_note', minProgress: 95, maxProgress: 100 },
];

/**
 * Get the current step based on progress percentage
 */
export function getCurrentStep(steps: GenerationStep[], progress: number): GenerationStep | null {
  for (const step of steps) {
    if (progress >= step.minProgress && progress < step.maxProgress) {
      return step;
    }
  }
  // Return last step if progress is 100
  if (progress >= 100 && steps.length > 0) {
    return steps[steps.length - 1];
  }
  return steps[0] || null;
}

/**
 * Get completed steps based on current progress
 */
export function getCompletedSteps(steps: GenerationStep[], progress: number): GenerationStep[] {
  return steps.filter(step => progress >= step.maxProgress);
}

/**
 * Get pending steps based on current progress
 */
export function getPendingSteps(steps: GenerationStep[], progress: number): GenerationStep[] {
  return steps.filter(step => progress < step.minProgress);
}

/**
 * SSE Event types for streaming
 */
export type SSEEventType =
  | 'progress'      // Progress update with percentage
  | 'step'          // Step change notification
  | 'question'      // Individual quiz question generated
  | 'flashcard'     // Individual flashcard generated
  | 'chunk'         // Text chunk for streaming content
  | 'complete'      // Generation complete
  | 'error';        // Error occurred

export interface SSEProgressEvent {
  type: 'progress';
  message: string;
  progress: number;
  step?: GenerationStepKey;
  chapterIndex?: number;
  totalChapters?: number;
  itemsGenerated?: number;
  totalItems?: number;
}

export interface SSEQuestionEvent {
  type: 'question';
  data: {
    chapterId: string;
    chapterTitle: string;
    question: {
      id: string;
      type: string;
      questionText: string;
      options: string[] | null;
      correctOptionIndex: number | null;
      answerText: string | null;
      explanation: string | null;
      questionNumber: number;
    };
  };
  questionsGenerated: number;
  progress: number;
}

export interface SSEFlashcardEvent {
  type: 'flashcard';
  data: {
    id: string;
    type: string;
    front: string;
    back: string;
  };
  cardsGenerated: number;
  totalCards?: number;
  progress: number;
}

export interface SSEChunkEvent {
  type: 'chunk';
  content: string;
  section?: string;
  sectionIndex?: number;
  totalSections?: number;
}

export interface SSECompleteEvent {
  type: 'complete';
  message?: string;
  progress: 100;
  content?: string;
  totalItems?: number;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

export type SSEEvent =
  | SSEProgressEvent
  | SSEQuestionEvent
  | SSEFlashcardEvent
  | SSEChunkEvent
  | SSECompleteEvent
  | SSEErrorEvent;

/**
 * Parse SSE event from raw string
 */
export function parseSSEEvent(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  try {
    const jsonStr = line.slice(6); // Remove 'data: ' prefix
    return JSON.parse(jsonStr) as SSEEvent;
  } catch {
    return null;
  }
}
