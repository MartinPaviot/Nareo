'use client';

import { motion } from 'framer-motion';
import type { MasteryLevel } from '@/lib/stats/types';
import { MASTERY_CONFIG } from '@/lib/stats/constants';
import { getPrecision } from '@/lib/stats/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

// Mapping mastery levels to translation keys
const MASTERY_LEVEL_KEYS: Record<MasteryLevel, string> = {
  not_started: 'mastery_not_started',
  discovery: 'mastery_discovery',
  learning: 'mastery_learning',
  acquired: 'mastery_acquired',
  mastered: 'mastery_mastered',
};

interface MasteryBarProps {
  chapterTitle: string;
  masteryLevel: MasteryLevel;
  totalQuestions: number;
  correctAnswers: number;
  daysUntilDegradation?: number | null;
  compact?: boolean;
}

export default function MasteryBar({
  chapterTitle,
  masteryLevel,
  totalQuestions,
  correctAnswers,
  daysUntilDegradation,
  compact = false,
}: MasteryBarProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const config = MASTERY_CONFIG[masteryLevel];
  const precision = getPrecision(correctAnswers, totalQuestions);
  const isInDanger = daysUntilDegradation !== null && daysUntilDegradation !== undefined && daysUntilDegradation <= 2 && daysUntilDegradation > 0;

  return (
    <div className={`${compact ? 'py-2' : 'py-3'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`font-medium ${isDark ? 'text-neutral-200' : 'text-gray-900'} ${compact ? 'text-sm' : 'text-base'} truncate max-w-[200px]`}>
          {chapterTitle}
        </span>
        <div className="flex items-center gap-2">
          {isInDanger && (
            <span className="text-xs font-medium" style={{ color: '#d91a1c' }}>
              {daysUntilDegradation}j
            </span>
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full`}
            style={{ backgroundColor: masteryLevel === 'discovery' ? '#fff6f3' : config.color + '20', color: config.color }}
          >
            {translate(MASTERY_LEVEL_KEYS[masteryLevel])}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-neutral-700' : 'bg-gray-100'}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${precision}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: config.color }}
          />
        </div>
        <span className={`text-xs w-10 text-right ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{precision}%</span>
      </div>
    </div>
  );
}
