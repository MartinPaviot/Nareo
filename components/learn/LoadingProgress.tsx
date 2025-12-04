'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { Check, Loader2 } from 'lucide-react';

export type LoadingStep =
  | 'memory'
  | 'chapters'
  | 'chapter'
  | 'progress'
  | 'questions'
  | 'ready';

interface LoadingProgressProps {
  currentStep: LoadingStep;
  showMascot?: boolean;
}

const STEPS: LoadingStep[] = ['memory', 'chapters', 'chapter', 'progress', 'questions', 'ready'];

export default function LoadingProgress({ currentStep, showMascot = true }: LoadingProgressProps) {
  const { translate } = useLanguage();

  const currentIndex = STEPS.indexOf(currentStep);
  const progressPercent = ((currentIndex + 1) / STEPS.length) * 100;

  const getStepLabel = (step: LoadingStep): string => {
    const labels: Record<LoadingStep, string> = {
      memory: translate('learn_loading_step_memory'),
      chapters: translate('learn_loading_step_chapters'),
      chapter: translate('learn_loading_step_chapter'),
      progress: translate('learn_loading_step_progress'),
      questions: translate('learn_loading_step_questions'),
      ready: translate('learn_loading_step_ready'),
    };
    return labels[step];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Mascot */}
        {showMascot && (
          <div className="flex justify-center mb-8">
            <img
              src="/chat/mascotte.png"
              alt="Nareo"
              className="w-32 h-32 animate-bounce"
            />
          </div>
        )}

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-800 text-center mb-6">
          {translate('learn_loading')}
        </h2>

        {/* Progress bar */}
        <div className="relative mb-8">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="absolute right-0 -top-6 text-sm text-gray-500">
            {Math.round(progressPercent)}%
          </span>
        </div>

        {/* Steps list */}
        <div className="space-y-3">
          {STEPS.map((step, index) => {
            const isComplete = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;

            return (
              <div
                key={step}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                  isCurrent
                    ? 'bg-orange-50 border border-orange-200'
                    : isComplete
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-100'
                }`}
              >
                {/* Status icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="text-xs font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Step label */}
                <span
                  className={`text-sm font-medium ${
                    isComplete
                      ? 'text-green-700'
                      : isCurrent
                      ? 'text-orange-700'
                      : 'text-gray-400'
                  }`}
                >
                  {getStepLabel(step)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
