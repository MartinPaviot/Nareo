'use client';

import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import type { DailyGoalLevel } from '@/lib/stats/types';
import { DAILY_GOAL_CONFIG } from '@/lib/stats/constants';

interface GoalLevelSelectorProps {
  currentLevel: DailyGoalLevel;
  onSelect: (level: DailyGoalLevel) => void;
  onClose: () => void;
}

export default function GoalLevelSelector({
  currentLevel,
  onSelect,
  onClose,
}: GoalLevelSelectorProps) {
  const levels: DailyGoalLevel[] = ['tranquille', 'standard', 'intensif'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Objectif quotidien</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Choisis le niveau qui correspond a ton rythme de revision.
        </p>

        <div className="space-y-3">
          {levels.map((level) => {
            const config = DAILY_GOAL_CONFIG[level];
            const isSelected = level === currentLevel;

            return (
              <button
                key={level}
                onClick={() => onSelect(level)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config.emoji}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{config.label}</p>
                      <p className="text-sm text-gray-500">
                        {config.base} questions/jour - {config.timeEstimate}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">
          L'objectif s'adapte automatiquement a ton historique et aux weekends.
        </p>
      </motion.div>
    </motion.div>
  );
}
