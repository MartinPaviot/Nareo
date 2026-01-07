// ============================================================================
// TYPES POUR LA PERSONNALISATION DES FLASHCARDS (QUALITÉ ANKI)
// ============================================================================

/**
 * Niveau de quantité de flashcards
 * - essentiel: ~10 cartes, concepts clés uniquement
 * - complet: ~20 cartes, couverture équilibrée
 * - exhaustif: ~30 cartes, vocabulaire complet
 */
export type FlashcardNiveau = 'essentiel' | 'complet' | 'exhaustif';

/**
 * Types de cartes sélectionnables
 */
export type FlashcardCardType = 'definition' | 'question' | 'cloze';

/**
 * Configuration des types de cartes avec allocation en pourcentage
 */
export interface FlashcardTypeAllocation {
  definition: boolean;  // Définition/formule
  question: boolean;    // Question classique
  cloze: boolean;       // Texte à trou
}

/**
 * Allocation par défaut: 60% définition, 20% question, 20% cloze
 */
export const DEFAULT_TYPE_ALLOCATION: FlashcardTypeAllocation = {
  definition: true,
  question: true,
  cloze: true,
};

/**
 * Pourcentages d'allocation par type (total = 100%)
 */
export const TYPE_ALLOCATION_PERCENTAGES = {
  definition: 60,
  question: 20,
  cloze: 20,
} as const;

/**
 * Configuration des flashcards
 */
export interface FlashcardConfig {
  niveau: FlashcardNiveau;
  types: FlashcardTypeAllocation;
}

/**
 * Configuration par défaut
 */
export const DEFAULT_FLASHCARD_CONFIG: FlashcardConfig = {
  niveau: 'complet',
  types: DEFAULT_TYPE_ALLOCATION,
};

/**
 * Options UI pour le sélecteur de niveau
 */
export const FLASHCARD_NIVEAU_OPTIONS = [
  {
    value: 'essentiel' as const,
    label: 'Essentiel',
    icon: '⚡',
    description: 'Concepts clés uniquement',
    count: 10,
  },
  {
    value: 'complet' as const,
    label: 'Complet',
    icon: '📚',
    description: 'Couverture équilibrée',
    count: 20,
  },
  {
    value: 'exhaustif' as const,
    label: 'Exhaustif',
    icon: '🎯',
    description: 'Vocabulaire complet',
    count: 30,
  },
] as const;

/**
 * Nombre de cartes par niveau
 */
export const FLASHCARD_COUNT_BY_NIVEAU: Record<FlashcardNiveau, number> = {
  essentiel: 10,
  complet: 20,
  exhaustif: 30,
};

// ============================================================================
// TYPES DE CARTES ANKI
// ============================================================================

/**
 * Types de cartes générées
 */
export type FlashcardType = 'basic' | 'cloze' | 'reversed';

/**
 * Carte Basic (question → réponse)
 * Pour: définitions, faits simples, explications courtes
 */
export interface BasicCard {
  type: 'basic';
  front: string;
  back: string;
}

/**
 * Carte Cloze (texte à trous)
 * Pour: contexte, formules, relations, vocabulaire en contexte
 * Format Anki: "Le {{c1::WACC}} représente le coût moyen pondéré du capital."
 */
export interface ClozeCard {
  type: 'cloze';
  text: string;        // Texte complet avec {{c1::answer}}
  cloze_id: string;    // "c1"
  answer: string;      // Le mot/phrase caché
}

/**
 * Carte Reversed (bidirectionnelle)
 * Pour: acronymes, traductions, vocabulaire technique
 * Génère automatiquement 2 cartes: terme→définition ET définition→terme
 */
export interface ReversedCard {
  type: 'reversed';
  term: string;
  definition: string;
}

/**
 * Union de tous les types de cartes
 */
export type Flashcard = BasicCard | ClozeCard | ReversedCard;

/**
 * Réponse du LLM pour la génération de flashcards
 */
export interface FlashcardsLLMResponse {
  flashcards: Flashcard[];
}

// ============================================================================
// TYPES POUR LA BASE DE DONNÉES
// ============================================================================

/**
 * Type de carte stocké en base (étendu pour supporter les nouveaux types)
 * Les types existants: 'definition', 'formula', 'condition', 'intuition', 'link'
 * Nouveaux types Anki: 'basic', 'cloze', 'reversed'
 */
export type FlashcardDBType =
  | 'definition'
  | 'formula'
  | 'condition'
  | 'intuition'
  | 'link'
  | 'basic'
  | 'cloze'
  | 'reversed';

/**
 * Flashcard telle que stockée en base de données
 */
export interface FlashcardDB {
  id: string;
  course_id: string;
  chapter_id: string | null;
  type: FlashcardDBType;
  front: string;
  back: string;
  // Champs additionnels pour les cartes cloze/reversed
  cloze_text?: string;      // Pour type='cloze': texte complet avec {{c1::answer}}
  cloze_answer?: string;    // Pour type='cloze': le mot caché
  reversed_term?: string;   // Pour type='reversed': le terme
  reversed_def?: string;    // Pour type='reversed': la définition
  created_at: string;
  updated_at: string;
}

/**
 * Flashcard avec progression utilisateur
 */
export interface FlashcardWithProgress extends FlashcardDB {
  mastery: 'new' | 'learning' | 'reviewing' | 'mastered';
  correctCount: number;
  incorrectCount: number;
  lastReviewed?: string;
}
