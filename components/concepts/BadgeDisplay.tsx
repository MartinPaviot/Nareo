'use client';

import { BadgeType } from '@/types/concept.types';
import { getBadgeEmoji } from '@/lib/utils';
import { Trophy } from 'lucide-react';

interface BadgeDisplayProps {
  badge: BadgeType;
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function BadgeDisplay({ badge, score, size = 'md' }: BadgeDisplayProps) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
  };

  const containerSizes = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  if (!badge) {
    return (
      <div className={`${containerSizes[size]} flex items-center justify-center`}>
        <div className="text-gray-300">
          <Trophy className="w-full h-full" />
        </div>
      </div>
    );
  }

  const badgeColors = {
    bronze: 'from-amber-400 to-amber-600',
    silver: 'from-gray-300 to-gray-500',
    gold: 'from-yellow-400 to-yellow-600',
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${containerSizes[size]} relative`}>
        {/* Glow effect */}
        <div className={`absolute inset-0 bg-gradient-to-br ${badgeColors[badge]} rounded-full blur-xl opacity-50 animate-pulse-slow`}></div>
        
        {/* Badge */}
        <div className={`relative ${containerSizes[size]} bg-gradient-to-br ${badgeColors[badge]} rounded-full flex items-center justify-center shadow-lg`}>
          <span className={sizeClasses[size]}>
            {getBadgeEmoji(badge)}
          </span>
        </div>
      </div>
      
      {/* Score */}
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-900">{score}</p>
        <p className="text-sm text-gray-600">points</p>
      </div>
    </div>
  );
}
