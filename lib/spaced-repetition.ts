/**
 * Spaced Repetition Algorithm (SM-2 Simplified)
 * Implements Anki-style review scheduling with 3 difficulty levels
 */

export type Rating = 'hard' | 'good' | 'easy';

export interface FlashcardProgress {
  ease_factor: number;
  interval_days: number;
  next_review_at: Date;
}

/**
 * Calculates the next review interval based on the SM-2 algorithm
 *
 * @param currentProgress - Current state of the card (null if first review)
 * @param rating - User's rating of the card
 * @returns New progress state to save
 */
export function calculateNextReview(
  currentProgress: FlashcardProgress | null,
  rating: Rating
): FlashcardProgress {
  // Default values for new card
  let easeFactor = currentProgress?.ease_factor ?? 2.5;
  let interval = currentProgress?.interval_days ?? 0;

  const now = new Date();

  switch (rating) {
    case 'hard':
      // Difficile -> Card not known, returns to end of session (interval = 0)
      interval = 0;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      // next_review_at = now (stays in session)
      return {
        ease_factor: easeFactor,
        interval_days: interval,
        next_review_at: now
      };

    case 'good':
      // Bien -> 1 jour initial, puis x ease_factor
      if (interval === 0) {
        interval = 1;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      // ease_factor stays stable
      break;

    case 'easy':
      // Facile -> 3 jours initial, puis x ease_factor x 1.3
      if (interval === 0) {
        interval = 3;
      } else {
        interval = Math.round(interval * easeFactor * 1.3);
      }
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      break;
  }

  // Calculate next review date
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    ease_factor: easeFactor,
    interval_days: interval,
    next_review_at: nextDate
  };
}

/**
 * Returns the interval label to display on the button
 */
export function getIntervalLabel(
  currentProgress: FlashcardProgress | null,
  rating: Rating
): string {
  const { interval_days } = calculateNextReview(currentProgress, rating);

  if (interval_days === 0) return 'À revoir';
  if (interval_days === 1) return '1 jour';
  if (interval_days < 7) return `${interval_days} jours`;
  if (interval_days < 30) {
    const weeks = Math.round(interval_days / 7);
    return weeks === 1 ? '1 sem.' : `${weeks} sem.`;
  }
  const months = Math.round(interval_days / 30);
  return months === 1 ? '1 mois' : `${months} mois`;
}

/**
 * Determines mastery level based on interval
 */
export function getMasteryLevel(intervalDays: number): 'new' | 'learning' | 'reviewing' | 'mastered' {
  if (intervalDays === 0) return 'new';
  if (intervalDays < 7) return 'learning';
  if (intervalDays < 30) return 'reviewing';
  return 'mastered';
}

/**
 * Configuration for rating buttons
 */
export const RATING_CONFIG = {
  hard: {
    label: 'Difficile',
    labelShort: 'Difficile',
    color: '#ef4444', // red-500
    bgLight: 'bg-red-50 hover:bg-red-100',
    bgDark: 'bg-red-500/10 hover:bg-red-500/20',
    borderLight: 'border-transparent',
    borderDark: 'border-transparent',
    textLight: 'text-red-700',
    textDark: 'text-red-400',
  },
  good: {
    label: 'Bien',
    labelShort: 'Bien',
    color: '#22c55e', // green-500
    bgLight: 'bg-green-50 hover:bg-green-100',
    bgDark: 'bg-green-500/10 hover:bg-green-500/20',
    borderLight: 'border-transparent',
    borderDark: 'border-transparent',
    textLight: 'text-green-700',
    textDark: 'text-green-400',
  },
  easy: {
    label: 'Facile',
    labelShort: 'Facile',
    color: '#3b82f6', // blue-500
    bgLight: 'bg-blue-50 hover:bg-blue-100',
    bgDark: 'bg-blue-500/10 hover:bg-blue-500/20',
    borderLight: 'border-transparent',
    borderDark: 'border-transparent',
    textLight: 'text-blue-700',
    textDark: 'text-blue-400',
  },
} as const;

/**
 * Session statistics interface
 */
export interface SessionStats {
  total: number;
  hard: number;
  good: number;
  easy: number;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Creates initial session stats
 */
export function createSessionStats(totalCards: number): SessionStats {
  return {
    total: totalCards,
    hard: 0,
    good: 0,
    easy: 0,
    startedAt: new Date(),
  };
}

/**
 * Updates session stats with a new rating
 */
export function updateSessionStats(stats: SessionStats, rating: Rating): SessionStats {
  return {
    ...stats,
    [rating]: stats[rating] + 1,
  };
}

/**
 * Completes session stats
 */
export function completeSessionStats(stats: SessionStats): SessionStats {
  return {
    ...stats,
    completedAt: new Date(),
  };
}

/**
 * Calculates session duration in seconds
 */
export function getSessionDuration(stats: SessionStats): number {
  const endTime = stats.completedAt || new Date();
  return Math.floor((endTime.getTime() - stats.startedAt.getTime()) / 1000);
}

/**
 * Gets mastered count (good + easy)
 */
export function getMasteredCount(stats: SessionStats): number {
  return stats.good + stats.easy;
}

/**
 * Gets difficult count (hard)
 */
export function getDifficultCount(stats: SessionStats): number {
  return stats.hard;
}
