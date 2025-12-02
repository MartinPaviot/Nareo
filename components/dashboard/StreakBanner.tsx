'use client';

import Image from 'next/image';
import { Flame, Trophy, BookOpen, Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type MascotMood = 'happy' | 'neutral' | 'disappointed';

interface StreakBannerProps {
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
}

const MASCOT_IMAGES: Record<MascotMood, string> = {
  happy: '/chat/Happy.png',
  neutral: '/chat/Drag_and_Drop.png',
  disappointed: '/chat/Disappointed.png',
};

/**
 * Determines mascot mood based on streak status
 * - Streak 0 after having one → disappointed
 * - Streak 1-3 → happy
 * - Streak 0 (never started) → neutral
 * - Streak 4+ → happy
 */
function getMascotMood(currentStreak: number, longestStreak: number): MascotMood {
  if (currentStreak === 0 && longestStreak > 0) {
    return 'disappointed';
  }
  if (currentStreak === 0) {
    return 'neutral';
  }
  return 'happy';
}

export default function StreakBanner({
  currentStreak,
  longestStreak,
  lastActivityDate,
  todayBadge,
  totalQuizzes = 0,
  totalPoints = 0,
}: StreakBannerProps) {
  const { translate } = useLanguage();
  const mood = getMascotMood(currentStreak, longestStreak);
  const mascotSrc = MASCOT_IMAGES[mood];

  return (
    <div className="bg-gradient-to-r from-orange-50 via-orange-100/50 to-orange-50 rounded-t-3xl px-2 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sm:gap-4">
      {/* Stats - Distributed horizontally */}
      <div className="flex-1 flex items-center justify-between sm:flex-wrap sm:gap-y-2">
        {/* Current Streak */}
        <div className="flex items-center gap-1 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-orange-500 flex items-center justify-center">
            <Flame className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium hidden sm:block">{translate('streak_current')}</p>
            <p className="text-xs sm:text-lg font-bold text-orange-600">
              {currentStreak}<span className="hidden sm:inline"> {translate('streak_days')}</span>
            </p>
          </div>
        </div>

        {/* Longest Streak */}
        <div className="flex items-center gap-1 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Trophy className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium hidden sm:block">{translate('streak_record')}</p>
            <p className="text-xs sm:text-lg font-bold text-purple-700">
              {longestStreak}<span className="hidden sm:inline"> {translate('streak_days')}</span>
            </p>
          </div>
        </div>

        {/* Total Quizzes */}
        <div className="flex items-center gap-1 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium hidden sm:block">{translate('stats_total_quizzes')}</p>
            <p className="text-xs sm:text-lg font-bold text-orange-600">
              {totalQuizzes}
            </p>
          </div>
        </div>

        {/* Total Points */}
        <div className="flex items-center gap-1 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Star className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium hidden sm:block">{translate('stats_total_points')}</p>
            <p className="text-xs sm:text-lg font-bold text-amber-600">
              {totalPoints.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Today's Badge (if any) - Hidden on mobile */}
        {todayBadge && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-yellow-100 rounded-full border border-yellow-200">
            <span className="text-lg">{todayBadge.icon}</span>
            <span className="text-sm font-semibold text-yellow-800">{todayBadge.name}</span>
          </div>
        )}
      </div>

      {/* Right: Mascot - Smaller on mobile */}
      <div className="flex-shrink-0 relative -my-2 sm:-my-4 -mr-1 sm:-mr-3">
        <Image
          src={mascotSrc}
          alt="Nareo mascot"
          width={112}
          height={112}
          className="w-14 h-14 sm:w-28 sm:h-28 object-contain drop-shadow-lg"
        />
        {mood === 'happy' && currentStreak >= 3 && (
          <div className="absolute top-0 right-0 sm:top-2 sm:right-2 w-4 h-4 sm:w-6 sm:h-6 bg-orange-500 rounded-full flex items-center justify-center animate-bounce">
            <Flame className="w-2.5 h-2.5 sm:w-4 sm:h-4 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
