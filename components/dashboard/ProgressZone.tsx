'use client';

import StreakBanner from './StreakBanner';
import TodayActivity from './TodayActivity';
import AddCourseCard from './AddCourseCard';

interface ProgressZoneProps {
  // Streak data
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string | null;
  todayBadge?: {
    icon: string;
    name: string;
  } | null;

  // Total lifetime stats
  totalQuizzes?: number;
  totalPoints?: number;

  // Today's activity stats
  todayStats: {
    quizzesCompleted: number;
    questionsAnswered: number;
    pointsEarned: number;
    accuracy: number;
  };

  // Quiz availability
  hasQuizAvailable?: boolean;
  onStartQuiz?: () => void;
  onChooseChapter?: () => void;

  // Upload
  onUploadClick?: () => void;
}

/**
 * ProgressZone - Main gamified progress area for the dashboard
 *
 * Combines three sections into one unified card:
 * 1. StreakBanner - Top band showing streak stats and mascot
 * 2. TodayActivity - Middle section with daily stats and CTA
 * 3. AddCourseCard - Bottom section for uploading new courses
 */
export default function ProgressZone({
  currentStreak,
  longestStreak,
  lastActivityDate,
  todayBadge,
  totalQuizzes = 0,
  totalPoints = 0,
  todayStats,
  hasQuizAvailable = false,
  onStartQuiz,
  onChooseChapter,
  onUploadClick,
}: ProgressZoneProps) {
  return (
    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Top Band: Streak Banner */}
      <StreakBanner
        currentStreak={currentStreak}
        longestStreak={longestStreak}
        lastActivityDate={lastActivityDate}
        todayBadge={todayBadge}
        totalQuizzes={totalQuizzes}
        totalPoints={totalPoints}
      />

      {/* Middle Section: Today's Activity */}
      <TodayActivity
        stats={todayStats}
        hasQuizAvailable={hasQuizAvailable}
        onStartQuiz={onStartQuiz}
        onChooseChapter={onChooseChapter}
      />

      {/* Bottom Band: Add Course CTA */}
      <AddCourseCard onUploadClick={onUploadClick} />
    </div>
  );
}
