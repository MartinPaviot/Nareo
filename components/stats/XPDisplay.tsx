'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { getXPLevel, getXPProgress, getXPToNextLevel, formatNumber } from '@/lib/stats/utils';

interface XPDisplayProps {
  totalXP: number;
  showProgress?: boolean;
  compact?: boolean;
}

export default function XPDisplay({ totalXP, showProgress = true, compact = false }: XPDisplayProps) {
  const currentLevel = getXPLevel(totalXP);
  const progress = getXPProgress(totalXP);
  const xpToNext = getXPToNextLevel(totalXP);

  if (compact) {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Star className="w-4 h-4 text-orange-500" />
          <span className="text-xs text-gray-500 font-medium">Niveau</span>
        </div>
        <p className="text-xl font-bold text-gray-900">{currentLevel.level}</p>
        <p className="text-xs text-gray-400">{formatNumber(totalXP)} XP</p>
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
            <p className="text-sm text-white/80">Niveau {currentLevel.level}</p>
            <p className="text-lg font-bold">{currentLevel.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{formatNumber(totalXP)}</p>
          <p className="text-sm text-white/80">XP total</p>
        </div>
      </div>

      {showProgress && xpToNext > 0 && (
        <div>
          <div className="flex justify-between text-xs text-white/80 mb-1">
            <span>Prochain niveau</span>
            <span>{formatNumber(xpToNext)} XP restants</span>
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
