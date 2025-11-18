export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type PhaseType = 1 | 2 | 3;
export type BadgeType = 'bronze' | 'silver' | 'gold' | null;
export type QuestionType = 'mcq' | 'open';
export type PhaseNameType = 'mcq' | 'short' | 'reflective';

// ✅ MAPPING FRANÇAIS pour les types de questions (TOUJOURS utiliser ces labels)
export const QUESTION_TYPE_LABELS_FR: Record<PhaseNameType, string> = {
  'mcq': 'QCM',
  'short': 'Court',
  'reflective': 'Réflexion',
} as const;

export interface ConceptData {
  id: string;
  title: string;
  difficulty: DifficultyLevel;
  content: string;
  definitions: string[];
  keyIdeas: string[];
  orderIndex: number;
}

export interface PhaseProgress {
  phase: PhaseType;
  completed: boolean;
  score: number;
  maxScore: number;
}

export interface ConceptProgress {
  conceptId: string;
  phases: PhaseProgress[];
  totalScore: number;
  badge: BadgeType;
  completed: boolean;
  retryCount: number;
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short' | 'reflective';
  question: string;
  options?: string[]; // For MCQ only
  correctAnswer?: string; // For MCQ only
  phase: PhaseType;
}

export interface LearningPhase {
  phase: PhaseType;
  name: string;
  description: string;
  points: number;
  type: 'mcq' | 'short' | 'reflective';
}

// ✅ Phases d'apprentissage (labels en FRANÇAIS)
export const LEARNING_PHASES: LearningPhase[] = [
  {
    phase: 1,
    name: QUESTION_TYPE_LABELS_FR['mcq'], // 'QCM'
    description: 'Questions à choix multiples pour tester la compréhension de base',
    points: 10,
    type: 'mcq',
  },
  {
    phase: 2,
    name: QUESTION_TYPE_LABELS_FR['short'], // 'Court'
    description: 'Réponse courte pour expliquer avec vos propres mots',
    points: 35,
    type: 'short',
  },
  {
    phase: 3,
    name: QUESTION_TYPE_LABELS_FR['reflective'], // 'Réflexion'
    description: 'Réflexion ouverte sur l\'application dans le monde réel',
    points: 35,
    type: 'reflective',
  },
];

// New types for chapter-based learning with 5 questions per chapter
export interface ChapterQuestion {
  id: string;
  chapterId: string;
  questionNumber: number; // 1-5
  type: QuestionType; // 'mcq' for Q1-3, 'open' for Q4-5
  phase: PhaseNameType; // 'mcq' for Q1-3, 'short' for Q4, 'reflective' for Q5
  question: string;
  options?: string[]; // [A, B, C, D] for MCQ questions
  correctAnswer?: string; // Correct option letter (A, B, C, or D) for MCQ
  points: number; // 10 for MCQ, 35 for open-ended
}

export interface ChapterProgress {
  chapterId: string;
  currentQuestion: number; // 1-5
  questionsAnswered: number;
  score: number; // 0-100
  completed: boolean;
  answers: {
    questionId: string;
    questionNumber: number;
    answer: string;
    correct?: boolean;
    score: number;
    feedback?: string;
  }[];
}

export interface ChapterData {
  id: string;
  title: string; // Kept for backward compatibility
  summary: string; // Kept for backward compatibility
  englishTitle: string;
  englishDescription: string;
  frenchTitle: string;
  frenchDescription: string;
  difficulty: DifficultyLevel;
  orderIndex: number;
  questions: ChapterQuestion[]; // Exactly 5 questions
  sourceText?: string; // Original extracted text
}

// ✅ Helper pour obtenir les infos de phase d'une question (labels en FRANÇAIS)
export function getPhaseForQuestion(questionNumber: number): {
  phase: PhaseNameType;
  name: string; // Label français (QCM, Court, Réflexion)
  type: QuestionType;
  points: number;
} {
  if (questionNumber >= 1 && questionNumber <= 3) {
    return {
      phase: 'mcq',
      name: QUESTION_TYPE_LABELS_FR['mcq'], // "QCM"
      type: 'mcq',
      points: 10,
    };
  } else if (questionNumber === 4) {
    return {
      phase: 'short',
      name: QUESTION_TYPE_LABELS_FR['short'], // "Court"
      type: 'open',
      points: 35,
    };
  } else {
    return {
      phase: 'reflective',
      name: QUESTION_TYPE_LABELS_FR['reflective'], // "Réflexion"
      type: 'open',
      points: 35,
    };
  }
}
