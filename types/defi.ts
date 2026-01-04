// ============================================================================
// TYPES POUR LE MODE DÉFI MULTIJOUEUR
// ============================================================================

// ============================================
// Types de base
// ============================================

export type ChallengeStatus = 'lobby' | 'starting' | 'playing' | 'finished' | 'cancelled';
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

// ============================================
// Configuration du temps par question
// ============================================

export const TIME_OPTIONS = [
  { value: 10, label: '10 secondes', description: 'Rapide' },
  { value: 15, label: '15 secondes', description: 'Normal' },
] as const;

export const DEFAULT_TIME_PER_QUESTION = 10;

// ============================================
// Interfaces Database
// ============================================

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  friend_code: string;
  total_points: number;
  total_challenges_played: number;
  total_challenges_won: number;
  current_streak: number;
  longest_streak: number;
  last_active_at: string;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  friend_profile?: UserProfile;
}

export interface WeeklyPoints {
  id: string;
  user_id: string;
  week_start: string;
  points: number;
  challenges_played: number;
  challenges_won: number;
  best_streak: number;
  created_at: string;
  updated_at: string;
  // Joined data
  user_profile?: UserProfile;
}

export interface Challenge {
  id: string;
  code: string;
  host_id: string;
  course_id: string | null;
  chapter_id: string | null;
  question_count: number;
  time_per_question: number;
  status: ChallengeStatus;
  current_question_index: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  // Joined data
  host_profile?: UserProfile;
  course?: { id: string; title: string };
  chapter?: { id: string; title: string };
  players?: ChallengePlayer[];
}

export interface ChallengePlayer {
  id: string;
  challenge_id: string;
  user_id: string | null;
  display_name: string;
  is_guest: boolean;
  is_ready: boolean;
  is_connected: boolean;
  score: number;
  correct_answers: number;
  total_answers: number;
  best_streak: number;
  current_streak: number;
  average_response_time_ms: number | null;
  final_rank: number | null;
  points_earned: number;
  joined_at: string;
  finished_at: string | null;
  // Joined data
  user_profile?: UserProfile;
}

export interface ChallengeQuestion {
  id: string;
  challenge_id: string;
  question_index: number;
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank';
  question_data: QuestionData;
  correct_answer: string;
  shown_at: string | null;
  ended_at: string | null;
}

export interface ChallengeAnswer {
  id: string;
  challenge_id: string;
  question_id: string;
  player_id: string;
  answer: string;
  is_correct: boolean;
  response_time_ms: number;
  points_earned: number;
  streak_at_answer: number;
  answered_at: string;
}

// ============================================
// Types pour les questions
// ============================================

export type QuestionData =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | FillBlankQuestion;

export interface MultipleChoiceQuestion {
  type: 'multiple_choice';
  prompt: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  source_reference?: string;
  cognitive_level?: string;
  concept_tested?: string;
}

export interface TrueFalseQuestion {
  type: 'true_false';
  statement: string;
  correct_answer: boolean;
  explanation: string;
  source_reference?: string;
  cognitive_level?: string;
  concept_tested?: string;
}

export interface FillBlankQuestion {
  type: 'fill_blank';
  sentence: string;
  correct_answer: string;
  accepted_answers?: string[];
  hint?: string;
  explanation: string;
  source_reference?: string;
  cognitive_level?: string;
  concept_tested?: string;
}

// ============================================
// Types Realtime
// ============================================

export interface RealtimePlayer {
  id: string;
  display_name: string;
  avatar_url?: string;
  is_ready: boolean;
  is_host: boolean;
  hasAnswered?: boolean;
  score?: number;
}

export interface RealtimeGameState {
  status: ChallengeStatus;
  current_question_index: number;
  current_question?: ChallengeQuestion;
  time_remaining?: number;
  scores: Record<string, number>; // player_id -> score
}

// Events Broadcast
export type BroadcastEvent =
  | { type: 'GAME_START'; countdown: number }
  | { type: 'QUESTION'; question: ChallengeQuestion; timeLimit: number }
  | { type: 'PLAYER_ANSWERED'; playerId: string; playerName: string }
  | { type: 'QUESTION_END'; results: QuestionResults }
  | { type: 'GAME_END'; finalScores: FinalScore[] }
  | { type: 'PLAYER_LEFT'; playerId: string }
  | { type: 'HOST_CANCELLED' };

export interface QuestionResults {
  question_text: string;
  correct_answer: string;
  explanation: string;
  player_results: PlayerQuestionResult[];
}

export interface PlayerQuestionResult {
  player_id: string;
  player_name: string;
  answer: string;
  is_correct: boolean;
  response_time_ms: number;
  points_earned: number;
  new_score: number;
}

export interface FinalScore {
  rank: number;
  player_id: string;
  player_name: string;
  score: number;
  correct_answers: number;
  total_answers: number;
  average_time_ms: number;
  points_earned: number;
}

// ============================================
// Types pour l'UI
// ============================================

export interface CreateChallengeInput {
  courseId?: string;
  chapterId?: string;
  timePerQuestion?: number;
  invitedFriendIds?: string[];
}

export interface JoinChallengeInput {
  code: string;
  displayName: string;
}

export interface ChallengeListItem {
  id: string;
  code: string;
  time_per_question: number;
  status: ChallengeStatus;
  host_profile: Pick<UserProfile, 'display_name' | 'avatar_url'>;
  course_title?: string;
  chapter_title?: string;
  player_count: number;
  created_at: string;
  // Infos personnelles pour les défis terminés
  my_rank?: number;
  my_score?: number;
  winner_name?: string;
}

export interface UserChallengeStats {
  total_played: number;
  total_wins: number;
  total_points: number;
  current_streak: number;
  best_streak: number;
}

// ============================================
// Système de points
// ============================================

export const POINTS_CONFIG = {
  // Points per answer
  correctAnswer: 10,
  speedBonus: {
    threshold: 5000, // ms
    bonus: 5,
  },

  // Streak bonus
  streakBonus: {
    5: 20,  // 5 correct answers in a row
    10: 50, // 10 correct answers in a row
  } as Record<number, number>,

  // End of game bonus
  rankBonus: {
    1: 50, // 1st place
    2: 25, // 2nd place
    3: 10, // 3rd place
  } as Record<number, number>,

  // Penalty
  abandonPenalty: -20,
} as const;

/**
 * Calculate points for a single answer
 */
export function calculatePointsForAnswer(
  isCorrect: boolean,
  responseTimeMs: number,
  currentStreak: number
): number {
  if (!isCorrect) return 0;

  let points = POINTS_CONFIG.correctAnswer;

  // Speed bonus
  if (responseTimeMs < POINTS_CONFIG.speedBonus.threshold) {
    points += POINTS_CONFIG.speedBonus.bonus;
  }

  // Streak bonus
  if (currentStreak >= 10) {
    points += POINTS_CONFIG.streakBonus[10];
  } else if (currentStreak >= 5) {
    points += POINTS_CONFIG.streakBonus[5];
  }

  return points;
}

/**
 * Calculate bonus points based on final rank
 */
export function calculateRankBonus(rank: number): number {
  return POINTS_CONFIG.rankBonus[rank] || 0;
}

/**
 * Check if answer is correct based on question type
 */
export function checkAnswer(question: QuestionData, answer: string): boolean {
  switch (question.type) {
    case 'multiple_choice':
      return answer === question.options[question.correct_option_index];

    case 'true_false':
      return answer.toLowerCase() === String(question.correct_answer).toLowerCase();

    case 'fill_blank':
      const normalizedAnswer = answer.toLowerCase().trim();
      const normalizedCorrect = question.correct_answer.toLowerCase().trim();

      if (normalizedAnswer === normalizedCorrect) return true;

      // Check accepted alternatives
      if (question.accepted_answers) {
        return question.accepted_answers.some(
          (alt) => alt.toLowerCase().trim() === normalizedAnswer
        );
      }

      return false;

    default:
      return false;
  }
}

/**
 * Get correct answer string for display
 */
export function getCorrectAnswerString(question: QuestionData): string {
  switch (question.type) {
    case 'multiple_choice':
      return question.options[question.correct_option_index];
    case 'true_false':
      return question.correct_answer ? 'Vrai' : 'Faux';
    case 'fill_blank':
      return question.correct_answer;
    default:
      return '';
  }
}

// ============================================
// Constantes UI
// ============================================

export const MAX_PLAYERS_PER_CHALLENGE = 10;
export const MIN_PLAYERS_TO_START = 1;
export const LOBBY_EXPIRY_MINUTES = 30;
export const CHALLENGE_CODE_LENGTH = 9; // XXXX-XXXX

export const CHALLENGE_STATUS_LABELS: Record<ChallengeStatus, string> = {
  lobby: 'En attente',
  starting: 'Démarrage...',
  playing: 'En cours',
  finished: 'Terminé',
  cancelled: 'Annulé',
};
