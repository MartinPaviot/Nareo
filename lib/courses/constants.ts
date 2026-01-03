import { FolderIcon, FolderColor, FreshnessLevel, FreshnessConfig } from './types';

export const FOLDER_COLORS: FolderColor[] = [
  { id: 'orange', color: '#F97316', label: 'Orange' },
  { id: 'blue', color: '#3B82F6', label: 'Bleu' },
  { id: 'green', color: '#379f5a', label: 'Vert' },
  { id: 'purple', color: '#8B5CF6', label: 'Violet' },
  { id: 'pink', color: '#EC4899', label: 'Rose' },
  { id: 'yellow', color: '#EAB308', label: 'Jaune' },
  { id: 'red', color: '#d91a1c', label: 'Rouge' },
  { id: 'teal', color: '#14B8A6', label: 'Turquoise' },
];

export const FOLDER_ICONS: FolderIcon[] = [
  { id: 'folder', icon: 'Folder', label: 'Dossier' },
  { id: 'book', icon: 'BookOpen', label: 'Livre' },
  { id: 'graduation', icon: 'GraduationCap', label: 'Etudes' },
  { id: 'calculator', icon: 'Calculator', label: 'Maths' },
  { id: 'flask', icon: 'FlaskConical', label: 'Sciences' },
  { id: 'globe', icon: 'Globe', label: 'Geographie' },
  { id: 'scale', icon: 'Scale', label: 'Droit' },
  { id: 'coins', icon: 'Coins', label: 'Economie' },
  { id: 'languages', icon: 'Languages', label: 'Langues' },
  { id: 'pen', icon: 'PenTool', label: 'Lettres' },
  { id: 'code', icon: 'Code', label: 'Informatique' },
  { id: 'heart', icon: 'Heart', label: 'Medecine' },
];

export const FRESHNESS_CONFIG: Record<FreshnessLevel, FreshnessConfig> = {
  fresh: {
    maxDays: 2,
    color: '#379f5a',
    bgColor: 'rgba(55, 159, 90, 0.15)',
    label: 'Recent',
    icon: 'CheckCircle',
  },
  moderate: {
    maxDays: 5,
    color: '#EAB308',
    bgColor: '#FEF9C3',
    label: 'A revoir bientot',
    icon: 'Clock',
  },
  stale: {
    maxDays: 10,
    color: '#F97316',
    bgColor: '#FFEDD5',
    label: 'A reviser',
    icon: 'AlertTriangle',
  },
  critical: {
    maxDays: Infinity,
    color: '#d91a1c',
    bgColor: 'rgba(217, 26, 28, 0.1)',
    label: 'Urgent',
    icon: 'AlertCircle',
  },
};

export const MASTERY_THRESHOLDS = {
  low: { max: 30, color: '#d91a1c' },
  medium: { max: 60, color: '#F97316' },
  good: { max: 85, color: '#EAB308' },
  excellent: { max: 100, color: '#379f5a' },
};

export const EMPTY_STATES = {
  folder: {
    title: 'Dossier vide',
    description: 'Ajoute ton premier cours',
    cta: 'Importer un cours',
  },
  uncategorized: {
    title: 'Aucun cours en attente',
    description: 'Les cours non classes apparaitront ici',
  },
  priority: {
    title: 'Rien a reviser en urgence',
    description: 'Continue comme ca !',
  },
  search: {
    title: 'Aucun resultat',
    description: 'Essaie avec d\'autres mots-cles',
  },
};

export const SMART_CTA_CONFIG = {
  flashcards: {
    icon: 'Layers',
    color: '#8B5CF6',
    priority: 1,
  },
  start_chapter: {
    icon: 'Play',
    color: '#379f5a',
    priority: 2,
  },
  continue_chapter: {
    icon: 'ArrowRight',
    color: '#F97316',
    priority: 2,
  },
  review: {
    icon: 'RefreshCw',
    color: '#3B82F6',
    priority: 3,
  },
};
