'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Star, HelpCircle, Maximize2, Minimize2 } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTodayReviews, FlashcardWithProgress } from '@/hooks/useFlashcardReviews';
import { useCoursesOrganized } from '@/hooks/useCoursesOrganized';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import { CourseSidebar } from '@/components/Sidebar';
import LearnPageHeader from '@/components/layout/LearnPageHeader';
import RatingButtons from '@/components/flashcards/RatingButtons';
import SessionRecap from '@/components/flashcards/SessionRecap';
import {
  Rating,
  SessionStats,
  createSessionStats,
  updateSessionStats,
  completeSessionStats,
  calculateNextReview,
  getMasteryLevel,
  FlashcardProgress,
} from '@/lib/spaced-repetition';

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

// Keyboard shortcuts tooltip
function KeyboardHelpTooltip({ isDark }: { isDark?: boolean }) {
  const [isVisible, setIsVisible] = useState(false);
  const { translate } = useLanguage();

  return (
    <div className="relative">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className={`p-1.5 transition-colors rounded-full ${
          isDark
            ? 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700'
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        }`}
        aria-label={translate('flashcards_keyboard_help') || 'Keyboard shortcuts'}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {isVisible && (
        <div className={`absolute right-0 top-full mt-1 z-50 text-xs rounded-lg p-3 shadow-lg min-w-[220px] ${
          isDark ? 'bg-neutral-700 text-neutral-100' : 'bg-gray-900 text-white'
        }`}>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>Space / ↑ ↓</span>
              <span>{translate('flashcards_flip') || 'Retourner'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>1</span>
              <span>{translate('flashcard_rating_hard') || 'Difficile'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>2</span>
              <span>{translate('flashcard_rating_good') || 'Bien'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>3</span>
              <span>{translate('flashcard_rating_easy') || 'Facile'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>F</span>
              <span>{translate('flashcards_fullscreen') || 'Plein écran'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { isDark } = useTheme();
  const { translate } = useLanguage();
  const { user, loading: authLoading } = useAuth();

  const courseId = params.courseId as string;
  const isAllCourses = courseId === 'all';

  // Sidebar navigation state
  const sidebar = useSidebarNavigation();
  const { folders } = useCoursesOrganized();

  // Find the course info for breadcrumb
  const currentCourseInfo = useMemo(() => {
    if (isAllCourses) {
      return { title: translate('flashcard_review_all_title', 'Révisions du jour'), folder: null };
    }
    for (const folder of folders) {
      const course = folder.courses.find((c) => c.id === courseId);
      if (course) {
        return { title: course.name, folder: { id: folder.id, name: folder.name } };
      }
    }
    return { title: translate('flashcard_review_title', 'Révisions'), folder: null };
  }, [folders, courseId, isAllCourses, translate]);

  // Fetch cards due for review
  const { cards: initialCards, isLoading, error, refetch } = useTodayReviews(
    isAllCourses ? undefined : courseId
  );

  // Session state
  const [sessionCards, setSessionCards] = useState<FlashcardWithProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [sessionState, setSessionState] = useState<'playing' | 'completed'>('playing');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize session when cards are loaded
  useEffect(() => {
    if (initialCards.length > 0 && sessionCards.length === 0) {
      setSessionCards(initialCards);
      setSessionStats(createSessionStats(initialCards.length));
    }
  }, [initialCards, sessionCards.length]);

  // Current card and progress
  const currentCard = sessionCards[currentIndex];

  const currentCardProgress: FlashcardProgress | null = useMemo(() => {
    if (!currentCard?.progress) return null;
    return {
      ease_factor: currentCard.progress.ease_factor,
      interval_days: currentCard.progress.interval_days,
      next_review_at: new Date(currentCard.progress.next_review_at),
    };
  }, [currentCard?.progress]);

  // Handle card flip
  const handleFlip = useCallback(() => {
    if (!isFlipped) {
      setIsFlipped(true);
    }
  }, [isFlipped]);

  // Handle rating
  const handleRating = useCallback(async (rating: Rating) => {
    if (!currentCard || isProcessing || hasAnswered) return;

    setHasAnswered(true);
    setIsProcessing(true);

    // Award points based on rating
    const pointsMap: Record<Rating, number> = {
      hard: 0,
      good: 10,
      easy: 15,
    };
    setSessionPoints((prev) => prev + pointsMap[rating]);

    try {
      // Calculate new progress using SM-2 algorithm
      const newProgress = calculateNextReview(currentCardProgress, rating);
      const newMastery = getMasteryLevel(newProgress.interval_days);

      // Save to server
      if (user) {
        await fetch('/api/flashcards/reviews/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flashcardId: currentCard.id,
            rating,
            easeFactor: newProgress.ease_factor,
            intervalDays: newProgress.interval_days,
            nextReviewAt: newProgress.next_review_at.toISOString(),
            mastery: newMastery,
            reviewCount: (currentCard.progress?.review_count ?? 0) + 1,
            correctCount: (currentCard.progress?.correct_count ?? 0) + (rating === 'good' || rating === 'easy' ? 1 : 0),
            incorrectCount: (currentCard.progress?.incorrect_count ?? 0) + (rating === 'hard' ? 1 : 0),
          }),
        });
      }

      // Update session stats
      setSessionStats(prev => prev ? updateSessionStats(prev, rating) : createSessionStats(sessionCards.length));

      // Check if this is the last card
      const isLastCard = currentIndex + 1 >= sessionCards.length;

      // Auto-advance after delay
      setTimeout(async () => {
        if (isLastCard) {
          // Session completed
          setSessionStats(prev => prev ? completeSessionStats(prev) : null);
          setSessionState('completed');
          setIsFullscreen(false);

          // Record activity for gamification (add points to dashboard)
          if (user) {
            try {
              await fetch('/api/gamification/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  points_earned: sessionPoints + pointsMap[rating], // Include current rating points
                  questions_answered: sessionCards.length,
                  questions_correct: sessionCards.length - 1 + (rating === 'good' || rating === 'easy' ? 1 : 0), // Approximate
                }),
              });
            } catch (err) {
              console.error('Error recording flashcard activity:', err);
            }
          }
        } else {
          setIsFlipped(false);
          setHasAnswered(false);
          setCurrentIndex(prev => prev + 1);
        }
        setIsProcessing(false);
      }, 400);
    } catch (error) {
      console.error('Error updating card progress:', error);
      setIsProcessing(false);
      setHasAnswered(false);
    }
  }, [currentCard, currentCardProgress, currentIndex, sessionCards.length, user, isProcessing, hasAnswered]);

  // Handle finish - go back
  const handleFinish = useCallback(() => {
    refetch();
    if (isAllCourses) {
      router.push('/dashboard');
    } else {
      router.push(`/courses/${courseId}/learn?tab=flashcards`);
    }
  }, [refetch, isAllCourses, courseId, router]);

  // Handle breadcrumb folder click
  const handleBreadcrumbFolderClick = useCallback(() => {
    if (currentCourseInfo.folder) {
      sidebar.openToFolder(currentCourseInfo.folder.id, currentCourseInfo.folder.name);
    }
  }, [currentCourseInfo.folder, sidebar]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }
      if (sessionState !== 'playing') return;

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
          if (isFlipped && !isProcessing && !hasAnswered) {
            e.preventDefault();
            handleRating('hard');
          }
          break;
        case '2':
          if (isFlipped && !isProcessing && !hasAnswered) {
            e.preventDefault();
            handleRating('good');
          }
          break;
        case '3':
          if (isFlipped && !isProcessing && !hasAnswered) {
            e.preventDefault();
            handleRating('easy');
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          setIsFullscreen(prev => !prev);
          break;
        case 'Escape':
          if (isFullscreen) {
            e.preventDefault();
            setIsFullscreen(false);
          } else {
            e.preventDefault();
            router.back();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isProcessing, hasAnswered, sessionState, isFullscreen, handleFlip, handleRating, router]);

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={120}
            height={120}
            className="animate-bounce"
          />
          <p className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
            {translate('loading', 'Chargement...')}
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`}>
        <div className={`max-w-md w-full mx-4 p-6 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
          <h1 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {translate('auth_required_title', 'Connexion requise')}
          </h1>
          <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
            {translate('auth_required_description', 'Connectez-vous pour accéder à vos révisions.')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors ${
                isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {translate('back', 'Retour')}
            </button>
            <button
              onClick={() => router.push('/auth/signin')}
              className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
            >
              {translate('auth_signin_button', 'Se connecter')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`}>
        <div className={`max-w-md w-full mx-4 p-6 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
          <h1 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {translate('error_title', 'Erreur')}
          </h1>
          <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
            {error}
          </p>
          <button
            onClick={() => router.back()}
            className="w-full px-4 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
          >
            {translate('back', 'Retour')}
          </button>
        </div>
      </div>
    );
  }

  // No cards to review
  if (initialCards.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`}>
        <div className={`max-w-md w-full mx-4 p-6 rounded-2xl text-center ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isDark ? 'bg-green-500/20' : 'bg-green-100'
          }`}>
            <span className="text-3xl">✅</span>
          </div>
          <h1 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {translate('flashcard_no_reviews_title', 'Aucune révision !')}
          </h1>
          <p className={`text-sm mb-6 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
            {translate('flashcard_no_reviews_description', 'Tu as terminé toutes tes révisions du jour. Reviens demain !')}
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-4 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
          >
            {translate('go_to_dashboard', 'Aller au tableau de bord')}
          </button>
        </div>
      </div>
    );
  }

  // Progress percentage
  const progressPercentage = sessionCards.length > 0
    ? Math.round(((currentIndex + (hasAnswered ? 1 : 0)) / sessionCards.length) * 100)
    : 0;

  // Fullscreen mode
  if (isFullscreen && typeof document !== 'undefined' && currentCard && sessionState === 'playing') {
    const fullscreenContent = (
      <div className={`fixed inset-0 flex flex-col ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`} style={{ zIndex: 9999 }}>
        {/* Header plein écran */}
        <div className={`flex items-center justify-between px-4 sm:px-8 py-4 border-b ${
          isDark ? 'border-neutral-800' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-4">
            <span className={`text-sm font-medium ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {currentIndex + 1} / {sessionCards.length}
            </span>
            {sessionPoints > 0 && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-sm ${
                isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
              }`}>
                <Star className={`w-4 h-4 ${isDark ? 'fill-orange-400' : 'fill-orange-400'}`} />
                {sessionPoints} pts
              </span>
            )}
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <Minimize2 className="w-5 h-5" />
            <span className="hidden sm:inline text-sm">Esc</span>
          </button>
        </div>

        {/* Zone centrale : carte */}
        <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 overflow-visible" style={{ zIndex: 10 }}>
          {/* Carte */}
          <div
            onClick={handleFlip}
            className="relative w-full max-w-3xl cursor-pointer"
            style={{
              perspective: '1000px',
              height: 'min(60vh, 500px)',
            }}
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
                className={`absolute top-0 left-0 w-full h-full rounded-3xl border-2 shadow-2xl p-6 sm:p-10 md:p-12 flex flex-col items-center justify-center transition-colors ${
                  isDark ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-gray-200'
                }`}
                style={{ backfaceVisibility: 'hidden' }}
              >
                <span className="text-sm sm:text-base text-orange-500 font-semibold uppercase tracking-wide mb-4">
                  {FLASHCARD_TYPE_LABELS[currentCard.type] || currentCard.type}
                </span>
                <h3 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center leading-tight px-4 ${
                  isDark ? 'text-neutral-50' : 'text-gray-900'
                }`}>
                  {currentCard.front}
                </h3>
                <p className={`text-sm sm:text-base mt-6 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                  {translate('flashcards_tap_to_flip', 'Touchez pour retourner')}
                </p>
              </div>

              {/* Back - Answer */}
              <div
                className={`absolute top-0 left-0 w-full h-full rounded-3xl border-2 shadow-2xl p-6 sm:p-10 md:p-12 flex flex-col items-center justify-center overflow-y-auto transition-colors ${
                  isDark ? 'bg-orange-500/10 border-orange-500/40' : 'bg-orange-50 border-orange-300'
                }`}
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <span className={`text-sm sm:text-base font-semibold uppercase tracking-wide mb-4 ${
                  isDark ? 'text-orange-400' : 'text-orange-600'
                }`}>
                  {translate('flashcards_answer', 'Réponse')}
                </span>
                <p className={`text-lg sm:text-xl md:text-2xl lg:text-3xl text-center leading-relaxed px-4 ${
                  isDark ? 'text-neutral-200' : 'text-gray-800'
                }`}>
                  {currentCard.back}
                </p>
                {!hasAnswered && (
                  <p className={`text-sm sm:text-base mt-6 ${isDark ? 'text-orange-400/70' : 'text-orange-400'}`}>
                    {translate('flashcards_rate_answer', 'Note ta réponse')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Rating buttons - entre la carte et la barre du bas */}
        {isFlipped && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="py-6 flex items-center justify-center"
            style={{ position: 'relative', zIndex: 1 }}
          >
            <RatingButtons
              onRate={handleRating}
              currentProgress={currentCardProgress}
              disabled={hasAnswered}
            />
          </div>
        )}

        {/* Footer - barre de progression uniquement */}
        <div className={`px-4 sm:px-8 py-3 border-t ${isDark ? 'border-neutral-800' : 'border-gray-200'}`} style={{ position: 'relative', zIndex: 1 }}>
          <div className="max-w-3xl mx-auto">
            {/* Progress bar */}
            <div className="flex items-center justify-center gap-3">
              <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                {currentIndex + 1} / {sessionCards.length}
              </span>
              <div className={`flex-1 max-w-sm h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Esc"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );

    return createPortal(fullscreenContent, document.body);
  }

  return (
    <div className={`min-h-screen transition-colors ${
      isDark
        ? 'bg-neutral-900'
        : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
    }`}>
      {/* Sidebar navigation */}
      {user && (
        <CourseSidebar
          isOpen={sidebar.isOpen}
          level={sidebar.level}
          selectedFolderId={sidebar.selectedFolderId}
          selectedFolderName={sidebar.selectedFolderName}
          currentCourseId={isAllCourses ? undefined : courseId}
          onClose={sidebar.closeSidebar}
          onOpen={sidebar.openSidebar}
          onGoToFolderLevel={sidebar.goToFolderLevel}
          onGoToCourseLevel={sidebar.goToCourseLevel}
        />
      )}

      {/* Content wrapper - shifts right based on sidebar state */}
      <div
        className={`transition-transform duration-300 ease-out ${user ? 'ml-[72px]' : ''}`}
        style={{
          transform: user && sidebar.isOpen ? 'translateX(208px)' : 'translateX(0)',
        }}
      >
        <LearnPageHeader
          courseName={currentCourseInfo.title}
          folderName={currentCourseInfo.folder?.name || null}
          folderId={currentCourseInfo.folder?.id || null}
          onFolderClick={handleBreadcrumbFolderClick}
          maxWidth="4xl"
        />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {/* Session completed - show recap */}
          {sessionState === 'completed' && sessionStats ? (
            <div className={`rounded-2xl border shadow-sm overflow-hidden transition-colors ${
              isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
            }`}>
              <SessionRecap
                stats={sessionStats}
                onFinish={handleFinish}
                nextReviewInfo={{
                  date: translate('flashcard_tomorrow', 'demain'),
                  count: sessionStats.good + sessionStats.easy,
                }}
              />
            </div>
          ) : (
            /* Playing session */
            <div className="space-y-4">
              {/* Progress indicator and points */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                <button
                  onClick={() => router.back()}
                  className={`flex items-center gap-2 font-medium transition-colors ${
                    isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  {translate('back', 'Retour')}
                </button>
                <div className="flex items-center gap-1">
                  {sessionPoints > 0 && (
                    <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full font-semibold text-xs sm:text-sm ${
                      isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
                    }`}>
                      <Star className={`w-3 h-3 sm:w-4 sm:h-4 ${isDark ? 'fill-orange-400' : 'fill-orange-400'}`} />
                      {sessionPoints} pts
                    </span>
                  )}
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                    title={translate('flashcards_fullscreen') || 'Plein écran (F)'}
                  >
                    <Maximize2 className="w-5 h-5" />
                  </button>
                  <KeyboardHelpTooltip isDark={isDark} />
                </div>
              </div>

              {/* Flashcard */}
              {currentCard && (
                <div
                  onClick={handleFlip}
                  className="relative w-full aspect-[5/3] sm:aspect-[2/1] cursor-pointer"
                  style={{ perspective: '1000px' }}
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
                      className={`absolute inset-0 rounded-2xl border shadow-sm p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center transition-colors ${
                        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
                      }`}
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <span className="text-xs sm:text-sm text-orange-500 font-semibold uppercase tracking-wide mb-3">
                        {FLASHCARD_TYPE_LABELS[currentCard.type] || currentCard.type}
                      </span>
                      <h3 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-center px-2 leading-tight ${
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
                      className={`absolute inset-0 rounded-2xl border shadow-sm p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center overflow-y-auto transition-colors ${
                        isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'
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
                      <p className={`text-lg sm:text-xl md:text-2xl lg:text-3xl text-center leading-relaxed px-2 ${
                        isDark ? 'text-neutral-200' : 'text-gray-800'
                      }`}>
                        {currentCard.back}
                      </p>
                      {!hasAnswered && (
                        <p className={`text-sm sm:text-base mt-4 sm:mt-6 ${isDark ? 'text-orange-400/70' : 'text-orange-400'}`}>
                          {translate('flashcards_rate_answer', 'Note ta réponse')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Rating buttons - visible seulement quand la carte est retournée */}
              {isFlipped && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="h-20 flex items-center justify-center"
                >
                  <RatingButtons
                    onRate={handleRating}
                    currentProgress={currentCardProgress}
                    disabled={hasAnswered || isProcessing}
                  />
                </div>
              )}

              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-3">
                <span className={`text-xs sm:text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                  {currentIndex + 1} / {sessionCards.length}
                </span>
                <div className={`flex-1 max-w-xs h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
                  <div
                    className="h-full bg-orange-500 transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <button
                  onClick={() => setIsFullscreen(true)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title="F"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
