import { Course, Folder, FreshnessLevel } from './types';
import { FRESHNESS_CONFIG, MASTERY_THRESHOLDS } from './constants';

export function getFreshnessLevel(daysSinceStudy: number | null): FreshnessLevel {
  if (daysSinceStudy === null) return 'critical';

  if (daysSinceStudy <= FRESHNESS_CONFIG.fresh.maxDays) return 'fresh';
  if (daysSinceStudy <= FRESHNESS_CONFIG.moderate.maxDays) return 'moderate';
  if (daysSinceStudy <= FRESHNESS_CONFIG.stale.maxDays) return 'stale';
  return 'critical';
}

export function getFreshnessConfig(daysSinceStudy: number | null) {
  const level = getFreshnessLevel(daysSinceStudy);
  return {
    level,
    ...FRESHNESS_CONFIG[level],
  };
}

export function formatDaysSince(
  days: number | null,
  translate: (key: string, params?: Record<string, string | number>) => string
): string {
  if (days === null) return translate('dashboard_time_never_reviewed');
  if (days === 0) return translate('dashboard_time_today');
  if (days === 1) return translate('dashboard_time_yesterday');

  const prefix = translate('dashboard_time_ago_prefix');
  const suffix = translate('dashboard_time_ago_suffix');

  if (days < 7) {
    const unit = translate('dashboard_time_days_ago');
    return `${prefix}${days} ${unit}${suffix}`.trim();
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    const unit = translate('dashboard_time_weeks_ago');
    return `${prefix}${weeks} ${unit}${suffix}`.trim();
  }
  const months = Math.floor(days / 30);
  const unit = translate('dashboard_time_months_ago');
  return `${prefix}${months} ${unit}${suffix}`.trim();
}

export function getMasteryColor(percentage: number): string {
  if (percentage <= MASTERY_THRESHOLDS.low.max) return MASTERY_THRESHOLDS.low.color;
  if (percentage <= MASTERY_THRESHOLDS.medium.max) return MASTERY_THRESHOLDS.medium.color;
  if (percentage <= MASTERY_THRESHOLDS.good.max) return MASTERY_THRESHOLDS.good.color;
  return MASTERY_THRESHOLDS.excellent.color;
}

export function sortCoursesByPriority(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => {
    // 1. Courses with cards to review first
    if (a.cards_to_review > 0 && b.cards_to_review === 0) return -1;
    if (b.cards_to_review > 0 && a.cards_to_review === 0) return 1;

    // 2. Courses not studied for a long time
    const aDays = a.days_since_study ?? Infinity;
    const bDays = b.days_since_study ?? Infinity;
    if (aDays !== bDays) return bDays - aDays;

    // 3. By display order
    return a.display_order - b.display_order;
  });
}

export function filterCourses(courses: Course[], query: string): Course[] {
  if (!query.trim()) return courses;

  const lowerQuery = query.toLowerCase();
  return courses.filter(course =>
    course.name.toLowerCase().includes(lowerQuery) ||
    course.file_name.toLowerCase().includes(lowerQuery)
  );
}

export function getTotalCoursesCount(folders: Folder[], uncategorized: Course[]): number {
  const folderCourses = folders.reduce((sum, f) => sum + f.course_count, 0);
  return folderCourses + uncategorized.length;
}

export function getMasteryLabel(percentage: number): string {
  if (percentage === 0) return 'Non commencé';
  if (percentage < 30) return 'Débutant';
  if (percentage < 60) return 'En cours';
  if (percentage < 85) return 'Avancé';
  return 'Maîtrisé';
}
