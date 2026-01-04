'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Calendar, Flame, Crosshair, Trophy } from 'lucide-react';

interface DailyRitualCardProps {
  currentStreak: number;
  longestStreak: number;
  todayQuizzesCompleted: number;
  todayQuestionsAnswered: number;
  todayQuestionsCorrect: number;
  todayPointsEarned: number;
}

/**
 * Daily Ritual Card - Encourages users to maintain daily learning habits
 * Displays streak information and today's progress
 */
export default function DailyRitualCard({
  currentStreak,
  longestStreak,
  todayQuizzesCompleted,
  todayQuestionsAnswered,
  todayQuestionsCorrect,
  todayPointsEarned,
}: DailyRitualCardProps) {
  const { translate } = useLanguage();

  const hasActivityToday = todayQuizzesCompleted > 0;
  const accuracyPercentage =
    todayQuestionsAnswered > 0
      ? Math.round((todayQuestionsCorrect / todayQuestionsAnswered) * 100)
      : 0;

  return (
    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          <h3 className="text-lg font-bold">{translate('daily_ritual_title')}</h3>
        </div>
        {hasActivityToday && (
          <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-semibold">
              {translate('daily_ritual_completed')}
            </span>
          </div>
        )}
      </div>

      {/* Streak Display */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Current Streak */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center justify-center border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-8 h-8 text-yellow-300" />
            <span className="text-4xl font-bold">{currentStreak}</span>
          </div>
          <span className="text-sm opacity-90">{translate('daily_ritual_current_streak')}</span>
        </div>

        {/* Longest Streak */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center justify-center border border-white/20">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-6 h-6 text-yellow-300" />
            <span className="text-3xl font-bold">{longestStreak}</span>
          </div>
          <span className="text-sm opacity-90">{translate('daily_ritual_longest_streak')}</span>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
        <div className="flex items-center gap-2 mb-3">
          <Crosshair className="w-5 h-5" />
          <span className="font-semibold">{translate('daily_ritual_today')}</span>
        </div>

        {hasActivityToday ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="opacity-75 mb-1">{translate('daily_ritual_quizzes')}</p>
              <p className="text-2xl font-bold">{todayQuizzesCompleted}</p>
            </div>
            <div>
              <p className="opacity-75 mb-1">{translate('daily_ritual_points')}</p>
              <p className="text-2xl font-bold">{todayPointsEarned}</p>
            </div>
            <div>
              <p className="opacity-75 mb-1">{translate('daily_ritual_questions')}</p>
              <p className="text-2xl font-bold">{todayQuestionsAnswered}</p>
            </div>
            <div>
              <p className="opacity-75 mb-1">{translate('daily_ritual_accuracy')}</p>
              <p className="text-2xl font-bold">{accuracyPercentage}%</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm opacity-90 mb-2">
              {translate('daily_ritual_no_activity')}
            </p>
            <p className="text-xs opacity-75">{translate('daily_ritual_encouragement')}</p>
          </div>
        )}
      </div>

      {/* Motivational Message */}
      {currentStreak === 0 && (
        <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
          <p className="text-sm text-center opacity-90">
            {translate('daily_ritual_start_streak')}
          </p>
        </div>
      )}

      {currentStreak >= 7 && (
        <div className="mt-4 bg-yellow-400/20 backdrop-blur-sm rounded-xl p-3 border border-yellow-300/30">
          <p className="text-sm text-center font-semibold">
            {translate('daily_ritual_streak_milestone')}
          </p>
        </div>
      )}
    </div>
  );
}
