'use client';

import { ConceptData, PhaseProgress } from '@/types/concept.types';
import { getDifficultyEmoji, getBadgeEmoji, cn } from '@/lib/utils';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import PhaseIndicator from './PhaseIndicator';
import { useTheme } from '@/contexts/ThemeContext';

interface ConceptCardProps {
  concept: ConceptData;
  progress?: {
    phases: PhaseProgress[];
    totalScore: number;
    badge: 'bronze' | 'silver' | 'gold' | null;
    completed: boolean;
  };
  isLocked?: boolean;
  onClick?: () => void;
}

export default function ConceptCard({
  concept,
  progress,
  isLocked = false,
  onClick
}: ConceptCardProps) {
  const { isDark } = useTheme();

  return (
    <div
      onClick={!isLocked ? onClick : undefined}
      className={cn(
        'concept-card',
        !isLocked && onClick && 'cursor-pointer hover:border-orange-300',
        isLocked && 'opacity-60 cursor-not-allowed'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={cn('font-semibold text-lg', isDark ? 'text-gray-100' : 'text-gray-900')}>
              {concept.title}
            </h3>
            {isLocked && <Lock className={cn('w-4 h-4', isDark ? 'text-gray-500' : 'text-gray-400')} />}
          </div>
          
          {/* Achievement Badge */}
          <div className="flex items-center gap-2">
            {progress?.badge && (
              <span className={cn(
                'px-2 py-1 rounded-lg text-xs font-medium border',
                progress.badge === 'gold' && 'badge-gold',
                progress.badge === 'silver' && 'badge-silver',
                progress.badge === 'bronze' && 'badge-bronze'
              )}>
                {getBadgeEmoji(progress.badge)} {progress.badge}
              </span>
            )}
          </div>
        </div>

        {/* Completion Status */}
        <div className="flex-shrink-0">
          {progress?.completed ? (
            <CheckCircle2 className={cn('w-6 h-6', isDark ? 'text-green-400' : 'text-green-500')} />
          ) : (
            <Circle className={cn('w-6 h-6', isDark ? 'text-gray-600' : 'text-gray-300')} />
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>Progress</span>
            <span className={cn('text-xs font-semibold', isDark ? 'text-gray-100' : 'text-gray-900')}>
              {progress.totalScore}/100
            </span>
          </div>
          <div className={cn('w-full rounded-full h-2', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
            <div
              className="bg-gradient-to-r from-orange-400 to-orange-600 h-2 rounded-full transition-all"
              style={{ width: `${progress.totalScore}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Phase Indicators */}
      {progress && (
        <PhaseIndicator phases={progress.phases} />
      )}

      {/* Key Ideas Preview */}
      {!isLocked && concept.keyIdeas && concept.keyIdeas.length > 0 && (
        <div className={cn('mt-3 pt-3 border-t', isDark ? 'border-gray-700' : 'border-gray-100')}>
          <p className={cn('text-xs mb-1', isDark ? 'text-gray-400' : 'text-gray-600')}>Key concepts:</p>
          <ul className={cn('text-xs space-y-1', isDark ? 'text-gray-300' : 'text-gray-700')}>
            {concept.keyIdeas.slice(0, 2).map((idea, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-orange-500 mt-0.5">•</span>
                <span className="line-clamp-1">{idea}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
