'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Maximize2, Minimize2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import GenerationProgress from './GenerationProgress';


// Skeleton component for loading cards
function FlashcardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className={`rounded-2xl p-6 ${
      isDark ? 'bg-neutral-800' : 'bg-white'
    } shadow-lg border ${isDark ? 'border-neutral-700' : 'border-gray-200'}`}>
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] space-y-4">
        {/* Type badge skeleton */}
        <div className={`h-4 w-16 rounded-full animate-pulse ${
          isDark ? 'bg-neutral-700' : 'bg-gray-200'
        }`} />
        {/* Content skeleton lines */}
        <div className="space-y-3 w-full max-w-xs">
          <div className={`h-5 rounded animate-pulse ${
            isDark ? 'bg-neutral-700' : 'bg-gray-200'
          }`} />
          <div className={`h-5 w-3/4 mx-auto rounded animate-pulse ${
            isDark ? 'bg-neutral-700' : 'bg-gray-200'
          }`} />
        </div>
        {/* Hint skeleton */}
        <div className={`h-3 w-24 rounded animate-pulse mt-4 ${
          isDark ? 'bg-neutral-700' : 'bg-gray-200'
        }`} />
      </div>
    </div>
  );
}

// Flashcard interface matching the SSE event data
export interface StreamingFlashcard {
  id: string;
  type: string; // 'basic' | 'cloze' | 'reversed'
  front: string;
  back: string;
}

interface ProgressiveFlashcardsViewProps {
  /** Flashcards received so far */
  flashcards: StreamingFlashcard[];
  /** Whether more flashcards are being generated */
  isGenerating: boolean;
  /** Current generation progress (0-100) */
  progress: number;
  /** Number of cards generated */
  cardsGenerated: number;
  /** Total expected cards (if known) */
  totalCards?: number;
  /** Current progress message */
  progressMessage?: string;
  /** Called when generation is complete */
  onComplete?: () => void;
  /** Course ID for tracking */
  courseId: string;
}

export default function ProgressiveFlashcardsView({
  flashcards,
  isGenerating,
  progress,
  cardsGenerated,
  totalCards,
  progressMessage,
  onComplete,
  courseId,
}: ProgressiveFlashcardsViewProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<string>>(new Set());

  const cardRef = useRef<HTMLDivElement>(null);

  const currentCard = flashcards[currentIndex];
  const hasNext = currentIndex < flashcards.length - 1 || isGenerating;
  const hasPrev = currentIndex > 0;

  // Score calculation
  const score = useMemo(() => {
    const total = knownCards.size + unknownCards.size;
    if (total === 0) return 0;
    return Math.round((knownCards.size / total) * 100);
  }, [knownCards, unknownCards]);

  // Navigate to next card
  const goNext = useCallback(() => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  }, [currentIndex, flashcards.length]);

  // Navigate to previous card
  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  // Flip the card
  const flipCard = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  // Mark as known
  const markKnown = useCallback(() => {
    if (currentCard) {
      setKnownCards(prev => new Set([...prev, currentCard.id]));
      setUnknownCards(prev => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
      goNext();
    }
  }, [currentCard, goNext]);

  // Mark as unknown
  const markUnknown = useCallback(() => {
    if (currentCard) {
      setUnknownCards(prev => new Set([...prev, currentCard.id]));
      setKnownCards(prev => {
        const next = new Set(prev);
        next.delete(currentCard.id);
        return next;
      });
      goNext();
    }
  }, [currentCard, goNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isFlipped) {
          goNext();
        } else {
          flipCard();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        if (isFlipped) {
          goPrev();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        flipCard();
      } else if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, goNext, goPrev, flipCard]);

  // Effect for when generation completes
  useEffect(() => {
    if (!isGenerating && flashcards.length > 0 && onComplete) {
      onComplete();
    }
  }, [isGenerating, flashcards.length, onComplete]);

  // Card content with animation
  const cardContent = (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentCard?.id || 'empty'}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="relative w-full h-full"
        style={{ perspective: '1000px' }}
      >
        <div
          ref={cardRef}
          onClick={flipCard}
          className={`relative w-full h-full cursor-pointer transition-transform duration-500 ${
            isFlipped ? '[transform:rotateY(180deg)]' : ''
          }`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div
            className={`absolute inset-0 rounded-2xl p-6 flex flex-col items-center justify-center text-center ${
              isDark ? 'bg-neutral-800' : 'bg-white'
            } shadow-lg border ${isDark ? 'border-neutral-700' : 'border-gray-200'}`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            {currentCard && (
              <>
                <span className={`text-xs uppercase tracking-wider mb-4 ${
                  isDark ? 'text-neutral-500' : 'text-gray-400'
                }`}>
                  {translate('flashcard_front')}
                </span>
                <p className={`text-lg font-medium ${isDark ? 'text-neutral-100' : 'text-gray-800'}`}>
                  {currentCard.front}
                </p>
                <span className={`mt-6 text-xs ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                  {translate('flashcard_tap_to_flip')}
                </span>
              </>
            )}
          </div>

          {/* Back */}
          <div
            className={`absolute inset-0 rounded-2xl p-6 flex flex-col items-center justify-center text-center ${
              isDark ? 'bg-neutral-800' : 'bg-white'
            } shadow-lg border ${isDark ? 'border-neutral-700' : 'border-gray-200'}`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            {currentCard && (
              <>
                <span className={`text-xs uppercase tracking-wider mb-4 ${
                  isDark ? 'text-neutral-500' : 'text-gray-400'
                }`}>
                  {translate('flashcard_back')}
                </span>
                <p className={`text-lg font-medium ${isDark ? 'text-neutral-100' : 'text-gray-800'}`}>
                  {currentCard.back}
                </p>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  // Waiting for first card - show skeleton
  if (flashcards.length === 0) {
    return (
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        {/* Header skeleton */}
        <div className={`p-4 border-b ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`h-4 w-24 rounded animate-pulse ${isDark ? 'bg-neutral-700' : 'bg-gray-200'}`} />
            <div className={`h-4 w-12 rounded animate-pulse ${isDark ? 'bg-neutral-700' : 'bg-gray-200'}`} />
          </div>
          <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {/* Generation progress */}
          <div className="mt-3">
            <GenerationProgress
              type="flashcards"
              progress={progress}
              message={progressMessage}
              itemsGenerated={cardsGenerated}
              totalItems={totalCards}
              compact={true}
            />
          </div>
        </div>

        {/* Skeleton card */}
        <div className="p-6">
          <div className="w-full aspect-[3/2] max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <FlashcardSkeleton isDark={isDark} />
            </motion.div>
          </div>
        </div>

        {/* Upcoming cards indicator */}
        {totalCards && totalCards > 0 && (
          <div className={`px-6 pb-6`}>
            <p className={`text-xs text-center mb-3 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              {translate('gen_cards_coming', { total: totalCards.toString() }) || `${totalCards} cartes en préparation...`}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: Math.min(totalCards, 8) }).map((_, idx) => (
                <motion.div
                  key={idx}
                  className={`w-2 h-2 rounded-full ${isDark ? 'bg-neutral-700' : 'bg-gray-300'}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                />
              ))}
              {totalCards > 8 && (
                <span className={`text-xs ml-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                  +{totalCards - 8}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fullscreen view (portal)
  if (isFullscreen) {
    return createPortal(
      <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-neutral-950' : 'bg-gray-100'}`}>
        {/* Fullscreen header */}
        <div className={`flex items-center justify-between p-4 border-b ${
          isDark ? 'border-neutral-800' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {currentIndex + 1} / {flashcards.length}
              {isGenerating && <span className="text-orange-500"> (+)</span>}
            </span>
            <span className={`text-sm font-medium ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
              {score}%
            </span>
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-200 text-gray-600'
            }`}
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Card area */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl aspect-[3/2]">
            {cardContent}
          </div>
        </div>

        {/* Feedback buttons */}
        {isFlipped && (
          <div className="flex items-center justify-center gap-4 p-4">
            <button
              onClick={markUnknown}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors"
              style={{
                backgroundColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3',
                color: isDark ? '#f87171' : '#b91c1c'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(217, 26, 28, 0.3)' : '#ffeae5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3'}
            >
              <X className="w-5 h-5" />
              {translate('flashcard_didnt_know')}
            </button>
            <button
              onClick={markKnown}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors ${
                isDark ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              <Check className="w-5 h-5" />
              {translate('flashcard_knew_it')}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between p-4">
          <button
            onClick={goPrev}
            disabled={!hasPrev}
            className={`p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-gray-200 text-gray-700'
            }`}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goNext}
            disabled={!hasNext || (!isFlipped && currentIndex === flashcards.length - 1)}
            className={`p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-gray-200 text-gray-700'
            }`}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // Regular view
  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${
      isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className={`p-4 border-b ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
              {translate('flashcard_card')} {currentIndex + 1} / {flashcards.length}
              {isGenerating && <span className="text-orange-500"> (+)</span>}
            </span>
            {currentCard && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {currentCard.type}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
              {score}%
            </span>
            <button
              onClick={() => setIsFullscreen(true)}
              className={`p-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
              title="Fullscreen (F)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((currentIndex + 1) / Math.max(flashcards.length, 1)) * 100}%`,
              background: 'linear-gradient(90deg, #f97316 0%, #fb923c 100%)',
            }}
          />
        </div>

        {/* Generation progress steps (compact mode while playing) */}
        {isGenerating && (
          <div className="mt-3">
            <GenerationProgress
              type="flashcards"
              progress={progress}
              message={progressMessage}
              itemsGenerated={cardsGenerated}
              totalItems={totalCards}
              compact={true}
            />
          </div>
        )}
      </div>

      {/* Card area */}
      <div className="p-6">
        <div className="w-full aspect-[3/2] max-w-md mx-auto">
          {cardContent}
        </div>
      </div>

      {/* Feedback buttons */}
      {isFlipped && (
        <div className={`flex items-center justify-center gap-4 p-4 border-t ${
          isDark ? 'border-neutral-800' : 'border-gray-100'
        }`}>
          <button
            onClick={markUnknown}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors"
            style={{
              backgroundColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3',
              color: isDark ? '#f87171' : '#b91c1c'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(217, 26, 28, 0.3)' : '#ffeae5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3'}
          >
            <X className="w-4 h-4" />
            {translate('flashcard_didnt_know')}
          </button>
          <button
            onClick={markKnown}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors ${
              isDark ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            <Check className="w-4 h-4" />
            {translate('flashcard_knew_it')}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className={`flex items-center justify-between p-4 border-t ${
        isDark ? 'border-neutral-800' : 'border-gray-100'
      }`}>
        <button
          onClick={goPrev}
          disabled={!hasPrev}
          className={`flex items-center gap-1 px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isDark ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          {translate('previous')}
        </button>

        {/* Card dots with animation */}
        <div className="flex items-center gap-1">
          {flashcards.slice(0, 10).map((card, idx) => (
            <motion.button
              key={card.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
              onClick={() => {
                setCurrentIndex(idx);
                setIsFlipped(false);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex
                  ? 'bg-orange-500 scale-125'
                  : knownCards.has(card.id)
                  ? 'bg-green-500'
                  : unknownCards.has(card.id)
                  ? 'bg-[#d91a1c]'
                  : isDark ? 'bg-neutral-700' : 'bg-gray-300'
              }`}
            />
          ))}
          {isGenerating && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-orange-500/50"
            />
          )}
          {flashcards.length > 10 && (
            <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              +{flashcards.length - 10}
            </span>
          )}
        </div>

        <button
          onClick={goNext}
          disabled={!hasNext || (!isFlipped && currentIndex === flashcards.length - 1 && !isGenerating)}
          className={`flex items-center gap-1 px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isDark ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-gray-100 text-gray-700'
          }`}
        >
          {translate('next')}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
