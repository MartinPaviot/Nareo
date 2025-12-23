'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw, ChevronLeft, ChevronRight, Sparkles, ThumbsUp, ThumbsDown, Star, UserPlus, HelpCircle, Plus, X, Trash2, Pencil, Maximize2, Minimize2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import GenerationLoadingScreen from './GenerationLoadingScreen';
import FlashcardPersonnalisationScreen from './FlashcardPersonnalisationScreen';
import { FlashcardConfig } from '@/types/flashcard-config';

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
        <div className={`absolute right-0 top-full mt-1 z-50 text-xs rounded-lg p-3 shadow-lg min-w-[200px] ${
          isDark ? 'bg-neutral-700 text-neutral-100' : 'bg-gray-900 text-white'
        }`}>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>← →</span>
              <span>{translate('flashcards_nav_cards') || 'Navigate cards'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>Space / ↑ ↓</span>
              <span>{translate('flashcards_flip') || 'Flip card'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>⌫ Backspace</span>
              <span>{translate('flashcards_didnt_know') || "Didn't know"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>↵ Enter</span>
              <span>{translate('flashcards_knew_it') || 'Knew it'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>F</span>
              <span>{translate('flashcards_fullscreen') || 'Fullscreen'}</span>
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
}

interface FlashcardsViewProps {
  courseId: string;
  courseTitle: string;
  courseStatus?: string; // 'pending' | 'processing' | 'ready' | 'failed'
}

export default function FlashcardsView({ courseId, courseTitle, courseStatus }: FlashcardsViewProps) {
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

  const handleGenerate = async (config?: FlashcardConfig) => {
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config || {}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate flashcards');
      }

      const data = await response.json();
      setFlashcards(data.flashcards);
      setCurrentIndex(0);
      setIsFlipped(false);
      setHasAnswered(false);
      setStudyQueue([]);
      // Trigger global refresh to update course cards
      triggerRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
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
    setIsFlipped(false);
    setHasAnswered(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  }, [flashcards.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    setHasAnswered(false);
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  }, [flashcards.length]);

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (flashcards.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          handleFlip();
          break;
        case 'Backspace':
          // "Didn't know" - only when flipped and not already answered
          if (isFlipped && !hasAnswered) {
            e.preventDefault();
            handleFeedback(false);
          }
          break;
        case 'Enter':
          // "Knew it" - only when flipped and not already answered
          if (isFlipped && !hasAnswered) {
            e.preventDefault();
            handleFeedback(true);
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
  }, [flashcards.length, isFlipped, hasAnswered, isFullscreen, handleNext, handlePrev, handleFlip]);

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
          <div className={`rounded-xl p-3 mb-4 text-sm ${
            isDark ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {error}
          </div>
        )}

        {generating ? (
          <GenerationLoadingScreen type="flashcards" />
        ) : (
          <FlashcardPersonnalisationScreen
            onGenerate={handleGenerate}
            isGenerating={generating}
          />
        )}

        {/* Signup Modal */}
        {showSignupModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
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

  // Show flashcard carousel
  const currentCard = flashcards[currentIndex];

  // Mode plein écran
  if (isFullscreen) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`}>
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

        {/* Carte centrée */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden">
          <div
            onClick={handleFlip}
            className="relative w-full max-w-3xl h-full max-h-[60vh] cursor-pointer perspective-1000"
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
                className={`absolute inset-0 rounded-3xl border-2 shadow-2xl p-6 sm:p-10 md:p-12 flex flex-col items-center justify-center backface-hidden transition-colors ${
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
                className={`absolute inset-0 rounded-3xl border-2 shadow-2xl p-6 sm:p-10 md:p-12 flex flex-col items-center justify-center overflow-y-auto transition-colors ${
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

        {/* Footer compact avec contrôles */}
        <div className={`px-4 sm:px-8 py-3 border-t ${isDark ? 'border-neutral-800' : 'border-gray-200'}`}>
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            {/* Feedback buttons */}
            {isFlipped && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFeedback(false);
                  }}
                  disabled={hasAnswered}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    hasAnswered
                      ? isDark ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  }`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span>{translate('flashcards_didnt_know')}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFeedback(true);
                  }}
                  disabled={hasAnswered}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    hasAnswered
                      ? isDark ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isDark ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30' : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span>{translate('flashcards_knew_it')}</span>
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handlePrev}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Progress bar */}
              <div className={`flex-1 max-w-sm h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
                />
              </div>

              <button
                onClick={handleNext}
                className={`p-2 rounded-lg transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator and points */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <span className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{translate('flashcards_progress', { current: String(currentIndex + 1), total: String(flashcards.length) })}</span>
        <div className="flex items-center gap-2 sm:gap-4">
          {sessionPoints > 0 && (
            <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full font-semibold text-xs sm:text-sm ${
              isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'
            }`}>
              <Star className={`w-3 h-3 sm:w-4 sm:h-4 ${isDark ? 'fill-orange-400' : 'fill-orange-400'}`} />
              {sessionPoints} pts
            </span>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className={`p-1.5 rounded-md transition-colors ${
              isDark ? 'text-green-400 hover:text-green-300 hover:bg-green-500/10' : 'text-green-600 hover:text-green-700 hover:bg-green-50'
            }`}
            title={translate('flashcards_add') || 'Ajouter'}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={openEditModal}
            className={`p-1.5 rounded-md transition-colors ${
              isDark ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className={`p-1.5 rounded-md transition-colors ${
              isDark ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-red-500 hover:text-red-600 hover:bg-red-50'
            }`}
            title={translate('flashcards_delete') || 'Supprimer'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowRegenerateModal(true)}
            disabled={generating}
            className={`p-1.5 rounded-md transition-colors ${
              isDark ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/10' : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
            }`}
            title={translate('flashcards_regenerate') || 'Régénérer'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(true)}
            className={`p-1.5 rounded-md transition-colors ${
              isDark ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10' : 'text-purple-600 hover:text-purple-700 hover:bg-purple-50'
            }`}
            title={translate('flashcards_fullscreen') || 'Plein écran (F)'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <KeyboardHelpTooltip isDark={isDark} />
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
                ? isDark ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
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
                ? isDark ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : isDark ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30' : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
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
          className={`p-2 sm:p-3 rounded-xl transition-colors ${
            isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
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
                  idx === currentIndex ? 'bg-orange-500' : isDark ? 'bg-neutral-700' : 'bg-gray-300'
                }`}
              />
            ))
          ) : (
            <span className={`text-xs sm:text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              {currentIndex + 1} / {flashcards.length}
            </span>
          )}
        </div>

        <button
          onClick={handleNext}
          className={`p-2 sm:p-3 rounded-xl transition-colors ${
            isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Signup Modal */}
      {showSignupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
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

      {/* Add Flashcard Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
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
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDark ? 'bg-red-500/20' : 'bg-red-100'
            }`}>
              <Trash2 className="w-7 h-7 text-red-500" />
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
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
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
        </div>
      )}

      {/* Edit Flashcard Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-lg w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                Modifier la flashcard
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
                  Recto (question/terme)
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
                  Verso (réponse/définition)
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
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Modal with Personalization */}
      {showRegenerateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-md w-full shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <FlashcardPersonnalisationScreen
              onGenerate={(config) => {
                setShowRegenerateModal(false);
                handleGenerate(config);
              }}
              onCancel={() => setShowRegenerateModal(false)}
              isGenerating={generating}
            />
          </div>
        </div>
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
            <span className="text-sm font-medium">
              {translate('flashcards_regenerating') || 'Régénération des flashcards...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
