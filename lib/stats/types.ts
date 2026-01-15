// Stats & Engagement Module Types

export type StreakState = 'on_fire' | 'at_risk' | 'lost' | 'protected' | 'new_user';

export type MasteryLevel = 'not_started' | 'discovery' | 'learning' | 'acquired' | 'mastered';

export type DailyGoalLevel = 'tranquille' | 'standard' | 'intensif';

export type BadgeType =
  | 'streak_3' | 'streak_7' | 'streak_14' | 'streak_30' | 'streak_60' | 'streak_100'
  | 'xp_100' | 'xp_500' | 'xp_1000' | 'xp_5000' | 'xp_10000'
  | 'first_quiz' | 'perfect_score' | 'first_mastered_chapter'
  | 'ten_perfect_quizzes' | 'all_chapters_mastered'
  | 'overachiever' | 'comeback_king' | 'night_owl' | 'early_bird' | 'weekend_warrior'
  | 'speed_demon' | 'chapter_master' | 'knowledge_hunter';

export type XPTransactionType =
  | 'question_answered' | 'correct_answer' | 'daily_goal_completed' | 'perfect_quiz'
  | 'streak_milestone' | 'badge_earned' | 'chapter_mastered' | 'correct_streak_bonus'
  | 'danger_chapter_bonus' | 'quiz_completed'
  | 'reward_purchase' | 'streak_freeze_purchase';

export type RewardType =
  | 'avatar_default' | 'avatar_graduation' | 'avatar_scientist' | 'avatar_astronaut'
  | 'avatar_ninja' | 'avatar_wizard' | 'avatar_gold'
  | 'theme_light' | 'theme_dark' | 'theme_ocean' | 'theme_forest' | 'theme_sunset' | 'theme_exam_night'
  | 'powerup_double_xp' | 'powerup_hint' | 'streak_freeze';

export interface UserStats {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  streak_freezes_available: number;
  total_xp: number;
  total_points: number;
  daily_goal_level: DailyGoalLevel;
  last_activity_date: string | null;
  streak_lost_at: string | null;
  previous_streak_before_loss: number;
  total_quizzes_completed: number;
  total_chapters_completed: number;
  total_questions_answered: number;
  total_questions_correct: number;
  created_at: string;
  updated_at: string;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  activity_date: string;
  questions_answered: number;
  questions_correct: number;
  time_spent_minutes: number;
  quizzes_completed: number;
  perfect_quizzes: number;
  points_earned: number;
  longest_correct_streak: number;
  daily_goal_target: number;
  daily_goal_completed: boolean;
  goal_completed_at: string | null;
  xp_earned: number;
  xp_multiplier_active: boolean;
  streak_freeze_used: boolean;
  streak_freeze_used_at: string | null;
  // Unified activity tracking (quiz + flashcards)
  flashcards_reviewed: number;
  flashcards_hard: number;
  flashcards_good: number;
  flashcards_easy: number;
  activity_units: number;
  created_at: string;
  updated_at: string;
}

export interface ChapterMastery {
  id: string;
  user_id: string;
  chapter_id: string;
  course_id: string;
  mastery_level: MasteryLevel;
  total_questions_answered: number;
  correct_answers: number;
  last_reviewed_at: string | null;
  next_review_due: string | null;
  days_until_degradation: number | null;
  degradation_warning_sent: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  chapter_title?: string;
  course_title?: string;
}

export interface Badge {
  id: string;
  code: string;
  name_fr: string;
  name_en: string;
  name_de: string;
  description_fr: string | null;
  description_en: string | null;
  description_de: string | null;
  icon: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

export interface XPTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: XPTransactionType;
  multiplier: number;
  base_amount: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WeeklyInsight {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  total_questions: number;
  total_correct: number;
  precision_percentage: number | null;
  total_time_seconds: number;
  days_active: number;
  quizzes_completed: number;
  xp_earned: number;
  questions_vs_previous_week: number | null;
  precision_vs_previous_week: number | null;
  strength_insight: string | null;
  weakness_insight: string | null;
  tip_insight: string | null;
  strongest_chapter_id: string | null;
  weakest_chapter_id: string | null;
  generated_at: string;
  notification_sent: boolean;
}

export interface UserReward {
  id: string;
  user_id: string;
  reward_type: RewardType;
  purchased_at: string;
  xp_cost: number;
  is_equipped: boolean;
  quantity: number;
}

export interface XPLevel {
  level: number;
  xpRequired: number;
  name: string;
}

export interface Milestone {
  days: number;
  xpReward: number;
  freezeReward: boolean;
  badgeCode: string;
  message: string;
  emoji: string;
}

export interface StreakCheckResult {
  streak_state: StreakState;
  current_streak: number;
  longest_streak: number;
  freezes_available: number;
  previous_streak_lost: number;
}

export interface QuizAnswerResult {
  xp_earned: number;
  multiplier: number;
  goal_completed: boolean;
  chapter_in_danger: boolean;
}

export interface QuizCompletionResult {
  precision: number;
  is_perfect: boolean;
  xp_bonus: number;
  badges_earned: string[];
}

export interface MilestoneReward {
  milestone: number;
  badge: string;
  xp: number;
  freeze: boolean;
  message?: string;
}

export interface CourseMasterySummary {
  course_id: string;
  course_title: string;
  chapters: ChapterMastery[];
  overall_mastery: number; // Percentage
  mastered_count: number;
  total_chapters: number;
}

export interface DailyGoalConfig {
  min: number;
  max: number;
  base: number;
  label: string;
  emoji: string;
  timeEstimate: string;
}

export interface MasteryConfig {
  color: string;
  label: string;
  minPrecision: number;
  minQuestions: number;
}

export interface StreakColors {
  bg: string;
  text: string;
  icon: string;
  border: string;
}

export interface RewardShopItem {
  id: RewardType;
  name: string;
  xpCost: number;
  description: string;
  consumable?: boolean;
}

// API Response types
export interface StatsAPIResponse {
  success: boolean;
  stats?: UserStats;
  todayActivity?: DailyActivity;
  recentActivity?: DailyActivity[];
  streakState?: StreakCheckResult;
  error?: string;
}

export interface MasteryAPIResponse {
  success: boolean;
  mastery?: ChapterMastery[];
  courses?: CourseMasterySummary[];
  error?: string;
}

export interface BadgesAPIResponse {
  success: boolean;
  badges?: UserBadge[];
  unseenBadges?: UserBadge[];
  error?: string;
}
