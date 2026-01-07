'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw, ChevronLeft, ChevronRight, Star, UserPlus, HelpCircle, Plus, X, Trash2, Pencil, Maximize2, Minimize2, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import GenerationLoadingScreen from './GenerationLoadingScreen';
import FlashcardPersonnalisationScreen from './FlashcardPersonnalisationScreen';
import ProgressiveFlashcardsView, { StreamingFlashcard } from './ProgressiveFlashcardsView';
import { FlashcardConfig } from '@/types/flashcard-config';
import RatingButtons from '@/components/flashcards/RatingButtons';
import SessionRecap from '@/components/flashcards/SessionRecap';
import { Rating, calculateNextReview, getMasteryLevel, FlashcardProgress, SessionStats, createSessionStats, updateSessionStats, completeSessionStats } from '@/lib/spaced-repetition';

// Mapping des types de cartes vers des labels lisibles
const FLASHCARD_TYPE_LABELS: Record<string, string> = {
  // Types Anki
  basic: 'Question',
  cloze: 'Texte à trous',
  reversed: 'Vocabulaire',
  // Types legacy
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

interface Flashcard {
  id: string;
  type: string;
  front: string;
  back: string;
  mastery: 'new' | 'learning' | 'reviewing' | 'mastered';
  correctCount: number;
  incorrectCount: number;
  chapterId?: string | null;
  // Spaced repetition fields
  easeFactor?: number;
  intervalDays?: number;
  nextReviewAt?: string;
  reviewCount?: number;
  lastRating?: Rating;
}

interface FlashcardsViewProps {
  courseId: string;
  courseTitle: string;
  courseStatus?: string; // 'pending' | 'processing' | 'ready' | 'failed'
  onModalStateChange?: (isOpen: boolean) => void;
}

// Number of flashcards accessible without an account
const GUEST_FLASHCARD_LIMIT = 5;

export default function FlashcardsView({ courseId, courseTitle, courseStatus, onModalStateChange }: FlashcardsViewProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { triggerRefresh } = useCoursesRefresh();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [studyQueue, setStudyQueue] = useState<number[]>([]);
  const [sessionPoints, setSessionPoints] = useState(0);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showCardLimitModal, setShowCardLimitModal] = useState(false); // Modal when trying to access card 6+
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCardFront, setNewCardFront] = useState('');
  const [newCardBack, setNewCardBack] = useState('');
  const [addingCard, setAddingCard] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCardFront, setEditCardFront] = useState('');
  const [editCardBack, setEditCardBack] = useState('');
  const [editingCard, setEditingCard] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Session state for tracking progress and showing recap
  const [sessionState, setSessionState] = useState<'playing' | 'completed'>('playing');
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

  // Streaming state for progressive loading
  const [generationProgress, setGenerationProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [cardsGenerated, setCardsGenerated] = useState(0);
  const [totalCards, setTotalCards] = useState<number | undefined>(undefined);
  const [streamingFlashcards, setStreamingFlashcards] = useState<StreamingFlashcard[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if current card index is beyond guest limit
  const isCardLocked = !user && currentIndex >= GUEST_FLASHCARD_LIMIT;
  const remainingLockedCards = !user ? Math.max(0, flashcards.length - GUEST_FLASHCARD_LIMIT) : 0;

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
              chapterId: fc.chapterId,
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

  // Block body scroll and notify parent when modal is open
  useEffect(() => {
    const isModalOpen = showSignupModal || showCardLimitModal || showAddModal || showDeleteModal || showRegenerateModal || showEditModal;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    onModalStateChange?.(isModalOpen);
    return () => {
      document.body.style.overflow = '';
    };
  }, [showSignupModal, showCardLimitModal, showAddModal, showDeleteModal, showRegenerateModal, showEditModal, onModalStateChange]);

  // Initial generation is allowed for anonymous users
  // Regeneration requires an account
  const handleGenerate = async (config?: FlashcardConfig, isRegeneration: boolean = false) => {
    // For regeneration, require account
    if (isRegeneration && !user) {
      setShowSignupModal(true);
      return;
    }

    // Reset streaming state
    setGenerating(true);
    setError(null);
    setGenerationProgress(0);
    setProgressMessage('');
    setCardsGenerated(0);
    setTotalCards(undefined);
    setStreamingFlashcards([]);

    // Create abort controller for SSE
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/courses/${courseId}/flashcards/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config || {}),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to generate flashcards');
        } catch {
          throw new Error('Failed to generate flashcards');
        }
      }

      // Handle SSE streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                setProgressMessage(data.message || '');
                setGenerationProgress(data.progress || 0);
                if (data.cardsGenerated !== undefined) {
                  setCardsGenerated(data.cardsGenerated);
                }
                if (data.totalCards !== undefined) {
                  setTotalCards(data.totalCards);
                }
              } else if (data.type === 'flashcard') {
                // Add the flashcard to streaming list for progressive display
                if (data.flashcard) {
                  const streamingCard: StreamingFlashcard = {
                    id: data.flashcard.id || `temp-${Date.now()}-${Math.random()}`,
                    type: data.flashcard.type || 'basic',
                    front: data.flashcard.front || data.flashcard.concept || '',
                    back: data.flashcard.back || data.flashcard.definition || '',
                  };
                  setStreamingFlashcards(prev => [...prev, streamingCard]);
                }
                // Update progress counters
                setCardsGenerated(data.cardsGenerated || 0);
                setTotalCards(data.totalCards);
                setGenerationProgress(data.progress || 0);
              } else if (data.type === 'complete') {
                setGenerationProgress(100);
                setCardsGenerated(data.cardsGenerated || 0);
                setTotalCards(data.totalCards);
              } else if (data.type === 'error') {
                throw new Error(data.message || 'Generation failed');
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete data
              if (parseError instanceof Error && parseError.message !== 'Generation failed') {
                console.warn('Error parsing SSE data:', parseError);
              } else {
                throw parseError;
              }
            }
          }
        }
      }

      // Generation complete - fetch final flashcards from server to ensure consistency
      const flashcardsResponse = await fetch(`/api/courses/${courseId}/flashcards`);
      if (flashcardsResponse.ok) {
        const flashcardsData = await flashcardsResponse.json();
        if (flashcardsData.flashcards && flashcardsData.flashcards.length > 0) {
          const normalizedFlashcards = flashcardsData.flashcards.map((fc: Flashcard & { concept?: string; definition?: string }) => ({
            id: fc.id,
            type: fc.type || 'definition',
            front: fc.front || fc.concept || '',
            back: fc.back || fc.definition || '',
            mastery: fc.mastery || 'new',
            correctCount: fc.correctCount || 0,
            incorrectCount: fc.incorrectCount || 0,
            chapterId: fc.chapterId,
          }));
          setFlashcards(normalizedFlashcards);
        }
      }

      setCurrentIndex(0);
      setIsFlipped(false);
      setHasAnswered(false);
      setStudyQueue([]);
      // Trigger global refresh to update course cards
      triggerRefresh();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Generation was cancelled
        return;
      }
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleAddCard = async () => {
    if (!user) {
      setShowSignupModal(true);
      return;
    }

    if (!newCardFront.trim() || !newCardBack.trim()) {
      return;
    }

    setAddingCard(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front: newCardFront.trim(),
          back: newCardBack.trim(),
          type: 'definition', // Use 'definition' as default type for manual cards
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create flashcard');
      }

      const data = await response.json();
      // Add the new flashcard to the list
      setFlashcards((prev) => [...prev, data.flashcard]);
      // Navigate to the new card
      setCurrentIndex(flashcards.length);
      setIsFlipped(false);
      setHasAnswered(false);
      // Reset form and close modal
      setNewCardFront('');
      setNewCardBack('');
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAddingCard(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!user) {
      setShowSignupModal(true);
      return;
    }

    const cardToDelete = flashcards[currentIndex];
    if (!cardToDelete) return;

    setDeletingCard(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/flashcards?flashcardId=${cardToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete flashcard');
      }

      // Remove the flashcard from the list
      const newFlashcards = flashcards.filter((_, idx) => idx !== currentIndex);
      setFlashcards(newFlashcards);

      // Adjust current index if needed
      if (newFlashcards.length === 0) {
        setCurrentIndex(0);
      } else if (currentIndex >= newFlashcards.length) {
        setCurrentIndex(newFlashcards.length - 1);
      }

      setIsFlipped(false);
      setHasAnswered(false);
      setShowDeleteModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDeletingCard(false);
    }
  };

  const openEditModal = () => {
    if (!user) {
      setShowSignupModal(true);
      return;
    }

    const cardToEdit = flashcards[currentIndex];
    if (!cardToEdit) return;

    setEditCardFront(cardToEdit.front);
    setEditCardBack(cardToEdit.back);
    setShowEditModal(true);
  };

  const handleEditCard = async () => {
    if (!user) {
      setShowSignupModal(true);
      return;
    }

    if (!editCardFront.trim() || !editCardBack.trim()) {
      return;
    }

    const cardToEdit = flashcards[currentIndex];
    if (!cardToEdit) return;

    setEditingCard(true);
    try {
      const response = await fetch(`/api/courses/${courseId}/flashcards`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashcardId: cardToEdit.id,
          front: editCardFront.trim(),
          back: editCardBack.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update flashcard');
      }

      const data = await response.json();
      // Update the flashcard in the list
      const updatedFlashcards = [...flashcards];
      updatedFlashcards[currentIndex] = {
        ...updatedFlashcards[currentIndex],
        front: data.flashcard.front,
        back: data.flashcard.back,
      };
      setFlashcards(updatedFlashcards);

      // Reset form and close modal
      setEditCardFront('');
      setEditCardBack('');
      setShowEditModal(false);
      setIsFlipped(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setEditingCard(false);
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

  const handleNext = useCallback(() => {
    const nextIndex = (currentIndex + 1) % flashcards.length;
    // Check if next card is locked for guests
    if (!user && nextIndex >= GUEST_FLASHCARD_LIMIT) {
      setShowCardLimitModal(true);
      return;
    }
    setIsFlipped(false);
    setHasAnswered(false);
    setCurrentIndex(nextIndex);
  }, [currentIndex, flashcards.length, user]);

  const handlePrev = useCallback(() => {
    const prevIndex = (currentIndex - 1 + flashcards.length) % flashcards.length;
    // Check if prev card is locked for guests (wrapping around)
    if (!user && prevIndex >= GUEST_FLASHCARD_LIMIT) {
      setShowCardLimitModal(true);
      return;
    }
    setIsFlipped(false);
    setHasAnswered(false);
    setCurrentIndex(prevIndex);
  }, [currentIndex, flashcards.length, user]);

  const handleFlip = useCallback(() => {
    // Don't flip if card is locked
    if (isCardLocked) {
      setShowCardLimitModal(true);
      return;
    }
    setIsFlipped((prev) => !prev);
  }, [isCardLocked]);

  // Get current card's progress for spaced repetition
  const currentCardProgress: FlashcardProgress | null = useMemo(() => {
    const card = flashcards[currentIndex];
    if (!card || !card.easeFactor) return null;
    return {
      ease_factor: card.easeFactor,
      interval_days: card.intervalDays || 0,
      next_review_at: card.nextReviewAt ? new Date(card.nextReviewAt) : new Date(),
    };
  }, [flashcards, currentIndex]);

  const handleRating = useCallback(async (rating: Rating) => {
    if (hasAnswered) return;
    setHasAnswered(true);

    // Initialize session stats if not already done
    if (!sessionStats) {
      setSessionStats(createSessionStats(flashcards.length));
    }

    // Update session stats
    setSessionStats(prev => prev ? updateSessionStats(prev, rating) : createSessionStats(flashcards.length));

    // Award points based on rating
    const pointsMap: Record<Rating, number> = {
      hard: 0,
      good: 10,
      easy: 15,
    };
    setSessionPoints((prev) => prev + pointsMap[rating]);

    const card = flashcards[currentIndex];

    // Calculate new spaced repetition values
    const newProgress = calculateNextReview(currentCardProgress, rating);
    const newMastery = getMasteryLevel(newProgress.interval_days);

    const updatedCard: Flashcard = {
      ...card,
      correctCount: rating === 'good' || rating === 'easy' ? card.correctCount + 1 : card.correctCount,
      incorrectCount: rating === 'hard' ? card.incorrectCount + 1 : card.incorrectCount,
      mastery: newMastery,
      easeFactor: newProgress.ease_factor,
      intervalDays: newProgress.interval_days,
      nextReviewAt: newProgress.next_review_at.toISOString(),
      reviewCount: (card.reviewCount || 0) + 1,
      lastRating: rating,
    };

    // Save to server with spaced repetition data
    if (user) {
      fetch('/api/flashcards/reviews/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashcardId: card.id,
          rating,
          easeFactor: newProgress.ease_factor,
          intervalDays: newProgress.interval_days,
          nextReviewAt: newProgress.next_review_at.toISOString(),
          mastery: newMastery,
          reviewCount: (card.reviewCount || 0) + 1,
          correctCount: updatedCard.correctCount,
          incorrectCount: updatedCard.incorrectCount,
        }),
      }).catch(err => console.error('Error saving rating:', err));
    }

    // Check if this is the last card
    const isLastCard = currentIndex + 1 >= flashcards.length;

    // Auto-advance to next card after a short delay
    // Update local state only when moving to the next card to avoid showing
    // updated interval values while the current card is still visible
    setTimeout(async () => {
      // Update local state when moving to next card
      const updatedFlashcards = [...flashcards];
      updatedFlashcards[currentIndex] = updatedCard;
      setFlashcards(updatedFlashcards);

      if (isLastCard) {
        // Session completed - show recap
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
                points_earned: sessionPoints + pointsMap[rating],
                questions_answered: flashcards.length,
                questions_correct: flashcards.filter((_, idx) => idx < currentIndex).length + (rating === 'good' || rating === 'easy' ? 1 : 0),
              }),
            });
          } catch (err) {
            console.error('Error recording flashcard activity:', err);
          }
        }
      } else {
        setIsFlipped(false);
        setHasAnswered(false);
        setCurrentIndex((prev) => prev + 1);
      }
    }, 400);
  }, [hasAnswered, flashcards, currentIndex, currentCardProgress, user, sessionStats, sessionPoints]);

  // Keyboard navigation
  useEffect(() => {
    if (flashcards.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          if (!isFlipped) {
            handleFlip();
          }
          break;
        case '1':
          // Difficile - only when flipped and not already answered
          if (isFlipped && !hasAnswered) {
            e.preventDefault();
            handleRating('hard');
          }
          break;
        case '2':
          // Bien - only when flipped and not already answered
          if (isFlipped && !hasAnswered) {
            e.preventDefault();
            handleRating('good');
          }
          break;
        case '3':
          // Facile - only when flipped and not already answered
          if (isFlipped && !hasAnswered) {
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
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flashcards.length, isFlipped, hasAnswered, isFullscreen, handleFlip, handleRating]);

  if (loading) {
    return (
      <div className={`rounded-2xl border shadow-sm p-8 text-center transition-colors ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
        <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{translate('loading')}</p>
      </div>
    );
  }

  // Course still processing (text extraction) - show waiting message with mascot
  if (courseStatus === 'pending' || courseStatus === 'processing') {
    return <GenerationLoadingScreen type="extraction" />;
  }

  // No flashcards yet - show personnalisation screen
  if (flashcards.length === 0) {
    return (
      <>
        {error && (
          <div
            className="rounded-xl p-3 mb-4 text-sm border"
            style={{
              backgroundColor: isDark ? 'rgba(217, 26, 28, 0.15)' : '#fff6f3',
              borderColor: isDark ? 'rgba(217, 26, 28, 0.3)' : 'rgba(217, 26, 28, 0.3)',
              color: isDark ? '#e94446' : '#d91a1c'
            }}
          >
            {error}
          </div>
        )}

        {generating ? (
          streamingFlashcards.length > 0 ? (
            // Show progressive view once cards start arriving
            <ProgressiveFlashcardsView
              flashcards={streamingFlashcards}
              isGenerating={generating}
              progress={generationProgress}
              cardsGenerated={cardsGenerated}
              totalCards={totalCards}
              progressMessage={progressMessage}
              courseId={courseId}
              onComplete={() => {
                // Refresh will happen automatically when generation completes
              }}
            />
          ) : (
            // Show loading screen while waiting for first card
            <GenerationLoadingScreen
              type="flashcards"
              progress={generationProgress}
              progressMessage={progressMessage}
              itemsGenerated={cardsGenerated}
              totalItems={totalCards}
            />
          )
        ) : (
          <FlashcardPersonnalisationScreen
            onGenerate={handleGenerate}
            isGenerating={generating}
          />
        )}

        {/* Signup Modal */}
        {showSignupModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]">
            <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
              isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
            }`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDark ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <UserPlus className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('flashcards_signup_title')}
              </h3>
              <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                {translate('flashcards_signup_description')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignupModal(false)}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                    isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
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

  // Session completed - show recap screen
  if (sessionState === 'completed' && sessionStats) {
    const handleRestartSession = () => {
      setSessionState('playing');
      setSessionStats(null);
      setCurrentIndex(0);
      setIsFlipped(false);
      setHasAnswered(false);
      setSessionPoints(0);
    };

    return (
      <div className={`rounded-2xl border shadow-sm overflow-hidden transition-colors ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        <SessionRecap
          stats={sessionStats}
          onFinish={handleRestartSession}
          nextReviewInfo={{
            date: translate('flashcard_tomorrow', 'demain'),
            count: sessionStats.good + sessionStats.easy,
          }}
        />
      </div>
    );
  }

  // Show flashcard carousel
  const currentCard = flashcards[currentIndex];

  // Mode plein écran - utilise createPortal pour s'assurer qu'il est au-dessus de tout
  if (isFullscreen && typeof document !== 'undefined') {
    const fullscreenContent = (
      <div className={`fixed inset-0 flex flex-col ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`} style={{ zIndex: 9999 }}>
        {/* Header plein écran */}
        <div className={`flex items-center justify-between px-4 sm:px-8 py-4 border-b ${
          isDark ? 'border-neutral-800' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-4">
            <span className={`text-sm font-medium ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {currentIndex + 1} / {flashcards.length}
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
                  {translate('flashcards_tap_to_flip')}
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
                  {translate('flashcards_answer')}
                </span>
                <p className={`text-lg sm:text-xl md:text-2xl lg:text-3xl text-center leading-relaxed px-4 ${
                  isDark ? 'text-neutral-200' : 'text-gray-800'
                }`}>
                  {currentCard.back}
                </p>
                {!hasAnswered && (
                  <p className={`text-sm sm:text-base mt-6 ${isDark ? 'text-orange-400/70' : 'text-orange-400'}`}>
                    {translate('flashcards_rate_answer')}
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
                {currentIndex + 1} / {flashcards.length}
              </span>
              <div className={`flex-1 max-w-sm h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
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

    return (
      <>
        {createPortal(fullscreenContent, document.body)}
        {/* Card Limit Modal for Anonymous Users in fullscreen */}
        {showCardLimitModal && createPortal(
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
            <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
              isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
            }`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isDark ? 'bg-orange-500/20' : 'bg-orange-100'
              }`}>
                <Lock className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('flashcards_limit_title')}
              </h3>
              <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                {translate('flashcards_limit_description', { count: String(remainingLockedCards) })}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCardLimitModal(false)}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                    isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
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
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator and points */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <span className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{translate('flashcards_progress', { current: String(currentIndex + 1), total: String(flashcards.length) })}</span>
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
            onClick={() => user ? setShowAddModal(true) : setShowSignupModal(true)}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title={translate('flashcards_add') || 'Ajouter'}
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => user ? openEditModal() : setShowSignupModal(true)}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Modifier"
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button
            onClick={() => user ? setShowDeleteModal(true) : setShowSignupModal(true)}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title={translate('flashcards_delete') || 'Supprimer'}
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => user ? setShowRegenerateModal(true) : setShowSignupModal(true)}
            disabled={generating}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/20' : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
            }`}
            title={translate('flashcards_regenerate') || 'Régénérer'}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
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
      <div
        onClick={handleFlip}
        className="relative w-full aspect-[5/3] sm:aspect-[2/1] cursor-pointer perspective-1000"
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
            className={`absolute inset-0 rounded-2xl border shadow-sm p-6 sm:p-8 md:p-10 flex flex-col items-center justify-center backface-hidden transition-colors ${
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
            <p className={`text-sm sm:text-base mt-4 sm:mt-6 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>{translate('flashcards_tap_to_flip')}</p>
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
              {translate('flashcards_answer')}
            </span>
            <p className={`text-lg sm:text-xl md:text-2xl lg:text-3xl text-center leading-relaxed px-2 ${
              isDark ? 'text-neutral-200' : 'text-gray-800'
            }`}>
              {currentCard.back}
            </p>
            {!hasAnswered && (
              <p className={`text-sm sm:text-base mt-4 sm:mt-6 ${isDark ? 'text-orange-400/70' : 'text-orange-400'}`}>{translate('flashcards_rate_answer')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons - visible seulement quand la carte est retournée */}
      {isFlipped && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="h-20 flex items-center justify-center"
        >
          <RatingButtons
            onRate={handleRating}
            currentProgress={currentCardProgress}
            disabled={hasAnswered}
          />
        </div>
      )}

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-xs sm:text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
          {currentIndex + 1} / {flashcards.length}
        </span>
        <div className={`flex-1 max-w-xs h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
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

      {/* Signup Modal */}
      {showSignupModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDark ? 'bg-orange-500/20' : 'bg-orange-100'
            }`}>
              <UserPlus className="w-7 h-7 text-orange-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              {translate('signup_to_continue_title')}
            </h3>
            <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {translate('signup_to_continue_description')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignupModal(false)}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
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
        </div>,
        document.body
      )}

      {/* Add Flashcard Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`rounded-2xl max-w-lg w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('flashcards_add_title') || 'Ajouter une flashcard'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewCardFront('');
                  setNewCardBack('');
                }}
                className={`p-2 rounded-full transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  {translate('flashcards_add_front') || 'Recto (question/terme)'}
                </label>
                <textarea
                  value={newCardFront}
                  onChange={(e) => setNewCardFront(e.target.value)}
                  placeholder={translate('flashcards_add_front_placeholder') || 'Ex: Quelle est la capitale de la France ?'}
                  rows={2}
                  className={`w-full p-3 rounded-xl border-2 focus:border-orange-500 focus:outline-none transition-colors resize-none ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  {translate('flashcards_add_back') || 'Verso (réponse/définition)'}
                </label>
                <textarea
                  value={newCardBack}
                  onChange={(e) => setNewCardBack(e.target.value)}
                  placeholder={translate('flashcards_add_back_placeholder') || 'Ex: Paris'}
                  rows={3}
                  className={`w-full p-3 rounded-xl border-2 focus:border-orange-500 focus:outline-none transition-colors resize-none ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewCardFront('');
                  setNewCardBack('');
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleAddCard}
                disabled={addingCard || !newCardFront.trim() || !newCardBack.trim()}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {addingCard ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {translate('flashcards_adding') || 'Ajout...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    {translate('flashcards_add_button') || 'Ajouter'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3' }}
            >
              <Trash2 className="w-7 h-7" style={{ color: '#d91a1c' }} />
            </div>
            <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              {translate('flashcards_delete_title') || 'Supprimer cette flashcard ?'}
            </h3>
            <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {translate('flashcards_delete_description') || 'Cette action est irréversible. La flashcard sera définitivement supprimée.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingCard}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleDeleteCard}
                disabled={deletingCard}
                className="flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: '#d91a1c' }}
                onMouseEnter={(e) => !deletingCard && (e.currentTarget.style.backgroundColor = '#b81618')}
                onMouseLeave={(e) => !deletingCard && (e.currentTarget.style.backgroundColor = '#d91a1c')}
              >
                {deletingCard ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {translate('flashcards_deleting') || 'Suppression...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {translate('flashcards_delete_confirm') || 'Supprimer'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Flashcard Modal */}
      {showEditModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`rounded-2xl max-w-lg w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                {translate('flashcards_edit_title')}
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditCardFront('');
                  setEditCardBack('');
                }}
                className={`p-2 rounded-full transition-colors ${
                  isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  {translate('flashcards_edit_front_label')}
                </label>
                <textarea
                  value={editCardFront}
                  onChange={(e) => setEditCardFront(e.target.value)}
                  rows={2}
                  className={`w-full p-3 rounded-xl border-2 focus:border-orange-500 focus:outline-none transition-colors resize-none ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  {translate('flashcards_edit_back_label')}
                </label>
                <textarea
                  value={editCardBack}
                  onChange={(e) => setEditCardBack(e.target.value)}
                  rows={3}
                  className={`w-full p-3 rounded-xl border-2 focus:border-orange-500 focus:outline-none transition-colors resize-none ${
                    isDark
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-100 placeholder-neutral-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                  }`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditCardFront('');
                  setEditCardBack('');
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {translate('cancel')}
              </button>
              <button
                onClick={handleEditCard}
                disabled={editingCard || !editCardFront.trim() || !editCardBack.trim()}
                className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {editingCard ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {translate('flashcards_edit_saving')}
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" />
                    {translate('flashcards_edit_save')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Regenerate Modal with Personalization */}
      {showRegenerateModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`rounded-2xl max-w-md w-full shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <FlashcardPersonnalisationScreen
              onGenerate={(config) => {
                setShowRegenerateModal(false);
                handleGenerate(config, true); // true = regeneration
              }}
              onCancel={() => setShowRegenerateModal(false)}
              isGenerating={generating}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Card Limit Modal for Anonymous Users */}
      {showCardLimitModal && createPortal(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDark ? 'bg-orange-500/20' : 'bg-orange-100'
            }`}>
              <Lock className="w-7 h-7 text-orange-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              {translate('flashcards_limit_title')}
            </h3>
            <p className={`text-sm mb-6 text-center ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {translate('flashcards_limit_description', { count: String(remainingLockedCards) })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCardLimitModal(false)}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
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
        </div>,
        document.body
      )}

      {/* Toast de chargement pendant la régénération */}
      {generating && flashcards.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
            isDark
              ? 'bg-neutral-800 border-neutral-700 text-neutral-100'
              : 'bg-white border-gray-200 text-gray-900'
          }`}>
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {translate('flashcards_regenerating') || 'Régénération des flashcards...'}
              </span>
              {cardsGenerated > 0 && (
                <span className={`text-xs ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  {cardsGenerated}{totalCards ? ` / ${totalCards}` : ''} {translate('flashcards_cards_generated') || 'cartes générées'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
