'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Settings } from 'lucide-react';
import type { DailyGoalLevel } from '@/lib/stats/types';
import { DAILY_GOAL_CONFIG } from '@/lib/stats/constants';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import ProgressCircle from './ProgressCircle';
import GoalLevelSelector from './GoalLevelSelector';

interface DailyGoalCardProps {
  current: number;
  target: number;
  completed: boolean;
  goalLevel: DailyGoalLevel;
  onGoalLevelChange?: (level: DailyGoalLevel) => void;
}

export default function DailyGoalCard({
  current,
  target,
  completed,
  goalLevel,
  onGoalLevelChange,
}: DailyGoalCardProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  const progress = Math.min(100, Math.round((current / target) * 100));
  const config = DAILY_GOAL_CONFIG[goalLevel];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-2xl p-5 border relative overflow-hidden ${
          completed
            ? ''
            : isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-100'
        }`}
        style={completed ? {
          backgroundColor: isDark ? 'rgba(55, 159, 90, 0.2)' : 'rgba(55, 159, 90, 0.1)',
          borderColor: isDark ? 'rgba(55, 159, 90, 0.5)' : 'rgba(55, 159, 90, 0.3)'
        } : {}}
      >
        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors ${
            isDark ? 'hover:bg-neutral-700' : 'hover:bg-gray-100'
          }`}
        >
          <Settings className={`w-4 h-4 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
        </button>

        <div className="flex items-center gap-5">
          {/* Progress circle */}
          <ProgressCircle
            progress={progress}
            size={100}
            strokeWidth={8}
            progressColor={completed ? '#379f5a' : '#F97316'}
            backgroundColor={isDark ? '#262626' : '#E5E7EB'}
          >
            {completed ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Check className="w-8 h-8" style={{ color: '#379f5a' }} />
              </motion.div>
            ) : (
              <div className="text-center">
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{current}</p>
                <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>/ {target}</p>
              </div>
            )}
          </ProgressCircle>

          {/* Info */}
          <div className="flex-1">
            <h3 className={`text-sm font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{translate('stats_daily_goal_title')}</h3>
            <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`} style={completed ? { color: '#379f5a' } : {}}>
              {completed
                ? (current > target
                    ? translate('stats_daily_goal_extra', { count: String(current - target) })
                    : translate('stats_daily_goal_completed'))
                : translate('stats_daily_goal_remaining', { count: String(target - current) })}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-lg">{config.emoji}</span>
              <span className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {config.label} ({config.timeEstimate})
              </span>
            </div>
          </div>
        </div>

        {/* Completion celebration */}
        <AnimatePresence>
          {completed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-center"
            >
              <p className="text-sm font-medium" style={{ color: '#379f5a' }}>
                {translate('stats_label_xp_bonus')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Goal Level Selector Modal */}
      <AnimatePresence>
        {showSettings && (
          <GoalLevelSelector
            currentLevel={goalLevel}
            onSelect={(level) => {
              onGoalLevelChange?.(level);
              setShowSettings(false);
            }}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
