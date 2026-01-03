'use client';

import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import type { DailyGoalLevel } from '@/lib/stats/types';
import { DAILY_GOAL_CONFIG } from '@/lib/stats/constants';
import { useLanguage } from '@/contexts/LanguageContext';

// Mapping des niveaux vers les clés de traduction
const LEVEL_TRANSLATION_KEYS: Record<DailyGoalLevel, { label: string; time: string }> = {
  tranquille: { label: 'daily_goal_level_relaxed', time: 'daily_goal_level_relaxed_time' },
  standard: { label: 'daily_goal_level_standard', time: 'daily_goal_level_standard_time' },
  intensif: { label: 'daily_goal_level_intensive', time: 'daily_goal_level_intensive_time' },
};

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
  const { translate } = useLanguage();
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
          <h2 className="text-xl font-bold text-gray-900">{translate('stats_daily_goal_selector_title')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          {translate('stats_daily_goal_selector_subtitle')}
        </p>

        <div className="space-y-3">
          {levels.map((level) => {
            const config = DAILY_GOAL_CONFIG[level];
            const translationKeys = LEVEL_TRANSLATION_KEYS[level];
            const isSelected = level === currentLevel;

            return (
              <button
                key={level}
                onClick={() => onSelect(level)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={isSelected ? { borderColor: '#ff751f' } : {}}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{config.emoji}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{translate(translationKeys.label)}</p>
                      <p className="text-sm text-gray-500">
                        {config.base} {translate('stats_daily_goal_questions_per_day')} - {translate(translationKeys.time)}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#ff751f' }}>
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">
          {translate('stats_daily_goal_selector_auto')}
        </p>
      </motion.div>
    </motion.div>
  );
}
