'use client';

import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import type { StreakState } from '@/lib/stats/types';
import { STREAK_COLORS } from '@/lib/stats/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import ProgressCircle from './ProgressCircle';
import StreakFlame from './StreakFlame';
import StreakFreezeIndicator from './StreakFreezeIndicator';
import { useStreakCountdown } from '@/hooks/useStreakCountdown';

// Couleurs du cercle selon l'état (light mode)
const CIRCLE_COLORS_LIGHT: Record<StreakState, { progress: string; background: string }> = {
  on_fire: { progress: '#F97316', background: '#FED7AA' },
  at_risk: { progress: '#EAB308', background: '#FEF3C7' },
  lost: { progress: '#9CA3AF', background: '#E5E7EB' },
  protected: { progress: '#3B82F6', background: '#BFDBFE' },
  new_user: { progress: '#9CA3AF', background: '#E5E7EB' },
};

// Couleurs du cercle selon l'état (dark mode)
const CIRCLE_COLORS_DARK: Record<StreakState, { progress: string; background: string }> = {
  on_fire: { progress: '#F97316', background: '#431407' },
  at_risk: { progress: '#EAB308', background: '#422006' },
  lost: { progress: '#6B7280', background: '#262626' },
  protected: { progress: '#3B82F6', background: '#1e3a5f' },
  new_user: { progress: '#6B7280', background: '#262626' },
};

// Couleurs du fond de la card en dark mode
const DARK_CARD_COLORS: Record<StreakState, { bg: string; border: string }> = {
  on_fire: { bg: 'bg-orange-950/50', border: 'border-orange-800' },
  at_risk: { bg: 'bg-yellow-950/50', border: 'border-yellow-800' },
  lost: { bg: 'bg-neutral-800', border: 'border-neutral-700' },
  protected: { bg: 'bg-blue-950/50', border: 'border-blue-800' },
  new_user: { bg: 'bg-neutral-800', border: 'border-neutral-700' },
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
  const { isDark } = useTheme();
  const timeLeft = useStreakCountdown();
  const colors = STREAK_COLORS[state];
  const darkColors = DARK_CARD_COLORS[state];
  const circleColors = isDark ? CIRCLE_COLORS_DARK[state] : CIRCLE_COLORS_LIGHT[state];

  // Calculer la progression du cercle basée sur le temps restant dans la journée
  // Le cercle se remplit quand l'utilisateur a validé son streak aujourd'hui
  const progress = state === 'on_fire' || state === 'protected' ? 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-3 border relative overflow-hidden ${
        isDark
          ? `${darkColors.bg} ${darkColors.border}`
          : `${colors.bg} ${colors.border}`
      }`}
    >
      {/* Background decoration */}
      {state === 'on_fire' && !isDark && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-100/50 to-transparent" />
      )}

      {/* Streak Freeze indicator - top right */}
      <div className="absolute top-2.5 right-2.5">
        <StreakFreezeIndicator count={freezesAvailable} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3">
          {/* Circle with flame inside */}
          <ProgressCircle
            progress={progress}
            size={64}
            strokeWidth={6}
            progressColor={circleColors.progress}
            backgroundColor={circleColors.background}
          >
            <StreakFlame state={state} size="md" />
          </ProgressCircle>

          {/* Info */}
          <div className="flex-1">
            <h3 className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{translate('streak_label')}</h3>
            <div className="flex items-center gap-1.5">
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {currentStreak} {translate('streak_days')}
              </p>
              {/* Record badge */}
              {currentStreak > 0 && currentStreak >= longestStreak && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full ${
                    isDark ? 'bg-orange-900/50' : 'bg-orange-100'
                  }`}
                >
                  <span className={`text-[10px] font-semibold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{translate('streak_personal_record')}</span>
                </motion.div>
              )}
            </div>
            {/* Timer */}
            <div className="mt-1 flex items-center gap-1.5">
              <Clock className={`w-3 h-3 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`} />
              <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {translate('streak_time_remaining')}: <span className="font-mono font-semibold">{timeLeft}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
