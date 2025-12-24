'use client';

import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import type { StreakState } from '@/lib/stats/types';
import { STREAK_COLORS } from '@/lib/stats/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import ProgressCircle from './ProgressCircle';
import StreakFlame from './StreakFlame';
import StreakFreezeIndicator from './StreakFreezeIndicator';
import { useStreakCountdown } from '@/hooks/useStreakCountdown';

// Couleurs du cercle selon l'état
const CIRCLE_COLORS: Record<StreakState, { progress: string; background: string }> = {
  on_fire: { progress: '#F97316', background: '#FED7AA' },
  at_risk: { progress: '#EAB308', background: '#FEF3C7' },
  lost: { progress: '#9CA3AF', background: '#E5E7EB' },
  protected: { progress: '#3B82F6', background: '#BFDBFE' },
  new_user: { progress: '#9CA3AF', background: '#E5E7EB' },
};

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
  const { translate } = useLanguage();
  const timeLeft = useStreakCountdown();
  const colors = STREAK_COLORS[state];
  const circleColors = CIRCLE_COLORS[state];

  // Calculer la progression du cercle basée sur le temps restant dans la journée
  // Le cercle se remplit quand l'utilisateur a validé son streak aujourd'hui
  const progress = state === 'on_fire' || state === 'protected' ? 100 : 0;

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

      {/* Streak Freeze indicator - top right */}
      <div className="absolute top-4 right-4">
        <StreakFreezeIndicator count={freezesAvailable} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-5">
          {/* Circle with flame inside */}
          <ProgressCircle
            progress={progress}
            size={100}
            strokeWidth={8}
            progressColor={circleColors.progress}
            backgroundColor={circleColors.background}
          >
            <StreakFlame state={state} size="lg" />
          </ProgressCircle>

          {/* Info */}
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-500">{translate('streak_label')}</h3>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-gray-900">
                {currentStreak} {translate('streak_days')}
              </p>
              {/* Record badge */}
              {currentStreak > 0 && currentStreak >= longestStreak && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 rounded-full"
                >
                  <span className="text-xs font-semibold text-orange-600">{translate('streak_personal_record')}</span>
                </motion.div>
              )}
            </div>
            {/* Timer */}
            <div className="mt-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {translate('streak_time_remaining')}: <span className="font-mono font-semibold">{timeLeft}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
