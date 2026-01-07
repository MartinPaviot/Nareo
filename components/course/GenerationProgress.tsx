'use client';

import { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  GenerationStep,
  getCurrentStep,
  getCompletedSteps,
  getPendingSteps,
  QUIZ_GENERATION_STEPS,
  FLASHCARD_GENERATION_STEPS,
  NOTE_GENERATION_STEPS,
} from '@/lib/generation-steps';

export type GenerationType = 'quiz' | 'flashcards' | 'note';

interface GenerationProgressProps {
  /** Type of content being generated */
  type: GenerationType;
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current step message from the backend */
  message?: string;
  /** Number of items generated so far */
  itemsGenerated?: number;
  /** Total items to generate (if known) */
  totalItems?: number;
  /** Current chapter being processed (for quiz) */
  chapterIndex?: number;
  /** Total chapters (for quiz) */
  totalChapters?: number;
  /** Chapter title (for quiz) */
  chapterTitle?: string;
  /** Show compact version */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Claude thinking indicator - transforms between geometric shapes (circle, cross, star, etc.)
function ClaudeThinkingDot({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dotSize = size === 'sm' ? 12 : 16;
  const [shapeIndex, setShapeIndex] = useState(0);

  // Shapes: circle, plus/cross, star, diamond, snowflake
  const shapes = [
    // Circle
    <circle key="circle" cx="10" cy="10" r="4" fill="#f97316" />,
    // Plus/Cross
    <g key="plus" fill="#f97316">
      <rect x="9" y="5" width="2" height="10" rx="1" />
      <rect x="5" y="9" width="10" height="2" rx="1" />
    </g>,
    // Star (4 points)
    <polygon key="star4" points="10,4 11.5,8.5 16,10 11.5,11.5 10,16 8.5,11.5 4,10 8.5,8.5" fill="#f97316" />,
    // Diamond
    <polygon key="diamond" points="10,4 15,10 10,16 5,10" fill="#f97316" />,
    // Snowflake / 6-point star
    <g key="snowflake" fill="#f97316">
      <rect x="9" y="4" width="2" height="12" rx="1" />
      <rect x="9" y="4" width="2" height="12" rx="1" transform="rotate(60 10 10)" />
      <rect x="9" y="4" width="2" height="12" rx="1" transform="rotate(120 10 10)" />
    </g>,
    // Triangle
    <polygon key="triangle" points="10,4 16,14 4,14" fill="#f97316" />,
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setShapeIndex((prev) => (prev + 1) % shapes.length);
    }, 600);
    return () => clearInterval(interval);
  }, [shapes.length]);

  return (
    <div className="flex-shrink-0" style={{ width: dotSize, height: dotSize }}>
      <AnimatePresence mode="wait">
        <motion.svg
          key={shapeIndex}
          width={dotSize}
          height={dotSize}
          viewBox="0 0 20 20"
          initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {shapes[shapeIndex]}
        </motion.svg>
      </AnimatePresence>
    </div>
  );
}

// Typewriter effect - text appears as if being typed, with shimmer effect
function TypewriterText({
  text,
  isDark,
  className = ''
}: {
  text: string;
  isDark: boolean;
  className?: string;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 30); // 30ms per character for natural typing speed

    return () => clearInterval(interval);
  }, [text]);

  return (
    <span
      className={`relative inline-block ${className}`}
      style={{
        background: isDark
          ? 'linear-gradient(90deg, #a3a3a3 0%, #f5f5f5 50%, #a3a3a3 100%)'
          : 'linear-gradient(90deg, #6b7280 0%, #111827 50%, #6b7280 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        animation: isTyping ? 'none' : 'shimmer 2s ease-in-out infinite',
      }}
    >
      {displayedText}
      {isTyping && displayedText.length > 0 && (
        <span
          className="inline-block w-[2px] h-[1em] ml-0.5 animate-blink"
          style={{ backgroundColor: '#f97316', verticalAlign: 'text-bottom' }}
        />
      )}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s ease-in-out infinite;
        }
      `}</style>
    </span>
  );
}

export default function GenerationProgress({
  type,
  progress,
  message,
  itemsGenerated,
  totalItems,
  chapterIndex,
  totalChapters,
  chapterTitle,
  compact = false,
  className = '',
}: GenerationProgressProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [lastServerProgress, setLastServerProgress] = useState(0);
  const [timeSinceLastUpdate, setTimeSinceLastUpdate] = useState(0);

  // Start timer when component mounts
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Track when server progress changes
  useEffect(() => {
    if (progress !== lastServerProgress) {
      setLastServerProgress(progress);
      setTimeSinceLastUpdate(0);
      // When server sends a new progress, immediately update to it
      setSmoothProgress(progress);
    }
  }, [progress, lastServerProgress]);

  // Smooth progress interpolation - advances slowly when server doesn't update
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSinceLastUpdate(prev => prev + 0.1);

      setSmoothProgress(prev => {
        // If we've reached 100%, stop
        if (prev >= 100) return 100;

        // Calculate target based on server progress
        // Allow smooth progress to go slightly ahead of server progress to show activity
        const maxAllowed = Math.min(progress + 5, 99); // Never exceed server + 5% or 99%

        // If server progress is ahead, catch up quickly
        if (progress > prev) {
          return Math.min(prev + 2, progress);
        }

        // If we're below max allowed, advance slowly (degressive speed)
        if (prev < maxAllowed) {
          // Slower as we get closer to the target
          const remaining = maxAllowed - prev;
          const increment = Math.max(0.1, remaining * 0.02); // Slower increment as we approach target
          return Math.min(prev + increment, maxAllowed);
        }

        return prev;
      });
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(interval);
  }, [progress]);

  // Get the appropriate steps for this generation type
  const steps = useMemo(() => {
    switch (type) {
      case 'quiz':
        return QUIZ_GENERATION_STEPS;
      case 'flashcards':
        return FLASHCARD_GENERATION_STEPS;
      case 'note':
        return NOTE_GENERATION_STEPS;
      default:
        return QUIZ_GENERATION_STEPS;
    }
  }, [type]);

  // Use smoothProgress for UI display, but keep original progress for step detection
  const displayProgress = smoothProgress;

  const currentStep = useMemo(() => getCurrentStep(steps, progress), [steps, progress]);
  const completedSteps = useMemo(() => getCompletedSteps(steps, progress), [steps, progress]);
  const pendingSteps = useMemo(() => getPendingSteps(steps, progress), [steps, progress]);

  // Calculate current step index for the counter
  const currentStepIndex = useMemo(() => {
    if (!currentStep) return steps.length;
    return steps.findIndex(s => s.key === currentStep.key) + 1;
  }, [currentStep, steps]);

  // Build the counter string - format: "X/~Y questions générées"
  const counterText = useMemo(() => {
    if (type === 'quiz' && itemsGenerated !== undefined) {
      if (totalItems !== undefined && totalItems > 0) {
        return `${itemsGenerated}/~${totalItems} questions générées`;
      }
      const questionWord = itemsGenerated <= 1 ? 'question générée' : 'questions générées';
      return `${itemsGenerated} ${questionWord}`;
    }
    if (type === 'flashcards' && itemsGenerated !== undefined) {
      if (totalItems !== undefined && totalItems > 0) {
        return `${itemsGenerated}/~${totalItems} cartes générées`;
      }
      const cardWord = itemsGenerated <= 1 ? 'carte générée' : 'cartes générées';
      return `${itemsGenerated} ${cardWord}`;
    }
    if (type === 'note' && chapterIndex !== undefined && totalChapters !== undefined) {
      return `Section ${chapterIndex}/${totalChapters}`;
    }
    return null;
  }, [type, itemsGenerated, totalItems, chapterIndex, totalChapters]);

  // Translate step message
  const translateStepMessage = (step: GenerationStep): string => {
    let translated = translate(step.translationKey);

    // Replace placeholders if present
    if (chapterIndex !== undefined && totalChapters !== undefined) {
      translated = translated
        .replace('{current}', chapterIndex.toString())
        .replace('{total}', totalChapters.toString());
    }
    if (chapterTitle) {
      translated = translated.replace('{title}', chapterTitle);
    }

    return translated;
  };

  // Use the message from backend if available, otherwise fall back to step translation
  const currentStepText = message || (currentStep ? translateStepMessage(currentStep) : translate('gen_finalizing'));

  if (compact) {
    // Compact version: pulsing dot + typewriter text
    return (
      <div className={`space-y-3 ${className}`}>
        {/* Single step indicator with pulsing dot and typewriter text */}
        <div className="flex items-center gap-3">
          <ClaudeThinkingDot size="sm" />
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep?.key || 'done'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="truncate py-0.5"
              >
                <TypewriterText
                  text={currentStepText}
                  isDark={isDark}
                  className="text-sm font-medium"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
          <motion.div
            className="bg-gradient-to-r from-orange-500 to-orange-400 h-1.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${displayProgress}%` }}
            transition={{ duration: 0.15, ease: 'linear' }}
          />
        </div>

        {/* Counter and percentage */}
        <div className="flex items-center justify-between">
          {counterText && (
            <span className={`text-xs font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
              {counterText}
            </span>
          )}
          <span className={`text-xs font-medium ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {Math.round(displayProgress)}%
          </span>
        </div>
      </div>
    );
  }

  // Full version: larger pulsing indicator + shimmer text (like Claude)
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Single step indicator with pulsing dot and typewriter text */}
      <div className="flex items-center gap-3">
        <ClaudeThinkingDot size="md" />
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep?.key || 'done'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="truncate py-0.5"
            >
              <TypewriterText
                text={currentStepText}
                isDark={isDark}
                className="text-base font-medium"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className={`w-full rounded-full h-2.5 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
          <motion.div
            className="bg-gradient-to-r from-orange-500 to-orange-400 h-2.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${displayProgress}%` }}
            transition={{ duration: 0.15, ease: 'linear' }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          {/* Counter */}
          <div className="flex items-center gap-2">
            {counterText && (
              <span className={`text-sm font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                {counterText}
              </span>
            )}
          </div>

          {/* Percentage */}
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
              {Math.round(displayProgress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
