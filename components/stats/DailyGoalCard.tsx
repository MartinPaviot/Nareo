'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Settings } from 'lucide-react';
import type { DailyGoalLevel } from '@/lib/stats/types';
import { DAILY_GOAL_CONFIG } from '@/lib/stats/constants';
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
            ? 'bg-green-50 border-green-200'
            : 'bg-white border-gray-100'
        }`}
      >
        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-400" />
        </button>

        <div className="flex items-center gap-5">
          {/* Progress circle */}
          <ProgressCircle
            progress={progress}
            size={100}
            strokeWidth={8}
            progressColor={completed ? '#22C55E' : '#F97316'}
          >
            {completed ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Check className="w-8 h-8 text-green-500" />
              </motion.div>
            ) : (
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{current}</p>
                <p className="text-xs text-gray-500">/ {target}</p>
              </div>
            )}
          </ProgressCircle>

          {/* Info */}
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-500">Objectif du jour</h3>
            <p className={`text-lg font-semibold ${completed ? 'text-green-600' : 'text-gray-900'}`}>
              {completed ? 'Objectif atteint !' : `${target - current} questions restantes`}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-lg">{config.emoji}</span>
              <span className="text-sm text-gray-500">
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
              <p className="text-sm text-green-600 font-medium">
                +25 XP bonus !
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
