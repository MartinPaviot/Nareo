'use client';

import { PhaseProgress, LEARNING_PHASES } from '@/types/concept.types';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhaseIndicatorProps {
  phases: PhaseProgress[];
}

export default function PhaseIndicator({ phases }: PhaseIndicatorProps) {
  return (
    <div className="space-y-2">
      {LEARNING_PHASES.map((phaseInfo) => {
        const phaseProgress = phases.find(p => p.phase === phaseInfo.phase);
        const isCompleted = phaseProgress?.completed || false;
        const score = phaseProgress?.score || 0;
        const maxScore = phaseInfo.points;

        return (
          <div key={phaseInfo.phase} className="flex items-center gap-2">
            {/* Phase Icon */}
            <div className="flex-shrink-0">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : phaseProgress ? (
                <Circle className="w-4 h-4 text-orange-400" />
              ) : (
                <Lock className="w-4 h-4 text-gray-300" />
              )}
            </div>

            {/* Phase Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  'text-xs font-medium',
                  isCompleted ? 'text-green-700' : 'text-gray-700'
                )}>
                  Phase {phaseInfo.phase}: {phaseInfo.name}
                </span>
                <span className="text-xs text-gray-600">
                  {score}/{maxScore}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    isCompleted 
                      ? 'bg-green-500' 
                      : 'bg-orange-400'
                  )}
                  style={{ width: `${(score / maxScore) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
