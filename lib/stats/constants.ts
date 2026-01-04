import type {
  XPLevel,
  Milestone,
  DailyGoalConfig,
  MasteryConfig,
  StreakColors,
  RewardShopItem,
  MasteryLevel,
  StreakState,
  DailyGoalLevel,
} from './types';

// XP Levels
export const XP_LEVELS: XPLevel[] = [
  { level: 1, xpRequired: 0, name: 'Debutant' },
  { level: 2, xpRequired: 100, name: 'Apprenti' },
  { level: 3, xpRequired: 300, name: 'Etudiant' },
  { level: 4, xpRequired: 600, name: 'Assidu' },
  { level: 5, xpRequired: 1000, name: 'Expert' },
  { level: 6, xpRequired: 1500, name: 'Maitre' },
  { level: 7, xpRequired: 2500, name: 'Champion' },
  { level: 8, xpRequired: 4000, name: 'Legende' },
  { level: 9, xpRequired: 6000, name: 'Mythique' },
  { level: 10, xpRequired: 10000, name: 'Transcendant' },
];

// Streak Milestones
export const STREAK_MILESTONES: Milestone[] = [
  { days: 3, xpReward: 50, freezeReward: false, badgeCode: 'streak_3', message: '3 jours ! Tu prends de bonnes habitudes', emoji: '💪' },
  { days: 7, xpReward: 100, freezeReward: true, badgeCode: 'streak_7', message: 'Une semaine complete ! Voici un Streak Freeze en cadeau', emoji: '🛡️' },
  { days: 14, xpReward: 200, freezeReward: false, badgeCode: 'streak_14', message: '2 semaines ! Tu fais partie des 20% les plus assidus', emoji: '🔥' },
  { days: 30, xpReward: 500, freezeReward: true, badgeCode: 'streak_30', message: 'Un mois de revisions ! Tu es une machine', emoji: '🏆' },
  { days: 60, xpReward: 1000, freezeReward: true, badgeCode: 'streak_60', message: '60 jours ! La mascotte te remercie personnellement', emoji: '🎉' },
  { days: 100, xpReward: 2000, freezeReward: false, badgeCode: 'streak_100', message: '100 jours ! Tu es dans le top 1% des etudiants Nareo', emoji: '👑' },
];

// Mastery Configuration
export const MASTERY_CONFIG: Record<MasteryLevel, MasteryConfig> = {
  not_started: { color: '#E5E7EB', label: 'Non commence', minPrecision: 0, minQuestions: 0 },
  discovery: { color: '#d91a1c', label: 'Decouverte', minPrecision: 0, minQuestions: 1 },
  learning: { color: '#F97316', label: 'En cours', minPrecision: 50, minQuestions: 10 },
  acquired: { color: '#EAB308', label: 'Acquis', minPrecision: 70, minQuestions: 15 },
  mastered: { color: '#379f5a', label: 'Maitrise', minPrecision: 90, minQuestions: 20 },
};

// Daily Goal Configuration
// Fixed values: tranquille=8, standard=15, intensif=35 questions/day
export const DAILY_GOAL_CONFIG: Record<DailyGoalLevel, DailyGoalConfig> = {
  tranquille: { min: 8, max: 8, base: 8, label: 'Tranquille', emoji: '🐢', timeEstimate: '~5 min' },
  standard: { min: 15, max: 15, base: 15, label: 'Standard', emoji: '⚡', timeEstimate: '~15 min' },
  intensif: { min: 35, max: 35, base: 35, label: 'Intensif', emoji: '🚀', timeEstimate: '~30 min' },
};

// XP Rewards per action
export const XP_REWARDS = {
  question_answered: 5,
  correct_answer: 5,
  daily_goal_completed: 25,
  perfect_quiz: 50,
  chapter_mastered: 100,
  quiz_completed: 10,
} as const;

// XP Multipliers
export const XP_MULTIPLIERS = {
  correct_streak_5: 1.5,
  chapter_in_danger: 2.0,
  double_xp_powerup: 2.0,
} as const;

// Streak Colors by state
export const STREAK_COLORS: Record<StreakState, StreakColors> = {
  on_fire: { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'text-orange-500', border: 'border-orange-200' },
  at_risk: { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: 'text-yellow-500', border: 'border-yellow-200' },
  lost: { bg: 'bg-gray-50', text: 'text-gray-500', icon: 'text-gray-400', border: 'border-gray-200' },
  protected: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500', border: 'border-blue-200' },
  new_user: { bg: 'bg-gray-50', text: 'text-gray-500', icon: 'text-gray-400', border: 'border-gray-200' },
};

// Streak Messages
export const STREAK_MESSAGES: Record<StreakState, string | ((prev: number) => string)> = {
  on_fire: 'Streak maintenu !',
  at_risk: 'Revise pour maintenir ton streak !',
  lost: (previousStreak: number) => `Ton streak de ${previousStreak} jours est parti. Recommence aujourd'hui !`,
  protected: 'Streak protege par un Freeze',
  new_user: 'Commence ta premiere serie !',
};

// Degradation delays in days
export const DEGRADATION_DELAYS: Record<string, number> = {
  mastered: 14,
  acquired: 10,
  learning: 7,
};

// Rewards Shop
export const REWARDS_SHOP: {
  avatars: RewardShopItem[];
  themes: RewardShopItem[];
  powerups: RewardShopItem[];
  utility: RewardShopItem[];
} = {
  avatars: [
    { id: 'avatar_graduation', name: 'Diplome', xpCost: 500, description: 'La mascotte en tenue de diplome' },
    { id: 'avatar_scientist', name: 'Scientifique', xpCost: 750, description: 'La mascotte en blouse de labo' },
    { id: 'avatar_ninja', name: 'Ninja', xpCost: 1000, description: 'La mascotte en mode furtif' },
    { id: 'avatar_wizard', name: 'Magicien', xpCost: 1500, description: 'La mascotte avec chapeau de sorcier' },
    { id: 'avatar_gold', name: 'Or', xpCost: 3000, description: 'La mascotte doree (exclusif)' },
  ],
  themes: [
    { id: 'theme_dark', name: 'Mode Sombre', xpCost: 300, description: 'Interface en mode sombre' },
    { id: 'theme_ocean', name: 'Ocean', xpCost: 500, description: 'Theme bleu apaisant' },
    { id: 'theme_forest', name: 'Foret', xpCost: 500, description: 'Theme vert nature' },
    { id: 'theme_sunset', name: 'Coucher de soleil', xpCost: 750, description: 'Theme orange-rose' },
    { id: 'theme_exam_night', name: 'Nuit d\'exam', xpCost: 1000, description: 'Mode ultra-concentre' },
  ],
  powerups: [
    { id: 'powerup_double_xp', name: 'Double XP', xpCost: 300, description: '1 heure de double XP', consumable: true },
    { id: 'powerup_hint', name: 'Indice', xpCost: 100, description: 'Un indice gratuit en quiz', consumable: true },
  ],
  utility: [
    { id: 'streak_freeze', name: 'Streak Freeze', xpCost: 500, description: 'Protege ton streak 1 jour', consumable: true },
  ],
};

// Mastery level order for comparisons
export const MASTERY_ORDER: MasteryLevel[] = ['not_started', 'discovery', 'learning', 'acquired', 'mastered'];

// Badge rarity colors
export const BADGE_RARITY_COLORS = {
  common: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
  rare: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-300' },
  epic: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-300' },
  legendary: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-300' },
} as const;
