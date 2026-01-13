'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

export type GenerationType = 'quiz' | 'flashcards' | 'note';

interface GenerationProgressProps {
  /** Type of content being generated */
  type: GenerationType;
  /** Current step message from the backend */
  message?: string;
  /** Number of items generated so far (for flashcards) */
  itemsGenerated?: number;
  /** Total items to generate (for flashcards) */
  totalItems?: number;
  /** Number of chapters with questions ready (for quiz) */
  chaptersReady?: number;
  /** Total chapters (for quiz and note) */
  totalChapters?: number;
  /** Current chapter being processed (for note) */
  chapterIndex?: number;
  /** Chapter title (for display) */
  chapterTitle?: string;
  /** Show compact version */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** @deprecated Legacy prop for backward compatibility - now calculated from chaptersReady/totalChapters */
  progress?: number;
}

// Claude thinking indicator - transforms between geometric shapes
function ClaudeThinkingDot({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dotSize = size === 'sm' ? 12 : 16;
  const [shapeIndex, setShapeIndex] = useState(0);

  const shapes = [
    <circle key="circle" cx="10" cy="10" r="4" fill="#f97316" />,
    <g key="plus" fill="#f97316">
      <rect x="9" y="5" width="2" height="10" rx="1" />
      <rect x="5" y="9" width="10" height="2" rx="1" />
    </g>,
    <polygon key="star4" points="10,4 11.5,8.5 16,10 11.5,11.5 10,16 8.5,11.5 4,10 8.5,8.5" fill="#f97316" />,
    <polygon key="diamond" points="10,4 15,10 10,16 5,10" fill="#f97316" />,
    <g key="snowflake" fill="#f97316">
      <rect x="9" y="4" width="2" height="12" rx="1" />
      <rect x="9" y="4" width="2" height="12" rx="1" transform="rotate(60 10 10)" />
      <rect x="9" y="4" width="2" height="12" rx="1" transform="rotate(120 10 10)" />
    </g>,
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

// Simple typewriter effect
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
    }, 30);

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

/**
 * NOUVELLE LOGIQUE DE PROGRESSION - Simple et déterministe
 *
 * Pour les quiz:
 * - 0-20% : Phase de démarrage (s'anime doucement pendant les premières secondes)
 * - 20-100% : Progression basée sur chaptersReady / totalChapters
 *
 * Exemple avec 7 chapitres:
 * - 0 chapitres prêts → 20%
 * - 1 chapitre prêt → 20% + (80% × 1/7) ≈ 31%
 * - 7 chapitres prêts → 100%
 */
function calculateQuizProgress(chaptersReady: number, totalChapters: number, startupProgress: number): number {
  // Phase de démarrage : 0-20%
  const STARTUP_PHASE = 20;
  // Phase chapitres : 20-100%
  const CHAPTER_PHASE = 80;

  if (totalChapters === 0) {
    return startupProgress; // Pas encore de chapitres connus
  }

  if (chaptersReady === 0) {
    // Aucun chapitre prêt - on est dans la phase de démarrage
    return Math.min(startupProgress, STARTUP_PHASE);
  }

  // Chapitres en cours - calculer la progression
  const chapterProgress = (chaptersReady / totalChapters) * CHAPTER_PHASE;
  return Math.min(STARTUP_PHASE + chapterProgress, 100);
}

export default function GenerationProgress({
  type,
  message,
  itemsGenerated,
  totalItems,
  chaptersReady = 0,
  totalChapters = 0,
  chapterIndex,
  compact = false,
  className = '',
}: GenerationProgressProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  // Timer pour la phase de démarrage (0-20%)
  const [startupProgress, setStartupProgress] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Animer la phase de démarrage pendant les 40 premières secondes
  useEffect(() => {
    // Reset au montage
    startTimeRef.current = Date.now();
    setStartupProgress(0);

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000; // secondes
      // Atteindre 20% en 40 secondes de manière linéaire (très lent)
      const progress = Math.min((elapsed / 40) * 20, 20);
      setStartupProgress(progress);
    }, 100);

    return () => clearInterval(interval);
  }, []); // Vide = s'exécute une seule fois au montage

  // Calculer la progression réelle basée sur les chapitres
  const displayProgress = useMemo(() => {
    if (type === 'quiz') {
      return calculateQuizProgress(chaptersReady, totalChapters, startupProgress);
    }

    if (type === 'flashcards' && totalItems && totalItems > 0) {
      const generated = itemsGenerated ?? 0;
      return Math.min((generated / totalItems) * 100, 100);
    }

    if (type === 'note' && totalChapters > 0 && chapterIndex !== undefined) {
      return Math.min((chapterIndex / totalChapters) * 100, 100);
    }

    return startupProgress;
  }, [type, chaptersReady, totalChapters, startupProgress, itemsGenerated, totalItems, chapterIndex]);

  // Texte du message
  const currentStepText = message || translate('quiz_generation_in_progress', 'Génération en cours...');

  // Compteur de chapitres
  const counterText = useMemo(() => {
    if (type === 'quiz' && totalChapters > 0) {
      const chapterWord = totalChapters <= 1 ? translate('gen_chapter_ready') : translate('gen_chapters_ready');
      return `${chaptersReady}/${totalChapters} ${chapterWord}`;
    }
    if (type === 'flashcards' && itemsGenerated !== undefined) {
      const cardWord = itemsGenerated <= 1 ? translate('gen_card_generated') : translate('gen_cards_generated');
      if (totalItems !== undefined && totalItems > 0) {
        return `${itemsGenerated}/~${totalItems} ${cardWord}`;
      }
      return `${itemsGenerated} ${cardWord}`;
    }
    if (type === 'note' && chapterIndex !== undefined && totalChapters > 0) {
      return `${translate('gen_section')} ${chapterIndex}/${totalChapters}`;
    }
    return null;
  }, [type, chaptersReady, totalChapters, itemsGenerated, totalItems, chapterIndex, translate]);

  if (compact) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-3">
          <ClaudeThinkingDot size="sm" />
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStepText}
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

        <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
          <motion.div
            className="bg-gradient-to-r from-orange-500 to-orange-400 h-1.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${displayProgress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

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

  // Full version
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <ClaudeThinkingDot size="md" />
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepText}
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

      <div>
        <div className={`w-full rounded-full h-2.5 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
          <motion.div
            className="bg-gradient-to-r from-orange-500 to-orange-400 h-2.5 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${displayProgress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {counterText && (
              <span className={`text-sm font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                {counterText}
              </span>
            )}
          </div>

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
