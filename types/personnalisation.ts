// ============================================================================
// TYPES POUR LA PERSONNALISATION DES FICHES DE RÉVISION
// ============================================================================

/**
 * Matières disponibles pour la personnalisation
 * Chaque matière a des règles de formatage spécifiques
 */
export type Matiere =
  | 'droit'
  | 'economie'
  | 'sciences'
  | 'histoire-geo'
  | 'langues'
  | 'informatique'
  | 'medecine'
  | 'autre';

/**
 * Niveaux de détail pour la fiche
 * - synthetique: Condensé, droit au but (~50% du standard)
 * - standard: Complet et structuré (référence)
 * - explicatif: Avec raisonnements et contexte (~130% du standard)
 */
export type NiveauDetail = 'synthetique' | 'standard' | 'explicatif';

/**
 * Récaps optionnels à ajouter à la fin de la fiche
 */
export interface RecapsConfig {
  definitions: boolean;  // Glossaire des termes clés (renommé de "définitions")
  formules: boolean;     // Tableau récapitulatif des formules
  schemas: boolean;      // Index des schémas/graphiques (masqué car images désactivées)
}

/**
 * Configuration complète de personnalisation
 */
export interface PersonnalisationConfig {
  matiere: Matiere;
  niveau: NiveauDetail;
  recaps: RecapsConfig;
  includeGraphics?: boolean; // Inclure les graphiques du cours (extraction coûteuse)
}

/**
 * Configuration par défaut
 */
export const DEFAULT_CONFIG: PersonnalisationConfig = {
  matiere: 'autre',
  niveau: 'standard',
  recaps: {
    definitions: false,
    formules: false,
    schemas: false,
  },
  includeGraphics: false, // Par défaut désactivé car coûteux
};

/**
 * Options pour le dropdown matière
 */
export const MATIERES_OPTIONS = [
  { value: 'droit', label: 'Droit' },
  { value: 'economie', label: 'Économie / Finance / Gestion' },
  { value: 'sciences', label: 'Sciences (Maths, Physique, Chimie, Bio)' },
  { value: 'histoire-geo', label: 'Histoire / Géographie / Sciences Po' },
  { value: 'langues', label: 'Langues' },
  { value: 'informatique', label: 'Informatique' },
  { value: 'medecine', label: 'Médecine / Santé' },
  { value: 'autre', label: 'Autre' },
] as const;

/**
 * Options pour le sélecteur de niveau
 */
export const NIVEAUX_OPTIONS = [
  {
    value: 'synthetique' as const,
    label: 'Synthétique',
    icon: '⚡',
    description: 'Droit au but, concepts condensés',
  },
  {
    value: 'standard' as const,
    label: 'Standard',
    icon: '📋',
    description: 'Complet et structuré',
  },
  {
    value: 'explicatif' as const,
    label: 'Explicatif',
    icon: '💡',
    description: 'Avec raisonnements et contexte',
  },
] as const;

/**
 * Options pour les checkboxes récaps
 * Note: schemas est masqué car l'extraction d'images est désactivée
 */
export const RECAPS_OPTIONS = [
  {
    key: 'definitions' as const,
    label: 'Glossaire',
    icon: '📖',
    description: 'Tableau des termes clés et définitions',
  },
  {
    key: 'formules' as const,
    label: 'Récap formules',
    icon: '🔢',
    description: 'Toutes les formules avec leurs variables',
  },
  // schemas masqué temporairement (images désactivées)
  // {
  //   key: 'schemas' as const,
  //   label: 'Index des schémas',
  //   icon: '📊',
  //   description: 'Liste des graphiques avec leur interprétation',
  // },
] as const;

/**
 * Mapping matière → récaps pré-cochés par défaut
 * Note: schemas est toujours false car l'extraction d'images est désactivée
 */
export const DEFAULT_RECAPS_BY_MATIERE: Record<Matiere, RecapsConfig> = {
  droit: { definitions: true, formules: false, schemas: false },
  economie: { definitions: true, formules: true, schemas: false },
  sciences: { definitions: false, formules: true, schemas: false },
  'histoire-geo': { definitions: true, formules: false, schemas: false },
  langues: { definitions: true, formules: false, schemas: false },
  informatique: { definitions: true, formules: true, schemas: false },
  medecine: { definitions: true, formules: false, schemas: false },
  autre: { definitions: false, formules: false, schemas: false },
};
