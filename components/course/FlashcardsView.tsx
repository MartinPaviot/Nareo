'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw, ChevronLeft, ChevronRight, Sparkles, ThumbsUp, ThumbsDown, Star, UserPlus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

interface Flashcard {
  id: string;
  type: string;
  front: string;
  back: string;
  mastery: 'new' | 'learning' | 'mastered';
  correctCount: number;
  incorrectCount: number;
}

interface FlashcardsViewProps {
  courseId: string;
  courseTitle: string;
}

export default function FlashcardsView({ courseId, courseTitle }: FlashcardsViewProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [studyQueue, setStudyQueue] = useState<number[]>([]);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Check if flashcards already exist
  useEffect(() => {
    const fetchFlashcards = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/courses/${courseId}/flashcards`);
        if (response.ok) {
          const data = await response.json();
          if (data.flashcards && data.flashcards.length > 0) {
            // Normalize flashcards to handle old format (concept/definition) and new format (front/back)
            const normalizedFlashcards = data.flashcards.map((fc: Flashcard & { concept?: string; definition?: string }) => ({
              id: fc.id,
              type: fc.type || 'definition',
              front: fc.front || fc.concept || '',
              back: fc.back || fc.definition || '',
              mastery: fc.mastery || 'new',
              correctCount: fc.correctCount || 0,
              incorrectCount: fc.incorrectCount || 0,
            }));
            setFlashcards(normalizedFlashcards);
          }
        }
      } catch (err) {
        console.error('Error fetching flashcards:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFlashcards();
  }, [courseId]);

  const handleGenerate = async () => {
    // Check if user is logged in
    if (!user) {
      setShowSignupModal(true);
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${courseId}/flashcards/generate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate flashcards');
      }

      const data = await response.json();
      setFlashcards(data.flashcards);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
    }
  };

  // Build study queue based on mastery (cards with more incorrect answers appear more often)
  const buildStudyQueue = (cards: Flashcard[]): number[] => {
    const queue: number[] = [];
    cards.forEach((card, idx) => {
      // New cards appear once
      // Cards with incorrect answers appear more frequently
      const weight = Math.max(1, card.incorrectCount - card.correctCount + 1);
      for (let i = 0; i < weight; i++) {
        queue.push(idx);
      }
    });
    // Shuffle the queue
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  };

  // Initialize study queue when flashcards load
  useEffect(() => {
    if (flashcards.length > 0 && studyQueue.length === 0) {
      setStudyQueue(buildStudyQueue(flashcards));
    }
  }, [flashcards, studyQueue.length]);

  const handleNext = () => {
    setIsFlipped(false);
    setHasAnswered(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setHasAnswered(false);
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleFeedback = async (correct: boolean) => {
    if (hasAnswered) return;
    setHasAnswered(true);

    // Award points for correct answers
    if (correct) {
      setSessionPoints((prev) => prev + 10);
    }

    const card = flashcards[currentIndex];
    const updatedCard = {
      ...card,
      correctCount: correct ? card.correctCount + 1 : card.correctCount,
      incorrectCount: correct ? card.incorrectCount : card.incorrectCount + 1,
      mastery: correct && card.correctCount >= 2 ? 'mastered' as const : 'learning' as const,
    };

    // Update local state
    const updatedFlashcards = [...flashcards];
    updatedFlashcards[currentIndex] = updatedCard;
    setFlashcards(updatedFlashcards);

    // Save to server (fire and forget)
    fetch(`/api/courses/${courseId}/flashcards/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flashcardId: card.id,
        correct,
      }),
    }).catch(err => console.error('Error saving feedback:', err));

    // Auto-advance to next card after a short delay
    setTimeout(() => {
      setIsFlipped(false);
      setHasAnswered(false);
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 400);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-gray-600">{translate('loading')}</p>
      </div>
    );
  }

  // No flashcards yet - show generate button
  if (flashcards.length === 0) {
    return (
      <>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {translate('flashcards_title')}
          </h3>
          <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
            {translate('flashcards_description')}
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {translate('flashcards_generating')}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {translate('flashcards_generate')}
              </>
            )}
          </button>
        </div>

        {/* Signup Modal */}
        {showSignupModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                {translate('flashcards_signup_title')}
              </h3>
              <p className="text-sm text-gray-600 mb-6 text-center">
                {translate('flashcards_signup_description')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignupModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  {translate('cancel')}
                </button>
                <button
                  onClick={() => router.push('/auth/signup')}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
                >
                  {translate('auth_signup_button')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Show flashcard carousel
  const currentCard = flashcards[currentIndex];

  return (
    <div className="space-y-4">
      {/* Progress indicator and points */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <span className="text-gray-600">{translate('flashcards_progress', { current: String(currentIndex + 1), total: String(flashcards.length) })}</span>
        <div className="flex items-center gap-2 sm:gap-4">
          {sessionPoints > 0 && (
            <span className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-orange-100 text-orange-600 rounded-full font-semibold text-xs sm:text-sm">
              <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-orange-400" />
              {sessionPoints} pts
            </span>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 text-xs sm:text-sm"
          >
            <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">{translate('flashcards_regenerate')}</span>
            <span className="xs:hidden">{translate('regenerate')}</span>
          </button>
        </div>
      </div>

      {/* Flashcard */}
      <div
        onClick={handleFlip}
        className="relative w-full aspect-[4/3] sm:aspect-[3/2] cursor-pointer perspective-1000"
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front - Question */}
          <div
            className="absolute inset-0 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="text-xs text-orange-500 font-semibold uppercase tracking-wide mb-2">
              {translate(`flashcard_type_${currentCard.type}`) || currentCard.type}
            </span>
            <h3 className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 text-center px-2">
              {currentCard.front}
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 mt-3 sm:mt-4">{translate('flashcards_tap_to_flip')}</p>
          </div>

          {/* Back - Answer */}
          <div
            className="absolute inset-0 bg-orange-50 rounded-2xl border border-orange-200 shadow-sm p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center overflow-y-auto"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <span className="text-xs text-orange-600 font-semibold uppercase tracking-wide mb-2">
              {translate('flashcards_answer')}
            </span>
            <p className="text-sm sm:text-base md:text-lg text-gray-800 text-center leading-relaxed px-2">
              {currentCard.back}
            </p>
            {!hasAnswered && (
              <p className="text-xs sm:text-sm text-orange-400 mt-3 sm:mt-4">{translate('flashcards_rate_answer')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Feedback buttons - only show when flipped */}
      {isFlipped && (
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFeedback(false);
            }}
            disabled={hasAnswered}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium text-sm sm:text-base transition-all ${
              hasAnswered
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
            }`}
          >
            <ThumbsDown className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">{translate('flashcards_didnt_know')}</span>
            <span className="xs:hidden">{translate('flashcards_no')}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFeedback(true);
            }}
            disabled={hasAnswered}
            className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium text-sm sm:text-base transition-all ${
              hasAnswered
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
            }`}
          >
            <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">{translate('flashcards_knew_it')}</span>
            <span className="xs:hidden">{translate('flashcards_yes')}</span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        <button
          onClick={handlePrev}
          className="p-2 sm:p-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Dots indicator - hide on small screens if too many cards */}
        <div className="flex gap-1 max-w-[200px] sm:max-w-none overflow-hidden">
          {flashcards.length <= 15 ? (
            flashcards.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setIsFlipped(false);
                  setCurrentIndex(idx);
                }}
                className={`w-2 h-2 rounded-full transition-colors flex-shrink-0 ${
                  idx === currentIndex ? 'bg-orange-500' : 'bg-gray-300'
                }`}
              />
            ))
          ) : (
            <span className="text-xs sm:text-sm text-gray-500">
              {currentIndex + 1} / {flashcards.length}
            </span>
          )}
        </div>

        <button
          onClick={handleNext}
          className="p-2 sm:p-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Signup Modal */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-7 h-7 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
              {translate('flashcards_signup_title')}
            </h3>
            <p className="text-sm text-gray-600 mb-6 text-center">
              {translate('flashcards_signup_description')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignupModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                {translate('cancel')}
              </button>
              <button
                onClick={() => router.push('/auth/signup')}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                {translate('auth_signup_button')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
