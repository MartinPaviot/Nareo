'use client';

import { ConceptData, PhaseProgress } from '@/types/concept.types';
import { getDifficultyEmoji, getBadgeEmoji, cn } from '@/lib/utils';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import PhaseIndicator from './PhaseIndicator';

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
            <h3 className="font-semibold text-gray-900 text-lg">
              {concept.title}
            </h3>
            {isLocked && <Lock className="w-4 h-4 text-gray-400" />}
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
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : (
            <Circle className="w-6 h-6 text-gray-300" />
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Progress</span>
            <span className="text-xs font-semibold text-gray-900">
              {progress.totalScore}/100
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
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
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-600 mb-1">Key concepts:</p>
          <ul className="text-xs text-gray-700 space-y-1">
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
