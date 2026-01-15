// ============================================================================
// TYPES POUR LA PERSONNALISATION DES QUIZ
// ============================================================================

/**
 * Niveau de quantité de questions
 * - synthetique: ~50% du standard, questions essentielles uniquement
 * - standard: 100%, couverture équilibrée (comportement actuel)
 * - exhaustif: ~150% du standard, couverture complète et détaillée
 */
export type NiveauQuantite = 'synthetique' | 'standard' | 'exhaustif';

/**
 * Mode de quiz
 * - chapter: Quiz par chapitre (comportement par défaut)
 * - global: Quiz mélangeant les questions de tous les chapitres
 */
export type QuizMode = 'chapter' | 'global';

/**
 * Types de questions disponibles
 */
export interface QuizTypesConfig {
  qcm: boolean;           // multiple_choice (existant)
  vrai_faux: boolean;     // true_false (nouveau)
  texte_trous: boolean;   // fill_blank (nouveau)
}

/**
 * Configuration du quiz
 */
export interface QuizConfig {
  niveau: NiveauQuantite;
  types: QuizTypesConfig;
  mode?: QuizMode;         // Mode de quiz (chapter par défaut)
  excludeSeen?: boolean;   // Exclure les questions déjà vues
}

/**
 * Configuration par défaut
 */
export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  niveau: 'standard',
  types: {
    qcm: true,
    vrai_faux: false,
    texte_trous: false,
  },
  mode: 'chapter',
  excludeSeen: false,
};

/**
 * Options UI pour le niveau de quantité (radio buttons)
 */
export const NIVEAU_QUANTITE_OPTIONS = [
  {
    value: 'synthetique' as const,
    label: 'Synthétique',
    icon: '⚡',
    description: '~5 questions par concept',
    multiplier: 0.5,
  },
  {
    value: 'standard' as const,
    label: 'Standard',
    icon: '📚',
    description: '~8 questions par concept',
    multiplier: 1.0,
  },
  {
    value: 'exhaustif' as const,
    label: 'Exhaustif',
    icon: '🎯',
    description: 'Maximum de questions',
    multiplier: 1.5,
  },
] as const;

/**
 * Options UI pour les types de questions (checkboxes)
 */
export const QUIZ_TYPES_OPTIONS = [
  {
    key: 'qcm' as const,
    label: 'QCM',
    description: '4 choix, 1 bonne réponse'
  },
  {
    key: 'vrai_faux' as const,
    label: 'Vrai / Faux',
    description: 'Affirmer ou infirmer une proposition'
  },
  {
    key: 'texte_trous' as const,
    label: 'Texte à trous',
    description: 'Compléter avec le terme exact'
  },
] as const;

/**
 * Calcule le nombre de questions ajusté selon le niveau
 * IMPORTANT: Les valeurs sont FIXES pour synthétique et standard
 * - Synthétique: TOUJOURS 5 questions par concept
 * - Standard: TOUJOURS 8 questions par concept
 * - Exhaustif: Au moins 12, ou plus si le contenu le permet
 */
export function getAdjustedQuestionCount(
  baseCount: number,
  niveau: NiveauQuantite
): number {
  // Valeurs FIXES pour synthétique et standard, adaptatives pour exhaustif
  switch (niveau) {
    case 'synthetique':
      return 5; // TOUJOURS 5 questions
    case 'standard':
      return 8; // TOUJOURS 8 questions
    case 'exhaustif':
      return Math.max(12, Math.round(baseCount * 1.5)); // Au moins 12, ou plus si le contenu le permet
    default:
      return 8;
  }
}

// ============================================================================
// TYPES DE QUESTIONS POUR LES RÉPONSES LLM
// ============================================================================

/**
 * Question QCM (existant)
 */
export interface MCQQuestionOutput {
  type: 'multiple_choice';
  prompt: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  source_reference: string;
  cognitive_level: 'remember' | 'understand' | 'apply';
  concept_tested: string;
}

/**
 * Question Vrai/Faux (nouveau)
 */
export interface TrueFalseQuestionOutput {
  type: 'true_false';
  statement: string;
  correct_answer: boolean;
  explanation: string;
  source_reference: string;
  cognitive_level: 'remember' | 'understand';
  concept_tested: string;
}

/**
 * Question Texte à trous (nouveau)
 */
export interface FillBlankQuestionOutput {
  type: 'fill_blank';
  sentence: string;
  correct_answer: string;
  accepted_answers: string[];
  explanation: string;
  source_reference: string;
  cognitive_level: 'remember' | 'understand';
  concept_tested: string;
}

/**
 * Union de tous les types de questions
 */
export type QuizQuestionOutput =
  | MCQQuestionOutput
  | TrueFalseQuestionOutput
  | FillBlankQuestionOutput;
