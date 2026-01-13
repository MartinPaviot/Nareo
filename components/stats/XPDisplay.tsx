'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { getXPLevel, getXPProgress, getXPToNextLevel, formatNumber } from '@/lib/stats/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

interface XPDisplayProps {
  totalXP: number;
  showProgress?: boolean;
  compact?: boolean;
}

export default function XPDisplay({ totalXP, showProgress = true, compact = false }: XPDisplayProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const currentLevel = getXPLevel(totalXP);
  const progress = getXPProgress(totalXP);
  const xpToNext = getXPToNextLevel(totalXP);

  if (compact) {
    return (
      <div className={`rounded-md px-2 py-1.5 border shadow-sm text-center ${
        isDark
          ? 'bg-neutral-800 border-neutral-700'
          : 'bg-white border-gray-100'
      }`}>
        <div className="flex items-center justify-center gap-1 mb-0">
          <Star className="w-3 h-3 text-orange-500" />
          <span className={`text-[11px] font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{translate('stats_label_level')}</span>
        </div>
        <p className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{currentLevel.level}</p>
        <p className={`text-[11px] leading-tight ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>{formatNumber(totalXP)} XP</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-5 text-white"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm text-white/80">{translate('stats_label_level')} {currentLevel.level}</p>
            <p className="text-lg font-bold">{currentLevel.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatNumber(totalXP)}</p>
          <p className="text-sm text-white/80">{translate('stats_xp_total')}</p>
        </div>
      </div>

      {showProgress && xpToNext > 0 && (
        <div>
          <div className="flex justify-between text-xs text-white/80 mb-1">
            <span>{translate('stats_xp_next_level')}</span>
            <span>{translate('stats_xp_remaining', { count: formatNumber(xpToNext) })}</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-white rounded-full"
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
