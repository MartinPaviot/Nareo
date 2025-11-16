'use client';

import { useState } from 'react';
import { ConceptData, PhaseProgress } from '@/types/concept.types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, getDifficultyEmoji, getBadgeEmoji } from '@/lib/utils';

interface ConceptTrackerProps {
  concepts: Array<{
    concept: ConceptData;
    progress: {
      phases: PhaseProgress[];
      totalScore: number;
      badge: 'bronze' | 'silver' | 'gold' | null;
      completed: boolean;
    };
  }>;
  currentConceptId?: string;
  onConceptClick?: (conceptId: string) => void;
}

export default function ConceptTracker({ 
  concepts, 
  currentConceptId,
  onConceptClick 
}: ConceptTrackerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn(
        'hidden md:block fixed left-0 top-0 h-full bg-white border-r border-gray-200 transition-all duration-300 z-10',
        isCollapsed ? 'w-16' : 'w-80'
      )}>
        {/* Toggle Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 z-20"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          )}
        </button>

        {/* Content */}
        <div className="h-full overflow-y-auto p-4">
          {!isCollapsed ? (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Concept Tracker
              </h2>
              
              <div className="space-y-3">
                {concepts.map(({ concept, progress }) => (
                  <button
                    key={concept.id}
                    onClick={() => onConceptClick?.(concept.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all',
                      currentConceptId === concept.id
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-200 hover:bg-orange-50/50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900 line-clamp-2">
                        {concept.title}
                      </span>
                      {progress.badge && (
                        <span className="text-lg ml-2">
                          {getBadgeEmoji(progress.badge)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-600">
                        {getDifficultyEmoji(concept.difficulty)}
                      </span>
                      <span className="text-xs font-medium text-gray-700">
                        {progress.totalScore}/100
                      </span>
                    </div>
                    
                    {/* Mini Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-orange-400 to-orange-600 h-1.5 rounded-full"
                        style={{ width: `${progress.totalScore}%` }}
                      ></div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {concepts.map(({ concept, progress }) => (
                <button
                  key={concept.id}
                  onClick={() => onConceptClick?.(concept.id)}
                  className={cn(
                    'w-full p-2 rounded-lg border transition-all',
                    currentConceptId === concept.id
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-200'
                  )}
                  title={concept.title}
                >
                  <div className="text-center">
                    <div className="text-lg mb-1">
                      {getDifficultyEmoji(concept.difficulty)}
                    </div>
                    {progress.badge && (
                      <div className="text-sm">
                        {getBadgeEmoji(progress.badge)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="overflow-x-auto p-4">
          <div className="flex gap-3">
            {concepts.map(({ concept, progress }) => (
              <button
                key={concept.id}
                onClick={() => onConceptClick?.(concept.id)}
                className={cn(
                  'flex-shrink-0 w-24 p-3 rounded-xl border transition-all',
                  currentConceptId === concept.id
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-gray-200'
                )}
              >
                <div className="text-center">
                  <div className="text-2xl mb-1">
                    {getDifficultyEmoji(concept.difficulty)}
                  </div>
                  <p className="text-xs font-medium text-gray-900 line-clamp-2 mb-1">
                    {concept.title}
                  </p>
                  {progress.badge && (
                    <span className="text-lg">
                      {getBadgeEmoji(progress.badge)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
