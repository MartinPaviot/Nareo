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
  activityUnits: number;  // Unified activity units (quiz + flashcards)
  target: number;
  completed: boolean;
  goalLevel: DailyGoalLevel;
  onGoalLevelChange?: (level: DailyGoalLevel) => void;
}

export default function DailyGoalCard({
  activityUnits,
  target: _target,
  completed: _completedFromApi,
  goalLevel,
  onGoalLevelChange,
}: DailyGoalCardProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  const config = DAILY_GOAL_CONFIG[goalLevel];
  // Use the fixed target from config to ensure immediate update when level changes
  const target = config.base;
  // Display activity units as integers
  const current = Math.floor(activityUnits);
  // Recalculate completed status client-side to handle edge cases
  const completed = activityUnits >= target;
  const progress = Math.min(100, Math.round((activityUnits / target) * 100));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-xl p-3 border relative overflow-hidden ${
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
          className={`absolute top-2.5 right-2.5 p-1 rounded-full transition-colors ${
            isDark ? 'hover:bg-neutral-700' : 'hover:bg-gray-100'
          }`}
        >
          <Settings className={`w-3.5 h-3.5 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
        </button>

        <div className="flex items-center gap-3">
          {/* Progress circle */}
          <ProgressCircle
            progress={progress}
            size={80}
            strokeWidth={7}
            progressColor={completed ? '#379f5a' : '#F97316'}
            backgroundColor={isDark ? '#262626' : '#E5E7EB'}
          >
            {completed ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Check className="w-6 h-6" style={{ color: '#379f5a' }} />
              </motion.div>
            ) : (
              <div className="text-center">
                <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{current}</p>
                <p className={`text-[12px] ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>/ {target}</p>
              </div>
            )}
          </ProgressCircle>

          {/* Info */}
          <div className="flex-1">
            <h3 className={`text-xs font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{translate('stats_daily_goal_title')}</h3>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`} style={completed ? { color: '#379f5a' } : {}}>
              {completed
                ? (current > target
                    ? translate('stats_daily_goal_extra', { count: String(current - target) })
                    : translate('stats_daily_goal_completed'))
                : translate('stats_daily_goal_remaining', { count: String(target - current) })}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-sm">{config.emoji}</span>
              <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {config.label} ({config.timeEstimate})
              </span>
            </div>
          </div>
        </div>

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
