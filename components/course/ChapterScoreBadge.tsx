'use client';

import { useMemo } from 'react';
import Image from 'next/image';

interface ChapterScoreBadgeProps {
  scorePts: number;
  maxPts: number;
  compact?: boolean;
}

type ScoreLevel = 'low' | 'medium' | 'high';

interface LevelConfig {
  mascotSrc: string;
  textColor: string;
}

const LEVEL_CONFIGS: Record<ScoreLevel, LevelConfig> = {
  low: {
    mascotSrc: '/chat/Disappointed.png',
    textColor: 'text-red-600 dark:text-red-400',
  },
  medium: {
    mascotSrc: '/chat/Drag_and_Drop.png',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
  high: {
    mascotSrc: '/chat/Happy.png',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
};

export default function ChapterScoreBadge({ scorePts, maxPts, compact = false }: ChapterScoreBadgeProps) {
  const { config } = useMemo(() => {
    const pct = maxPts > 0 ? (scorePts / maxPts) * 100 : 0;
    let lvl: ScoreLevel;

    if (pct >= 70) {
      lvl = 'high';
    } else if (pct >= 40) {
      lvl = 'medium';
    } else {
      lvl = 'low';
    }

    return {
      config: LEVEL_CONFIGS[lvl],
    };
  }, [scorePts, maxPts]);

  // Compact mode for mobile - just the score text
  if (compact) {
    return (
      <span className={`text-xs font-bold ${config.textColor}`}>
        {scorePts}/{maxPts} pts
      </span>
    );
  }

  // Desktop: mascot on top, score centered below
  return (
    <div className="flex flex-col items-center gap-1">
      <Image
        src={config.mascotSrc}
        alt="Score"
        width={48}
        height={48}
        className="object-contain"
      />
      <span className={`text-sm font-bold ${config.textColor}`}>
        {scorePts}/{maxPts} pts
      </span>
    </div>
  );
}
