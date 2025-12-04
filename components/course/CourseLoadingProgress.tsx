'use client';

import { useEffect, useState, useMemo } from 'react';
import { Check, Loader2, FileText, Brain, BookOpen, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type ProcessingStep = 'uploading' | 'extracting' | 'analyzing' | 'generating' | 'finalizing';

// Messages encourageants affichés pendant le chargement
const LOADING_MESSAGES = [
  "Un p'tit café le temps qu'on bosse ?",
  "Les quiz multiplient par 2 ta mémorisation à long terme. C'est pas nous, c'est Harvard.",
  "Ton futur toi te dit merci",
  "Relire c'est bien. Se tester c'est 50% plus efficace.",
  "Nareo révise pour toi... enfin presque",
  "Fun fact : ton cerveau retient mieux ce qu'il essaie de retrouver que ce qu'il relit",
  "On transforme ton cours en machine à neurones",
  "Spoiler : tu vas cartonner",
  "Savais-tu ? Se tester régulièrement réduit le stress des examens",
  "Chaque quiz renforce ta mémoire. Là, tu construis ton 20/20"
];

// Intervalle de rotation des messages (en secondes)
const MESSAGE_ROTATION_INTERVAL = 60;

interface CourseLoadingProgressProps {
  courseStatus: string; // 'pending' | 'processing' | 'ready' | 'failed'
  chaptersCount: number;
  courseTitle?: string;
}

const STEPS: ProcessingStep[] = ['uploading', 'extracting', 'analyzing', 'generating', 'finalizing'];

// Estimated time per step in seconds (total ~90s for first chapter ready)
// These are estimates - the actual progress is driven by courseStatus and chaptersCount
const STEP_DURATIONS: Record<ProcessingStep, number> = {
  uploading: 5,
  extracting: 15,
  analyzing: 25,
  generating: 35,
  finalizing: 10,
};

export default function CourseLoadingProgress({
  courseStatus,
  chaptersCount,
  courseTitle,
}: CourseLoadingProgressProps) {
  const { translate } = useLanguage();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [messageIndex, setMessageIndex] = useState(() => Math.floor(Math.random() * LOADING_MESSAGES.length));

  // Calculate overall progress
  const totalDuration = Object.values(STEP_DURATIONS).reduce((a, b) => a + b, 0);
  const overallProgress = Math.min(
    ((elapsedTime / totalDuration) * 100),
    chaptersCount > 0 ? 100 : 95 // Cap at 95% if no chapters yet
  );

  // Simulate progress based on elapsed time
  useEffect(() => {
    if (courseStatus === 'ready' || courseStatus === 'failed') {
      setCurrentStepIndex(STEPS.length - 1);
      setStepProgress(100);
      return;
    }

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 0.5);
    }, 500);

    return () => clearInterval(timer);
  }, [courseStatus]);

  // Calculate current step based on elapsed time
  useEffect(() => {
    let accumulated = 0;
    for (let i = 0; i < STEPS.length; i++) {
      const stepDuration = STEP_DURATIONS[STEPS[i]];
      if (elapsedTime < accumulated + stepDuration) {
        setCurrentStepIndex(i);
        setStepProgress(((elapsedTime - accumulated) / stepDuration) * 100);
        return;
      }
      accumulated += stepDuration;
    }
    // If we've exceeded all steps, stay on the last one with slow progress
    // This handles cases where processing takes longer than expected
    setCurrentStepIndex(STEPS.length - 1);
    // Slowly progress from 95% to 99% over the next 5 minutes (300 seconds)
    const extraTime = elapsedTime - accumulated;
    const slowProgress = Math.min(99, 95 + (extraTime / 300) * 4);
    setStepProgress(slowProgress);
  }, [elapsedTime]);

  // If chapters are ready, jump to completion
  useEffect(() => {
    if (chaptersCount > 0) {
      setCurrentStepIndex(STEPS.length - 1);
      setStepProgress(100);
    }
  }, [chaptersCount]);

  // Rotate encouraging messages
  useEffect(() => {
    if (courseStatus === 'ready' || courseStatus === 'failed') {
      return;
    }

    const messageTimer = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, MESSAGE_ROTATION_INTERVAL * 1000);

    return () => clearInterval(messageTimer);
  }, [courseStatus]);

  const getStepIcon = (step: ProcessingStep) => {
    switch (step) {
      case 'uploading':
        return FileText;
      case 'extracting':
        return FileText;
      case 'analyzing':
        return Brain;
      case 'generating':
        return BookOpen;
      case 'finalizing':
        return Sparkles;
    }
  };

  const getStepLabel = (step: ProcessingStep): string => {
    const labels: Record<ProcessingStep, string> = {
      uploading: translate('course_loading_step_uploading'),
      extracting: translate('course_loading_step_extracting'),
      analyzing: translate('course_loading_step_analyzing'),
      generating: translate('course_loading_step_generating'),
      finalizing: translate('course_loading_step_finalizing'),
    };
    return labels[step];
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Mascot */}
      <div className="flex justify-center mb-2">
        <img
          src="/chat/mascotte.png"
          alt="Nareo"
          className="w-28 h-auto object-contain animate-bounce"
        />
      </div>

      {/* Encouraging message */}
      <p className="text-sm text-gray-500 text-center mt-2 mb-6 px-4 italic transition-opacity duration-500">
        "{LOADING_MESSAGES[messageIndex]}"
      </p>

      {/* Title */}
      <h2 className="text-lg font-semibold text-gray-800 text-center mb-2">
        {translate('course_loading_title')}
      </h2>
      {courseTitle && (
        <p className="text-sm text-gray-500 text-center mb-6 truncate px-4">
          {courseTitle}
        </p>
      )}

      {/* Progress bar */}
      <div className="relative mb-6 px-4">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <span className="absolute right-4 -top-6 text-sm text-gray-500">
          {Math.round(overallProgress)}%
        </span>
      </div>

      {/* Steps list */}
      <div className="space-y-2 px-4">
        {STEPS.map((step, index) => {
          const isComplete = index < currentStepIndex || (index === currentStepIndex && stepProgress >= 100);
          const isCurrent = index === currentStepIndex && stepProgress < 100;
          const isPending = index > currentStepIndex;
          const Icon = getStepIcon(step);

          return (
            <div
              key={step}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                isCurrent
                  ? 'bg-orange-50 border border-orange-200'
                  : isComplete
                  ? 'bg-green-50 border border-green-100'
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
                  <Icon className="w-4 h-4" />
                )}
              </div>

              {/* Step label */}
              <span
                className={`text-sm font-medium flex-1 ${
                  isComplete
                    ? 'text-green-700'
                    : isCurrent
                    ? 'text-orange-700'
                    : 'text-gray-400'
                }`}
              >
                {getStepLabel(step)}
              </span>

              {/* Step progress for current step */}
              {isCurrent && (
                <span className="text-xs text-orange-500">
                  {Math.round(stepProgress)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Tip */}
      <p className="text-xs text-gray-400 text-center mt-6 px-4">
        {translate('course_loading_tip')}
      </p>
    </div>
  );
}
