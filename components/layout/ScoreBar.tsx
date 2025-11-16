'use client';

import { Trophy, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreBarProps {
  totalScore: number;
  maxScore: number;
  conceptsCompleted: number;
  totalConcepts: number;
  streak?: number;
}

export default function ScoreBar({ 
  totalScore, 
  maxScore, 
  conceptsCompleted, 
  totalConcepts,
  streak = 0 
}: ScoreBarProps) {
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  const hasStreak = streak >= 3;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 md:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Score Progress */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">
              Overall Progress
            </span>
            <span className="text-sm font-bold text-gray-900">
              {totalScore}/{maxScore}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={cn(
                'h-3 rounded-full transition-all duration-500',
                percentage >= 80 
                  ? 'bg-gradient-to-r from-green-400 to-green-600'
                  : percentage >= 50
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                  : 'bg-gradient-to-r from-orange-400 to-orange-600'
              )}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          {/* Concepts Completed */}
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-500" />
            <div className="text-sm">
              <span className="font-bold text-gray-900">{conceptsCompleted}</span>
              <span className="text-gray-600">/{totalConcepts}</span>
            </div>
          </div>

          {/* Streak */}
          {hasStreak && (
            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 border border-yellow-200 rounded-full">
              <Star className="w-4 h-4 text-yellow-600 fill-yellow-600" />
              <span className="text-sm font-bold text-yellow-700">
                {streak} streak! 🔥
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
