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
    <div className="bg-gradient-to-r from-orange-50 via-orange-100/50 to-orange-50 rounded-t-3xl px-4 sm:px-6 py-3 flex items-center gap-4">
      {/* Stats - Distributed horizontally */}
      <div className="flex-1 flex items-center justify-between flex-wrap gap-y-2">
        {/* Current Streak */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{translate('streak_current')}</p>
            <p className="text-lg font-bold text-orange-600">
              {currentStreak} {translate('streak_days')}
            </p>
          </div>
        </div>

        {/* Longest Streak */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{translate('streak_record')}</p>
            <p className="text-lg font-bold text-purple-700">
              {longestStreak} {translate('streak_days')}
            </p>
          </div>
        </div>

        {/* Total Quizzes */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{translate('stats_total_quizzes')}</p>
            <p className="text-lg font-bold text-orange-600">
              {totalQuizzes}
            </p>
          </div>
        </div>

        {/* Total Points */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{translate('stats_total_points')}</p>
            <p className="text-lg font-bold text-amber-600">
              {totalPoints.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Today's Badge (if any) */}
        {todayBadge && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 rounded-full border border-yellow-200">
            <span className="text-lg">{todayBadge.icon}</span>
            <span className="text-sm font-semibold text-yellow-800">{todayBadge.name}</span>
          </div>
        )}
      </div>

      {/* Right: Mascot - Larger and overflowing, pushed to the right */}
      <div className="flex-shrink-0 relative -my-4 -mr-3">
        <Image
          src={mascotSrc}
          alt="Nareo mascot"
          width={112}
          height={112}
          className="object-contain drop-shadow-lg"
        />
        {mood === 'happy' && currentStreak >= 3 && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center animate-bounce">
            <Flame className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
