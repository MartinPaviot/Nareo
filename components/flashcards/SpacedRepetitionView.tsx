'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FlashcardWithProgress, useUpdateCardProgress, useSaveSession } from '@/hooks/useFlashcardReviews';
import {
  Rating,
  SessionStats,
  createSessionStats,
  updateSessionStats,
  completeSessionStats,
  FlashcardProgress,
} from '@/lib/spaced-repetition';
import RatingButtons from './RatingButtons';
import SessionRecap from './SessionRecap';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Mapping des types de cartes vers des labels lisibles
const FLASHCARD_TYPE_LABELS: Record<string, string> = {
  basic: 'Question',
  cloze: 'Texte à trous',
  reversed: 'Vocabulaire',
  definition: 'Définition',
  formula: 'Formule',
  condition: 'Condition',
  intuition: 'Intuition',
  link: 'Lien',
};

/**
 * Rend une formule en HTML avec KaTeX si elle contient du LaTeX
 * Supporte les notations $...$ ou $$...$$ ou les formules sans délimiteurs
 */
function renderFormula(text: string): string {
  if (!text) return '';

  // Si le texte contient déjà des délimiteurs LaTeX
  if (text.includes('$')) {
    // Remplacer les $$...$$ par du KaTeX display mode
    let result = text.replace(/\$\$(.*?)\$\$/g, (_, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `$$${formula}$$`;
      }
    });

    // Remplacer les $...$ par du KaTeX inline
    result = result.replace(/\$([^$]+)\$/g, (_, formula) => {
      try {
        return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `$${formula}$`;
      }
    });

    return result;
  }

  // Sinon, essayer de rendre comme une formule mathématique
  try {
    return katex.renderToString(text, { displayMode: true, throwOnError: false });
  } catch {
    return text;
  }
}

interface SpacedRepetitionViewProps {
  cards: FlashcardWithProgress[];
  courseId: string;
  courseTitle?: string;
  mode: 'study' | 'review'; // study = all cards, review = due cards only
  onComplete?: () => void;
  onBack?: () => void;
}

export default function SpacedRepetitionView({
  cards: initialCards,
  courseId,
  courseTitle,
  mode,
  onComplete,
  onBack,
}: SpacedRepetitionViewProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Session cards - can grow when "hard" is selected (card goes back to end)
  const [sessionCards, setSessionCards] = useState<FlashcardWithProgress[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>(() => createSessionStats(initialCards.length));
  const [showRecap, setShowRecap] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Hooks
  const { updateProgress, isUpdating } = useUpdateCardProgress();
  const { saveSession } = useSaveSession();

  // Current card
  const currentCard = sessionCards[currentIndex];

  // Convert card progress to FlashcardProgress type for algorithm
  const currentProgress: FlashcardProgress | null = useMemo(() => {
    if (!currentCard?.progress) return null;
    return {
      ease_factor: currentCard.progress.ease_factor,
      interval_days: currentCard.progress.interval_days,
      next_review_at: new Date(currentCard.progress.next_review_at),
    };
  }, [currentCard?.progress]);

  // Progress percentage
  const progressPercentage = sessionCards.length > 0
    ? Math.round((currentIndex / sessionCards.length) * 100)
    : 0;

  // Handle card flip
  const handleFlip = useCallback(() => {
    setIsFlipped(true);
  }, []);

  // Handle rating
  const handleRate = useCallback(async (rating: Rating) => {
    if (!currentCard || isProcessing) return;

    setIsProcessing(true);

    try {
      // Update progress in database
      if (user) {
        await updateProgress(currentCard.id, rating, currentCard.progress);
      }

      // Update session stats
      setSessionStats(prev => updateSessionStats(prev, rating));

      // If "hard", add card back to the end of the queue (stays in session)
      if (rating === 'hard') {
        setSessionCards(prev => [...prev, currentCard]);
      }

      // Move to next card or show recap
      if (currentIndex + 1 >= sessionCards.length && rating !== 'hard') {
        // Session complete
        const finalStats = completeSessionStats(updateSessionStats(sessionStats, rating));
        setSessionStats(finalStats);

        // Save session to database
        if (user) {
          await saveSession(courseId, finalStats);
        }

        setShowRecap(true);
      } else {
        // Next card
        setIsFlipped(false);
        setCurrentIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error updating card progress:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [currentCard, currentIndex, sessionCards.length, sessionStats, user, updateProgress, saveSession, courseId, isProcessing]);

  // Handle retry difficult cards
  const handleRetryDifficult = useCallback(() => {
    // Get cards that were rated "hard"
    const difficultCards = initialCards.filter(card => {
      const lastRating = card.progress?.last_rating;
      return lastRating === 'hard';
    });

    if (difficultCards.length > 0) {
      setSessionCards(difficultCards);
      setCurrentIndex(0);
      setIsFlipped(false);
      setSessionStats(createSessionStats(difficultCards.length));
      setShowRecap(false);
    }
  }, [initialCards]);

  // Handle finish
  const handleFinish = useCallback(() => {
    if (onComplete) {
      onComplete();
    } else {
      router.back();
    }
  }, [onComplete, router]);

  // Handle back
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  }, [onBack, router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          if (!isFlipped) {
            handleFlip();
          }
          break;
        case '1':
          if (isFlipped && !isProcessing) {
            e.preventDefault();
            handleRate('hard');
          }
          break;
        case '2':
          if (isFlipped && !isProcessing) {
            e.preventDefault();
            handleRate('good');
          }
          break;
        case '3':
          if (isFlipped && !isProcessing) {
            e.preventDefault();
            handleRate('easy');
          }
          break;
        case 'Escape':
          e.preventDefault();
          handleBack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isProcessing, handleFlip, handleRate, handleBack]);

  // Show recap screen
  if (showRecap) {
    return (
      <SessionRecap
        stats={sessionStats}
        onRetryDifficult={sessionStats.hard > 0 ? handleRetryDifficult : undefined}
        onFinish={handleFinish}
      />
    );
  }

  // No cards
  if (sessionCards.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-8 rounded-2xl ${
        isDark ? 'bg-neutral-900' : 'bg-white'
      }`}>
        <p className={`text-lg font-medium mb-4 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
          {mode === 'review'
            ? translate('flashcard_no_reviews', 'Aucune carte à réviser !')
            : translate('flashcard_no_cards', 'Aucune flashcard disponible.')
          }
        </p>
        <button
          onClick={handleBack}
          className={`px-4 py-2 rounded-lg transition-colors ${
            isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {translate('back', 'Retour')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleBack}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${
            isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          {translate('back', 'Retour')}
        </button>

        <div className={`text-sm font-medium ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
          {currentIndex + 1} / {sessionCards.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className={`w-full h-2 rounded-full overflow-hidden mb-6 ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
        <div
          className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Flashcard */}
      <div
        onClick={!isFlipped ? handleFlip : undefined}
        className={`relative w-full aspect-[5/3] sm:aspect-[2/1] rounded-2xl border shadow-sm overflow-visible ${
          !isFlipped ? 'cursor-pointer' : ''
        } transition-colors ${
          isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
        }`}
        style={{ perspective: '1000px', zIndex: 10 }}
      >
        <div
          className="relative w-full h-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front - Question */}
          <div
            className={`absolute inset-0 p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center ${
              isDark ? 'bg-neutral-900' : 'bg-white'
            }`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="text-xs sm:text-sm text-orange-500 font-semibold uppercase tracking-wide mb-3">
              {FLASHCARD_TYPE_LABELS[currentCard.type] || currentCard.type}
            </span>
            <h3 className={`text-xl sm:text-2xl md:text-3xl font-bold text-center px-2 leading-tight ${
              isDark ? 'text-neutral-50' : 'text-gray-900'
            }`}>
              {currentCard.front}
            </h3>
            <p className={`text-sm sm:text-base mt-4 sm:mt-6 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              {translate('flashcards_tap_to_flip', 'Touchez pour retourner')}
            </p>
          </div>

          {/* Back - Answer */}
          <div
            className={`absolute inset-0 p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center overflow-y-auto ${
              isDark ? 'bg-orange-500/10' : 'bg-orange-50'
            }`}
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <span className={`text-xs sm:text-sm font-semibold uppercase tracking-wide mb-3 ${
              isDark ? 'text-orange-400' : 'text-orange-600'
            }`}>
              {translate('flashcards_answer', 'Réponse')}
            </span>
            {currentCard.type === 'formula' ? (
              <div
                className={`text-xl sm:text-2xl md:text-3xl text-center leading-relaxed px-2 font-mono ${
                  isDark ? 'text-neutral-200' : 'text-gray-800'
                }`}
                dangerouslySetInnerHTML={{ __html: renderFormula(currentCard.back) }}
              />
            ) : (
              <p className={`text-lg sm:text-xl md:text-2xl text-center leading-relaxed px-2 ${
                isDark ? 'text-neutral-200' : 'text-gray-800'
              }`}>
                {currentCard.back}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons - visible seulement quand la carte est retournée */}
      {isFlipped && (
        <div className="mt-6 flex flex-col items-center justify-center" style={{ position: 'relative', zIndex: 1 }}>
          <p className={`text-center text-sm mb-3 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            {translate('flashcard_how_well', 'Comment as-tu trouvé ?')}
          </p>
          <RatingButtons
            onRate={handleRate}
            currentProgress={currentProgress}
            disabled={isProcessing || isUpdating}
          />
          <p className={`text-center text-xs mt-3 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
            {translate('flashcard_keyboard_hint', 'Raccourcis : 1-3 pour noter, Espace pour retourner')}
          </p>
        </div>
      )}

      {/* Loading indicator */}
      {(isProcessing || isUpdating) && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg ${
            isDark ? 'bg-neutral-800 text-neutral-200' : 'bg-white text-gray-800'
          }`}>
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span className="text-sm">{translate('saving', 'Enregistrement...')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
