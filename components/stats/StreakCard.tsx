'use client';

import { motion } from 'framer-motion';
import type { StreakState } from '@/lib/stats/types';
import { STREAK_COLORS, STREAK_MESSAGES } from '@/lib/stats/constants';
import StreakFlame from './StreakFlame';
import StreakCountdown from './StreakCountdown';
import StreakFreezeIndicator from './StreakFreezeIndicator';

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  state: StreakState;
  freezesAvailable: number;
  previousStreakLost: number;
}

export default function StreakCard({
  currentStreak,
  longestStreak,
  state,
  freezesAvailable,
  previousStreakLost
}: StreakCardProps) {
  const colors = STREAK_COLORS[state];

  const getMessage = () => {
    const message = STREAK_MESSAGES[state];
    if (typeof message === 'function') {
      return message(previousStreakLost);
    }
    return message;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-5 border ${colors.bg} ${colors.border} relative overflow-hidden`}
    >
      {/* Background decoration */}
      {state === 'on_fire' && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-100/50 to-transparent" />
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <StreakFlame state={state} />
            <div>
              <h3 className={`text-sm font-medium ${colors.text}`}>Série</h3>
              <p className="text-3xl font-bold text-gray-900">
                {currentStreak} <span className="text-lg font-normal text-gray-500">jours</span>
              </p>
            </div>
          </div>

          {/* Streak Freeze indicator */}
          <StreakFreezeIndicator count={freezesAvailable} />
        </div>

        {/* Contextual message */}
        <div className={`text-sm ${colors.text} font-medium`}>
          {getMessage()}
        </div>

        {/* Countdown if at_risk */}
        {state === 'at_risk' && (
          <StreakCountdown />
        )}

        {/* Record */}
        {currentStreak > 0 && currentStreak >= longestStreak && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-orange-100 rounded-full"
          >
            <span className="text-xs font-semibold text-orange-600">Record personnel !</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
