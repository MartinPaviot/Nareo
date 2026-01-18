import { XP_LEVELS, MASTERY_CONFIG, STREAK_MILESTONES, MASTERY_ORDER } from './constants';
import type { XPLevel, MasteryLevel, Milestone, ChapterMastery, CourseMasterySummary } from './types';

/**
 * Get the user's current XP level based on total XP
 */
export function getXPLevel(totalXP: number): XPLevel {
  let currentLevel = XP_LEVELS[0];
  for (const level of XP_LEVELS) {
    if (totalXP >= level.xpRequired) {
      currentLevel = level;
    } else {
      break;
    }
  }
  return currentLevel;
}

/**
 * Get the next XP level
 */
export function getNextXPLevel(totalXP: number): XPLevel | null {
  const currentLevel = getXPLevel(totalXP);
  const nextLevelIndex = XP_LEVELS.findIndex(l => l.level === currentLevel.level) + 1;
  return nextLevelIndex < XP_LEVELS.length ? XP_LEVELS[nextLevelIndex] : null;
}

/**
 * Calculate progress to next level (0-100)
 */
export function getXPProgress(totalXP: number): number {
  const currentLevel = getXPLevel(totalXP);
  const nextLevel = getNextXPLevel(totalXP);

  if (!nextLevel) return 100;

  const xpInCurrentLevel = totalXP - currentLevel.xpRequired;
  const xpNeededForNext = nextLevel.xpRequired - currentLevel.xpRequired;

  return Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100));
}

/**
 * Get XP remaining until next level
 */
export function getXPToNextLevel(totalXP: number): number {
  const nextLevel = getNextXPLevel(totalXP);
  if (!nextLevel) return 0;
  return nextLevel.xpRequired - totalXP;
}

/**
 * Calculate mastery level based on questions and precision
 */
export function calculateMasteryLevel(
  totalQuestions: number,
  correctAnswers: number
): MasteryLevel {
  if (totalQuestions === 0) return 'not_started';

  const precision = (correctAnswers / totalQuestions) * 100;

  if (totalQuestions < 5) return 'discovery';
  if (precision < 50) return 'discovery';
  if (precision < 70) return 'learning';
  if (precision < 90 || totalQuestions < 20) return 'acquired';
  return 'mastered';
}

/**
 * Get precision percentage
 */
export function getPrecision(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

/**
 * Compare mastery levels
 */
export function compareMasteryLevels(a: MasteryLevel, b: MasteryLevel): number {
  return MASTERY_ORDER.indexOf(a) - MASTERY_ORDER.indexOf(b);
}

/**
 * Check if mastery level improved
 */
export function didMasteryImprove(oldLevel: MasteryLevel, newLevel: MasteryLevel): boolean {
  return compareMasteryLevels(newLevel, oldLevel) > 0;
}

/**
 * Get mastery color for UI
 */
export function getMasteryColor(level: MasteryLevel): string {
  return MASTERY_CONFIG[level].color;
}

/**
 * Get mastery label
 */
export function getMasteryLabel(level: MasteryLevel): string {
  return MASTERY_CONFIG[level].label;
}

/**
 * Calculate overall course mastery percentage
 */
export function calculateCourseMastery(chapters: ChapterMastery[]): number {
  if (chapters.length === 0) return 0;

  let totalWeight = 0;
  let weightedScore = 0;

  for (const chapter of chapters) {
    const levelWeight = MASTERY_ORDER.indexOf(chapter.mastery_level);
    const maxWeight = MASTERY_ORDER.length - 1;

    weightedScore += (levelWeight / maxWeight) * 100;
    totalWeight += 1;
  }

  return Math.round(weightedScore / totalWeight);
}

/**
 * Group chapter mastery by course, sorted by most recent activity
 */
export function groupMasteryByCourse(
  masteryData: ChapterMastery[]
): CourseMasterySummary[] {
  const courseMap = new Map<string, { chapters: ChapterMastery[]; lastActivity: Date }>();

  for (const chapter of masteryData) {
    const existing = courseMap.get(chapter.course_id);
    const chapterUpdated = new Date(chapter.updated_at);

    if (existing) {
      existing.chapters.push(chapter);
      // Keep track of the most recent activity for this course
      if (chapterUpdated > existing.lastActivity) {
        existing.lastActivity = chapterUpdated;
      }
    } else {
      courseMap.set(chapter.course_id, {
        chapters: [chapter],
        lastActivity: chapterUpdated,
      });
    }
  }

  const summaries: CourseMasterySummary[] = [];

  courseMap.forEach((data, courseId) => {
    const masteredCount = data.chapters.filter(c => c.mastery_level === 'mastered').length;

    summaries.push({
      course_id: courseId,
      course_title: data.chapters[0].course_title || 'Untitled Course',
      chapters: data.chapters,
      overall_mastery: calculateCourseMastery(data.chapters),
      mastered_count: masteredCount,
      total_chapters: data.chapters.length,
    });
  });

  // Sort by most recent activity (descending)
  summaries.sort((a, b) => {
    const aLastActivity = courseMap.get(a.course_id)!.lastActivity;
    const bLastActivity = courseMap.get(b.course_id)!.lastActivity;
    return bLastActivity.getTime() - aLastActivity.getTime();
  });

  return summaries;
}

/**
 * Get the next streak milestone
 */
export function getNextStreakMilestone(currentStreak: number): Milestone | null {
  for (const milestone of STREAK_MILESTONES) {
    if (currentStreak < milestone.days) {
      return milestone;
    }
  }
  return null;
}

/**
 * Get all achieved streak milestones
 */
export function getAchievedStreakMilestones(currentStreak: number): Milestone[] {
  return STREAK_MILESTONES.filter(m => currentStreak >= m.days);
}

/**
 * Calculate days remaining until streak milestone
 */
export function getDaysToNextMilestone(currentStreak: number): number {
  const nextMilestone = getNextStreakMilestone(currentStreak);
  if (!nextMilestone) return 0;
  return nextMilestone.days - currentStreak;
}

/**
 * Format time duration in seconds to human readable
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Format date to relative time
 */
export function formatRelativeTime(
  date: string | Date,
  translate: (key: string, params?: Record<string, string | number>) => string
): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return translate('dashboard_time_today');
  if (diffDays === 1) return translate('dashboard_time_yesterday');

  const prefix = translate('dashboard_time_ago_prefix');
  const suffix = translate('dashboard_time_ago_suffix');

  if (diffDays < 7) {
    const unit = translate('dashboard_time_days_ago');
    return `${prefix}${diffDays} ${unit}${suffix}`.trim();
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    const unit = translate('dashboard_time_weeks_ago');
    return `${prefix}${weeks} ${unit}${suffix}`.trim();
  }
  const months = Math.floor(diffDays / 30);
  const unit = translate('dashboard_time_months_ago');
  return `${prefix}${months} ${unit}${suffix}`.trim();
}

/**
 * Get time until midnight for countdown
 */
export function getTimeUntilMidnight(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);

  const diffMs = midnight.getTime() - now.getTime();

  return {
    hours: Math.floor(diffMs / (1000 * 60 * 60)),
    minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
  };
}

/**
 * Format countdown time
 */
export function formatCountdown(time: { hours: number; minutes: number; seconds: number }): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(time.hours)}:${pad(time.minutes)}:${pad(time.seconds)}`;
}

/**
 * Check if date is today
 */
export function isToday(date: string | Date): boolean {
  const target = new Date(date);
  const now = new Date();
  return (
    target.getDate() === now.getDate() &&
    target.getMonth() === now.getMonth() &&
    target.getFullYear() === now.getFullYear()
  );
}

/**
 * Check if date is yesterday
 */
export function isYesterday(date: string | Date): boolean {
  const target = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    target.getDate() === yesterday.getDate() &&
    target.getMonth() === yesterday.getMonth() &&
    target.getFullYear() === yesterday.getFullYear()
  );
}

/**
 * Get start of current week (Monday)
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate daily goal based on user history
 */
export function calculateDailyGoal(
  goalLevel: 'tranquille' | 'standard' | 'intensif',
  recentAverage: number | null,
  completionRate: number | null,
  isWeekend: boolean
): number {
  const baseGoals = {
    tranquille: 8,
    standard: 15,
    intensif: 35,
  };

  let goal = baseGoals[goalLevel];

  // Adjust based on recent average
  if (recentAverage !== null && recentAverage > 0) {
    goal = Math.round((goal + recentAverage) / 2);
  }

  // Adjust based on completion rate
  if (completionRate !== null) {
    if (completionRate < 0.5) {
      goal = Math.round(goal * 0.8);
    } else if (completionRate > 0.9) {
      goal = Math.round(goal * 1.1);
    }
  }

  // Weekend reduction
  if (isWeekend) {
    goal = Math.round(goal * 0.7);
  }

  // Clamp and round to nearest 5
  goal = Math.max(5, Math.min(50, Math.round(goal / 5) * 5));

  return goal;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

/**
 * Get chapters that need review (degradation warning)
 */
export function getChaptersNeedingReview(chapters: ChapterMastery[]): ChapterMastery[] {
  return chapters.filter(
    c => c.days_until_degradation !== null && c.days_until_degradation <= 2 && c.days_until_degradation > 0
  );
}

/**
 * Get chapters that are about to degrade
 */
export function getChaptersInDanger(chapters: ChapterMastery[]): ChapterMastery[] {
  const now = new Date();
  return chapters.filter(c => {
    if (!c.next_review_due) return false;
    const reviewDue = new Date(c.next_review_due);
    return reviewDue <= now && c.mastery_level !== 'not_started' && c.mastery_level !== 'discovery';
  });
}
