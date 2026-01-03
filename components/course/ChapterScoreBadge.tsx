'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';

interface ChapterScoreBadgeProps {
  scorePts: number;
  maxPts: number;
  compact?: boolean;
}

type ScoreLevel = 'low' | 'medium' | 'high';

interface LevelConfig {
  mascotSrc: string;
  color: string;
  darkColor: string;
}

const LEVEL_CONFIGS: Record<ScoreLevel, LevelConfig> = {
  low: {
    mascotSrc: '/chat/Disappointed.png',
    color: '#d91a1c',
    darkColor: '#e94446',
  },
  medium: {
    mascotSrc: '/chat/Drag_and_Drop.png',
    color: '#ea580c',
    darkColor: '#fb923c',
  },
  high: {
    mascotSrc: '/chat/Happy.png',
    color: '#379f5a',
    darkColor: '#5cb978',
  },
};

export default function ChapterScoreBadge({ scorePts, maxPts, compact = false }: ChapterScoreBadgeProps) {
  const { isDark } = useTheme();
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

  const textColor = isDark ? config.darkColor : config.color;

  // Compact mode for mobile - just the score text
  if (compact) {
    return (
      <span className="text-xs font-bold" style={{ color: textColor }}>
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
      <span className="text-sm font-bold" style={{ color: textColor }}>
        {scorePts}/{maxPts} pts
      </span>
    </div>
  );
}
