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
    <div className={`${compact ? 'py-1' : 'py-2'}`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className={`font-medium ${isDark ? 'text-neutral-200' : 'text-gray-900'} ${compact ? 'text-xs' : 'text-sm'} truncate max-w-[200px]`}>
          {chapterTitle}
        </span>
        <div className="flex items-center gap-1.5">
          {isInDanger && (
            <span className="text-[10px] font-medium" style={{ color: '#d91a1c' }}>
              {daysUntilDegradation}j
            </span>
          )}
          <span
            className={`text-[10px] font-medium px-1.5 py-0 rounded-full`}
            style={{ backgroundColor: masteryLevel === 'discovery' ? '#fff6f3' : config.color + '20', color: config.color }}
          >
            {translate(MASTERY_LEVEL_KEYS[masteryLevel])}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-700' : 'bg-gray-100'}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${precision}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: config.color }}
          />
        </div>
        <span className={`text-[10px] w-8 text-right ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{precision}%</span>
      </div>
    </div>
  );
}
