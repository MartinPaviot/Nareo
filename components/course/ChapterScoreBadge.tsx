'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChapterScoreBadgeProps {
  scorePts: number;
  maxPts: number;
}

type ScoreLevel = 'low' | 'medium' | 'high';

interface LevelConfig {
  mascotSrc: string;
  mascotAlt: string;
  badgeBg: string;
  badgeText: string;
  tooltipKey: string;
}

const LEVEL_CONFIGS: Record<ScoreLevel, LevelConfig> = {
  low: {
    mascotSrc: '/chat/Disappointed.png',
    mascotAlt: 'Mascotte triste',
    badgeBg: 'bg-red-100 border border-red-200',
    badgeText: 'text-red-700',
    tooltipKey: 'chapter_score_tooltip_low',
  },
  medium: {
    mascotSrc: '/chat/Drag_and_Drop.png',
    mascotAlt: 'Mascotte neutre',
    badgeBg: 'bg-orange-100 border border-orange-200',
    badgeText: 'text-orange-700',
    tooltipKey: 'chapter_score_tooltip_medium',
  },
  high: {
    mascotSrc: '/chat/Happy.png',
    mascotAlt: 'Mascotte heureuse',
    badgeBg: 'bg-emerald-100 border border-emerald-200',
    badgeText: 'text-emerald-700',
    tooltipKey: 'chapter_score_tooltip_high',
  },
};

export default function ChapterScoreBadge({ scorePts, maxPts }: ChapterScoreBadgeProps) {
  const { translate } = useLanguage();
  const [showTooltip, setShowTooltip] = useState(false);

  const { level, config, percentage } = useMemo(() => {
    const pct = maxPts > 0 ? scorePts / maxPts : 0;
    let lvl: ScoreLevel;

    if (pct < 0.4) {
      lvl = 'low';
    } else if (pct < 0.8) {
      lvl = 'medium';
    } else {
      lvl = 'high';
    }

    return {
      level: lvl,
      config: LEVEL_CONFIGS[lvl],
      percentage: Math.round(pct * 100),
    };
  }, [scorePts, maxPts]);

  return (
    <div
      className="relative flex items-center gap-2 mt-1 group cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Mascotte */}
      <Image
        src={config.mascotSrc}
        alt={config.mascotAlt}
        width={72}
        height={72}
        className="object-contain flex-shrink-0 drop-shadow-md"
      />

      {/* Badge score */}
      <span
        className={`
          inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold
          transition-all duration-200 shadow-sm
          group-hover:shadow-md group-hover:scale-[1.02]
          ${config.badgeBg} ${config.badgeText}
        `}
      >
        {scorePts} / {maxPts} {translate('learn_pts')}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="
            absolute bottom-full right-0 mb-2 px-3 py-1.5
            bg-gray-900 text-white text-xs rounded-lg
            whitespace-nowrap z-50 shadow-lg
            animate-in fade-in duration-150
          "
        >
          {translate(config.tooltipKey)}
          {/* Flèche */}
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
