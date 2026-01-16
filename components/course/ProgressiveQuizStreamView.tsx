'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Loader2, HelpCircle, ArrowRight, Maximize2, Minimize2, RotateCcw, Gamepad2, Gift, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import QuizSessionRecap, { QuizSessionStats, QuestionResult } from './QuizSessionRecap';

// Question interface matching the SSE event data
export interface StreamingQuestion {
  id: string;
  chapterId: string;
  chapterTitle: string;
  chapterIndex: number;
  questionNumber: number;
  questionText: string;
  options: string[];
  type: string;
  correctOptionIndex: number;
  explanation: string;
  points: number;
  phase?: string;
  sourceExcerpt?: string | null;
  pageNumber?: number | null;
}

// Shuffled option with label and original index tracking
interface ShuffledOption {
  label: string;
  value: string;
  index: number; // New index after shuffle
  originalIndex: number; // Original index before shuffle
}

// Question with shuffled options
interface ShuffledQuestion {
  id: string;
  questionText: string;
  optionsList: ShuffledOption[];
  correctOptionIndex: number; // Updated index after shuffle
  originalCorrectIndex: number; // Original correct index
  explanation: string;
  points: number;
}

interface ProgressiveQuizStreamViewProps {
  /** Questions received so far */
  questions: StreamingQuestion[];
  /** Whether more questions are being generated */
  isGenerating: boolean;
  /** Current generation progress (0-100) */
  progress: number;
  /** Number of questions generated */
  questionsGenerated: number;
  /** Current chapter being processed */
  currentChapter?: number;
  /** Total chapters */
  totalChapters?: number;
  /** Current progress message */
  progressMessage?: string;
  /** Called when quiz is finished */
  onComplete?: () => void;
  /** Course ID for tracking */
  courseId: string;
  /** Course title for recap */
  courseTitle?: string;
  /** Called when user wants to create a challenge */
  onCreateChallenge?: () => void;
  /** Called when user wants to regenerate the quiz */
  onRegenerate?: () => void;
}

interface QuestionAnswer {
  questionId: string;
  questionText: string;
  selectedLabel: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Normalize and shuffle options (like in chapter quiz)
function normalizeAndShuffleOptions(options: string[], correctIndex: number): { optionsList: ShuffledOption[]; newCorrectIndex: number } {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Create array with original indices
  const optionsWithOriginalIndex = options.map((value, idx) => ({
    value,
    originalIndex: idx,
  }));

  // Shuffle the options
  const shuffled = shuffleArray(optionsWithOriginalIndex);

  // Find the new index of the correct answer
  const newCorrectIndex = shuffled.findIndex(opt => opt.originalIndex === correctIndex);

  // Assign labels A, B, C, D to shuffled options
  const optionsList = shuffled.map((opt, idx) => ({
    label: letters[idx] || String.fromCharCode(65 + idx),
    value: opt.value,
    index: idx,
    originalIndex: opt.originalIndex,
  }));

  return { optionsList, newCorrectIndex };
}

// Keyboard shortcuts tooltip
function KeyboardHelpTooltip({ isDark }: { isDark?: boolean }) {
  const [isVisible, setIsVisible] = useState(false);

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
        aria-label="Raccourcis clavier"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {isVisible && (
        <div className={`absolute right-0 top-full mt-1 z-50 text-xs rounded-lg p-3 shadow-lg min-w-[180px] ${
          isDark ? 'bg-neutral-700 text-neutral-100' : 'bg-gray-900 text-white'
        }`}>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>← →</span>
              <span>Questions</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>A B C D</span>
              <span>Sélectionner</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>F</span>
              <span>Plein écran</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Progress dots component
interface QuizProgressDotsProps {
  total: number;
  current: number;
  answers: Map<string, QuestionAnswer>;
  questionIds: string[];
  onNavigate: (index: number) => void;
  isDark?: boolean;
  isGenerating?: boolean;
  translate: (key: string) => string;
}

function QuizProgressDots({ total, current, answers, questionIds, onNavigate, isDark, isGenerating, translate }: QuizProgressDotsProps) {
  // For >15 questions, show only the generating indicator (progress info is in header)
  if (total > 15) {
    if (!isGenerating) return null;
    return (
      <div className="flex items-center justify-center py-1">
        <motion.div
          className="w-2 h-2 rounded-full bg-orange-500"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center gap-0.5 py-1.5 overflow-x-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {Array.from({ length: total }).map((_, idx) => {
        const questionId = questionIds[idx];
        const answer = questionId ? answers.get(questionId) : undefined;
        const hasAnswer = !!answer;
        const isCurrent = idx === current;

        return (
          <button
            key={idx}
            onClick={() => onNavigate(idx)}
            className="p-1.5 -m-0.5 focus:outline-none group"
            aria-label={`Question ${idx + 1}${hasAnswer ? ' (répondue)' : ''}`}
          >
            <span
              className={`
                block w-2.5 h-2.5 rounded-full transition-all duration-150
                ${hasAnswer
                  ? answer.isCorrect
                    ? 'bg-green-500'
                    : 'bg-red-500'
                  : isDark ? 'border-[1.5px] border-neutral-600 bg-transparent' : 'border-[1.5px] border-gray-300 bg-transparent'
                }
                ${isCurrent ? `ring-[1.5px] ring-orange-500 ${isDark ? 'ring-offset-neutral-800' : 'ring-offset-white'} ring-offset-1` : ''}
                group-hover:scale-125
              `}
            />
          </button>
        );
      })}
      {isGenerating && (
        <motion.div
          className="w-2.5 h-2.5 rounded-full bg-orange-500 ml-1"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      )}
    </div>
  );
}

// Explanation card component (like in chapter quiz)
interface ExplanationCardProps {
  isCorrect: boolean;
  correctAnswer?: string;
  explanation?: string;
  sourceExcerpt?: string | null;
  pageNumber?: number | null;
  points: number;
  translate: (key: string) => string;
  isDark?: boolean;
}

function ExplanationCard({ isCorrect, correctAnswer, explanation, sourceExcerpt, pageNumber, points, translate, isDark }: ExplanationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = explanation && explanation.length > 150;

  return (
    <div className="space-y-2">
      <div className={`rounded-lg border px-2.5 py-1.5 ${
        isCorrect
          ? isDark ? 'bg-green-500/15 border-green-500/40' : 'bg-green-50 border-green-200'
          : isDark ? 'bg-[#d91a1c]/15 border-[#d91a1c]/40' : 'bg-[#d91a1c]/5 border-[#d91a1c]/20'
      }`}>
        {/* Badge result + correct answer inline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isCorrect ? (
              <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
            ) : (
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#d91a1c' }} />
            )}
            <span className={`font-semibold text-[11px] ${
              isCorrect
                ? isDark ? 'text-green-400' : 'text-green-800'
                : isDark ? 'text-[#f87171]' : 'text-[#991b1b]'
            }`}>
              {isCorrect ? translate('quiz_feedback_correct') || 'Correct !' : 'Incorrect'}
              {!isCorrect && correctAnswer && ` — ${correctAnswer}`}
            </span>
          </div>
          {isCorrect && points > 0 && (
            <span className={`text-[11px] font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>+{points} pts</span>
          )}
        </div>

        {/* Explanation - collapsed by default */}
        {explanation && (
          <div className={`text-[11px] leading-snug mt-1 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            <p className={!expanded && shouldTruncate ? 'line-clamp-1' : ''}>
              {explanation}
            </p>
            {shouldTruncate && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`font-medium text-[11px] hover:underline ${isDark ? 'text-orange-400' : 'text-orange-600'}`}
              >
                {expanded ? translate('show_less') || 'Voir moins' : translate('show_more') || 'Voir plus'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Source excerpt from course */}
      {sourceExcerpt && (
        <div className={`rounded-lg border px-2.5 py-1.5 ${
          isDark
            ? 'bg-amber-950/30 border-amber-800/50'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-1.5">
            <FileText className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isDark ? 'text-amber-500' : 'text-amber-600'}`} />
            <div>
              <p className={`text-[10px] font-medium ${isDark ? 'text-amber-500' : 'text-amber-700'}`}>
                {translate('quiz_source_excerpt')}{pageNumber ? ` — ${translate('quiz_page')} ${pageNumber}` : ''}
              </p>
              <p className={`text-[11px] italic leading-snug ${isDark ? 'text-amber-200/80' : 'text-amber-800'}`}>
                &ldquo;{sourceExcerpt}&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProgressiveQuizStreamView({
  questions,
  isGenerating,
  progress,
  questionsGenerated,
  progressMessage,
  onComplete,
  courseId,
  courseTitle,
  onCreateChallenge,
  onRegenerate,
}: ProgressiveQuizStreamViewProps) {
  const router = useRouter();
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, QuestionAnswer>>(new Map());
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [startTime] = useState<number>(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Guest signup modal state - shown at 30% progress
  const [showSignupModal, setShowSignupModal] = useState(false);
  const hasShownSignupModalRef = useRef(false);

  // Track navigation direction for animation
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // Store shuffled questions in a ref to maintain consistent order across renders
  // Using a ref instead of state allows synchronous access without causing re-renders
  const shuffledQuestionsRef = useRef<Map<string, ShuffledQuestion>>(new Map());

  // Touch handling for swipe
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper function to get or create a shuffled question (synchronous)
  const getOrCreateShuffledQuestion = useCallback((question: StreamingQuestion): ShuffledQuestion | undefined => {
    if (!question.options || question.options.length === 0) {
      return undefined;
    }

    // Check if already shuffled
    const existing = shuffledQuestionsRef.current.get(question.id);
    if (existing) return existing;

    // Create new shuffle and store it
    const { optionsList, newCorrectIndex } = normalizeAndShuffleOptions(
      question.options,
      question.correctOptionIndex
    );

    const shuffledQuestion: ShuffledQuestion = {
      id: question.id,
      questionText: question.questionText,
      optionsList,
      correctOptionIndex: newCorrectIndex,
      originalCorrectIndex: question.correctOptionIndex,
      explanation: question.explanation,
      points: question.points,
    };

    shuffledQuestionsRef.current.set(question.id, shuffledQuestion);
    return shuffledQuestion;
  }, []);

  // Get current question
  const currentQuestion = questions[currentIndex];

  // Get the shuffled version of the current question (synchronous - no loader needed)
  const currentShuffledQuestion = useMemo(() => {
    if (!currentQuestion) return undefined;
    return getOrCreateShuffledQuestion(currentQuestion);
  }, [currentQuestion, getOrCreateShuffledQuestion]);

  const hasNext = currentIndex < questions.length - 1 || isGenerating;
  const hasPrev = currentIndex > 0;

  // Calculate score
  const correctCount = Array.from(answers.values()).filter(a => a.isCorrect).length;
  const answeredCount = answers.size;
  const totalPossiblePoints = questions.length * 10;
  const currentScore = correctCount * 10;

  // Question IDs for progress dots
  const questionIds = useMemo(() => questions.map(q => q.id), [questions]);

  // Remaining count
  const remainingCount = questions.length - answeredCount;
  const allAnswered = remainingCount === 0 && questions.length > 0;

  // Check if quiz is complete (all questions answered AND generation finished)
  const canShowRecap = allAnswered && !isGenerating;

  // Build session stats for recap
  const sessionStats: QuizSessionStats | null = useMemo(() => {
    if (!canShowRecap) return null;

    const questionResults: QuestionResult[] = Array.from(answers.values()).map(a => ({
      id: a.questionId,
      questionText: a.questionText,
      userAnswer: a.userAnswer,
      correctAnswer: a.correctAnswer,
      isCorrect: a.isCorrect,
      explanation: a.explanation,
    }));

    const duration = Math.floor((Date.now() - startTime) / 1000);
    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;

    return {
      total: questions.length,
      correct: correctCount,
      incorrect: questions.length - correctCount,
      score,
      duration,
      questionResults,
    };
  }, [canShowRecap, answers, questions.length, correctCount, startTime]);

  // Show signup modal at 30% progress for guest users
  useEffect(() => {
    if (!user && isGenerating && progress >= 30 && !hasShownSignupModalRef.current) {
      hasShownSignupModalRef.current = true;
      // Small delay to let the quiz render smoothly
      const timer = setTimeout(() => {
        setShowSignupModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, isGenerating, progress]);

  // Reset selected option when question changes
  useEffect(() => {
    if (currentQuestion) {
      const existingAnswer = answers.get(currentQuestion.id);
      if (existingAnswer) {
        setSelectedLabel(existingAnswer.selectedLabel);
        setShowFeedback(true);
      } else {
        setSelectedLabel(null);
        setShowFeedback(false);
      }
    }
  }, [currentIndex, currentQuestion, answers]);

  // Navigate to next question
  const goNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setSlideDirection('right');
      setCurrentIndex(prev => prev + 1);
    } else if (canShowRecap) {
      // Last question answered, show recap
      setIsQuizComplete(true);
    }
  }, [currentIndex, questions.length, canShowRecap]);

  // Navigate to previous question
  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSlideDirection('left');
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Navigate to specific question
  const navigateToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length && index !== currentIndex) {
      setSlideDirection(index > currentIndex ? 'right' : 'left');
      setCurrentIndex(index);
    }
  }, [questions.length, currentIndex]);

  // Track correct streak for XP multiplier
  const correctStreakRef = useRef(0);

  // Submit answer by label (A, B, C, D)
  const submitAnswer = useCallback((label: string) => {
    if (!currentQuestion || !currentShuffledQuestion || answers.has(currentQuestion.id)) return;

    const selectedOption = currentShuffledQuestion.optionsList.find(opt => opt.label === label);
    if (!selectedOption) return;

    setSelectedLabel(label);
    const isCorrect = selectedOption.index === currentShuffledQuestion.correctOptionIndex;
    const userAnswer = selectedOption.value;
    const correctOption = currentShuffledQuestion.optionsList.find(
      opt => opt.index === currentShuffledQuestion.correctOptionIndex
    );
    const correctAnswer = correctOption?.value || '';

    const answer: QuestionAnswer = {
      questionId: currentQuestion.id,
      questionText: currentQuestion.questionText,
      selectedLabel: label,
      userAnswer,
      correctAnswer,
      isCorrect,
      explanation: currentQuestion.explanation,
    };

    setAnswers(prev => {
      const next = new Map(prev);
      next.set(currentQuestion.id, answer);
      return next;
    });

    // Record answer to API for XP and activity tracking (fire and forget)
    if (user) {
      const currentStreak = correctStreakRef.current;
      fetch('/api/stats/record-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapter_id: currentQuestion.chapterId,
          course_id: courseId,
          is_correct: isCorrect,
          current_correct_streak: currentStreak,
        }),
      }).catch(err => console.error('Failed to record answer:', err));

      // Update streak
      if (isCorrect) {
        correctStreakRef.current += 1;
      } else {
        correctStreakRef.current = 0;
      }
    }

    // Only show feedback card if incorrect - correct answers auto-advance
    if (isCorrect) {
      // Brief visual feedback then auto-advance
      setTimeout(() => {
        if (currentIndex < questions.length - 1) {
          goNext();
        } else if (!isGenerating) {
          // Last question and generation complete, can show recap
          setShowFeedback(true);
        }
      }, 800); // Quick transition for correct answers
    } else {
      // Incorrect: show explanation, user must click to continue
      setShowFeedback(true);
    }
  }, [currentQuestion, currentShuffledQuestion, answers, currentIndex, questions.length, goNext, isGenerating, user, courseId]);

  // Handle finish from recap
  const handleFinish = useCallback(() => {
    setIsQuizComplete(false);
    onComplete?.();
  }, [onComplete]);

  // Handle retry errors from recap
  const handleRetryErrors = useCallback(() => {
    // Reset only incorrect answers
    const incorrectIds = Array.from(answers.entries())
      .filter(([, a]) => !a.isCorrect)
      .map(([id]) => id);

    setAnswers(prev => {
      const next = new Map(prev);
      incorrectIds.forEach(id => next.delete(id));
      return next;
    });

    // Go to first incorrect question
    const firstIncorrectIndex = questions.findIndex(q => incorrectIds.includes(q.id));
    if (firstIncorrectIndex >= 0) {
      setCurrentIndex(firstIncorrectIndex);
    }

    setIsQuizComplete(false);
    setShowFeedback(false);
    setSelectedLabel(null);
  }, [answers, questions]);

  // Touch swipe handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null) return;

    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        // Swipe left -> next question
        goNext();
      } else {
        // Swipe right -> previous question
        goPrev();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  }, [goNext, goPrev]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing or quiz is complete
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || isQuizComplete) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'a':
        case 'A':
        case '1':
          if (!showFeedback && (currentShuffledQuestion?.optionsList?.length ?? 0) >= 1) submitAnswer('A');
          break;
        case 'b':
        case 'B':
        case '2':
          if (!showFeedback && (currentShuffledQuestion?.optionsList?.length ?? 0) >= 2) submitAnswer('B');
          break;
        case 'c':
        case 'C':
        case '3':
          if (!showFeedback && (currentShuffledQuestion?.optionsList?.length ?? 0) >= 3) submitAnswer('C');
          break;
        case 'd':
        case 'D':
        case '4':
          if (!showFeedback && (currentShuffledQuestion?.optionsList?.length ?? 0) >= 4) submitAnswer('D');
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
  }, [showFeedback, currentShuffledQuestion, goNext, goPrev, submitAnswer, isQuizComplete, isFullscreen]);

  // Show recap when quiz is complete
  if (isQuizComplete && sessionStats) {
    return (
      <QuizSessionRecap
        stats={sessionStats}
        onFinish={handleFinish}
        onRetryErrors={sessionStats.incorrect > 0 ? handleRetryErrors : undefined}
        courseTitle={courseTitle}
        courseId={courseId}
      />
    );
  }

  // Loading state - no questions yet (this case is handled by parent with GenerationLoadingScreen)
  if (questions.length === 0) {
    return null;
  }

  // Wait for shuffled question to be ready
  if (!currentShuffledQuestion) {
    return (
      <div className={`rounded-2xl border p-8 text-center ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        <Loader2 className={`w-8 h-8 mx-auto animate-spin ${isDark ? 'text-orange-400' : 'text-orange-500'}`} />
      </div>
    );
  }

  // Render quiz content (reused in normal and fullscreen mode)
  const renderQuizContent = (isFullscreenMode: boolean = false) => (
    <div
      ref={!isFullscreenMode ? containerRef : undefined}
      className={`${isFullscreenMode ? 'w-full max-w-3xl rounded-2xl' : ''} p-3 sm:p-4 transition-colors overflow-hidden ${
        isFullscreenMode
          ? isDark ? 'bg-neutral-900' : 'bg-white'
          : ''
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentQuestion?.id || 'empty'}
          initial={{ opacity: 0, x: slideDirection === 'right' ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: slideDirection === 'right' ? -20 : 20 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="space-y-2 sm:space-y-3"
        >
          {/* Question text */}
          <div className="flex items-start justify-between gap-2">
            <p className={`${isFullscreenMode ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'} font-semibold leading-snug ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              {currentShuffledQuestion.questionText}
            </p>
            {!isFullscreenMode && <KeyboardHelpTooltip isDark={isDark} />}
          </div>

          {/* Options - MCQ style like chapter quiz with shuffled order */}
          <div className="space-y-1.5 mt-3">
            {currentShuffledQuestion.optionsList.map((opt) => {
              const isSelected = selectedLabel === opt.label;
              const isCorrect = opt.index === currentShuffledQuestion.correctOptionIndex;
              const answered = answers.has(currentQuestion.id);
              const isSelectedAndWrong = answered && isSelected && !isCorrect;

              let buttonClasses = `w-full text-left ${isFullscreenMode ? 'px-4 py-3' : 'px-2.5 py-1.5'} rounded-md border transition-all `;
              let labelClasses = `font-semibold mr-1.5 ${isFullscreenMode ? 'text-base' : 'text-[13px]'} `;
              let textClasses = `${isFullscreenMode ? 'text-base' : 'text-[13px]'} `;

              if (answered) {
                if (isCorrect) {
                  buttonClasses += isDark
                    ? 'border-green-500 bg-green-500/90 '
                    : 'border-green-500 bg-green-500 ';
                  labelClasses += 'text-white ';
                  textClasses = `text-white font-medium ${isFullscreenMode ? 'text-base' : 'text-[13px]'}`;
                } else if (isSelectedAndWrong) {
                  buttonClasses += isDark
                    ? 'border-[#d91a1c] bg-[#d91a1c]/90 '
                    : 'border-[#d91a1c] bg-[#d91a1c] ';
                  labelClasses += 'text-white ';
                  textClasses = `text-white ${isFullscreenMode ? 'text-base' : 'text-[13px]'}`;
                } else {
                  buttonClasses += isDark
                    ? 'border-neutral-700 bg-neutral-700/50 opacity-60 '
                    : 'border-gray-200 bg-gray-50 opacity-60 ';
                  labelClasses += isDark ? 'text-neutral-500 ' : 'text-gray-400 ';
                  textClasses = isDark ? `text-neutral-400 ${isFullscreenMode ? 'text-base' : 'text-[13px]'}` : `text-gray-600 ${isFullscreenMode ? 'text-base' : 'text-[13px]'}`;
                }
                buttonClasses += 'cursor-not-allowed';
              } else {
                if (isSelected) {
                  buttonClasses += isDark
                    ? 'border-orange-500 bg-orange-500/20 '
                    : 'border-orange-500 bg-orange-50 ';
                  labelClasses += isDark ? 'text-orange-400 ' : 'text-orange-600 ';
                  textClasses = isDark ? `text-neutral-100 ${isFullscreenMode ? 'text-base' : 'text-[13px]'}` : `text-gray-900 ${isFullscreenMode ? 'text-base' : 'text-[13px]'}`;
                } else {
                  buttonClasses += isDark
                    ? 'border-neutral-600 hover:border-orange-500/50 '
                    : 'border-gray-200 hover:border-orange-300 ';
                  labelClasses += isDark ? 'text-orange-400 ' : 'text-orange-600 ';
                  textClasses = isDark ? `text-neutral-200 ${isFullscreenMode ? 'text-base' : 'text-[13px]'}` : `text-gray-900 ${isFullscreenMode ? 'text-base' : 'text-[13px]'}`;
                }
              }

              return (
                <button
                  key={opt.label}
                  onClick={() => {
                    if (!answered) {
                      submitAnswer(opt.label);
                    }
                  }}
                  className={buttonClasses}
                  disabled={answered}
                >
                  <span className={labelClasses}>{opt.label}.</span>
                  <span className={textClasses}>{opt.value}</span>
                </button>
              );
            })}
          </div>

          {/* Feedback - ExplanationCard */}
          {showFeedback && currentQuestion && answers.has(currentQuestion.id) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3"
            >
              <ExplanationCard
                isCorrect={answers.get(currentQuestion.id)?.isCorrect || false}
                correctAnswer={!answers.get(currentQuestion.id)?.isCorrect
                  ? (() => {
                      const correctOpt = currentShuffledQuestion.optionsList.find(
                        opt => opt.index === currentShuffledQuestion.correctOptionIndex
                      );
                      return correctOpt ? `${correctOpt.label}: ${correctOpt.value}` : '';
                    })()
                  : undefined}
                explanation={currentShuffledQuestion.explanation}
                sourceExcerpt={currentQuestion.sourceExcerpt}
                pageNumber={currentQuestion.pageNumber}
                points={answers.get(currentQuestion.id)?.isCorrect ? 10 : 0}
                translate={translate}
                isDark={isDark}
              />
            </motion.div>
          )}

          {/* Navigation and finish buttons */}
          <div className="flex items-center gap-1 mt-3">
            <button
              onClick={goPrev}
              disabled={!hasPrev}
              className={`px-2.5 py-1.5 rounded-md border text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                isDark
                  ? 'border-neutral-600 text-neutral-300 hover:bg-neutral-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              aria-label="Question précédente"
            >
              ←
            </button>

            {showFeedback && currentIndex < questions.length - 1 && (
              <button
                onClick={goNext}
                className={`flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[13px] font-semibold transition-colors ${
                  isDark
                    ? 'bg-neutral-700 text-neutral-100 hover:bg-neutral-600'
                    : 'bg-gray-900 text-white hover:bg-black'
                }`}
              >
                {translate('quiz_next_question') || 'Question suivante'}
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            {(currentIndex === questions.length - 1 || !showFeedback) && (
              canShowRecap ? (
                <button
                  onClick={() => setIsQuizComplete(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md bg-orange-500 text-white text-[13px] font-semibold hover:bg-orange-600"
                >
                  {translate('quiz_finish') || 'Terminer'}
                </button>
              ) : (
                <span className={`flex-1 text-center text-[11px] ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                  {isGenerating
                    ? `${questionsGenerated} questions générées...`
                    : remainingCount > 0
                      ? `${remainingCount} question${remainingCount > 1 ? 's' : ''} restante${remainingCount > 1 ? 's' : ''}`
                      : ''
                  }
                </span>
              )
            )}

            <button
              onClick={goNext}
              disabled={currentIndex === questions.length - 1 && !isGenerating}
              className={`px-2.5 py-1.5 rounded-md border text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                isDark
                  ? 'border-neutral-600 text-neutral-300 hover:bg-neutral-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              aria-label="Question suivante"
            >
              →
            </button>
          </div>

          {/* Progress dots */}
          <QuizProgressDots
            total={questions.length}
            current={currentIndex}
            answers={answers}
            questionIds={questionIds}
            onNavigate={navigateToQuestion}
            isDark={isDark}
            isGenerating={isGenerating}
            translate={translate}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );

  // Fullscreen mode with portal
  if (isFullscreen && typeof document !== 'undefined') {
    const fullscreenContent = (
      <div className={`fixed inset-0 flex flex-col ${isDark ? 'bg-neutral-950' : 'bg-white'}`} style={{ zIndex: 9999 }}>
        {/* Header plein écran */}
        <div className={`flex items-center justify-between px-4 sm:px-8 py-4 border-b ${
          isDark ? 'border-neutral-800 bg-neutral-950' : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center gap-4">
            <span className={`text-sm font-medium ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              Question {currentIndex + 1}/{questions.length}
            </span>
            {isGenerating && (
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            )}
            <span className={`font-semibold text-sm ${
              isDark ? 'text-orange-400' : 'text-orange-600'
            }`}>
              {currentScore}/{totalPossiblePoints} pts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <KeyboardHelpTooltip isDark={isDark} />
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
        </div>

        {/* Zone centrale : question */}
        <div className={`flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-auto ${isDark ? 'bg-neutral-950' : 'bg-gray-50'}`}>
          {renderQuizContent(true)}
        </div>

        {/* Footer - barre de progression */}
        <div className={`px-4 sm:px-8 py-3 border-t ${isDark ? 'border-neutral-800 bg-neutral-950' : 'border-gray-200 bg-white'}`}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3">
              <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                {currentIndex + 1} / {questions.length}
              </span>
              <div className={`flex-1 max-w-sm h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
                <div
                  className="h-full bg-orange-500 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
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
    <div className="space-y-2">
      {/* Action buttons */}
      <div className="flex items-center justify-end gap-1">
        {/* Challenge button */}
        {user && onCreateChallenge && (
          <button
            onClick={onCreateChallenge}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-xs font-medium transition-colors"
            style={{ backgroundColor: '#ff751f' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>{translate('challenge_title') || 'Défi'}</span>
          </button>
        )}
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'text-orange-400 hover:text-orange-300 hover:bg-orange-500/20' : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
            }`}
            title={translate('quiz_regenerate') || 'Régénérer le quiz'}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={() => setIsFullscreen(true)}
          className={`p-2 rounded-lg transition-colors ${
            isDark ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
          title={translate('quiz_fullscreen') || 'Plein écran (F)'}
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Question card with integrated progress header */}
      <div className={`rounded-2xl border ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        {/* Progress header */}
        <div className={`px-4 py-3 border-b flex items-center justify-between ${
          isDark ? 'border-neutral-800' : 'border-gray-100'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              Question {currentIndex + 1}/{questions.length}
            </span>
            {isGenerating && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
            )}
          </div>
          <span className={`text-sm font-semibold ${
            isDark ? 'text-orange-400' : 'text-orange-600'
          }`}>
            {currentScore}/{totalPossiblePoints} pts
          </span>
        </div>

        {/* Question content */}
        {renderQuizContent(false)}
      </div>

      {/* Signup Modal for guests at 30% progress */}
      {showSignupModal && !user && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className={`rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 animate-in zoom-in duration-300 relative ${
            isDark ? 'bg-neutral-800' : 'bg-white'
          }`}>
            <button
              onClick={() => setShowSignupModal(false)}
              className={`absolute top-4 right-4 p-2 transition-colors ${
                isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <Gift className="w-10 h-10 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('quiz_signup_modal_title') || 'Crée ton compte gratuit'}
              </h2>
              <p className={isDark ? 'text-neutral-300' : 'text-gray-600'}>
                {translate('quiz_signup_modal_subtitle') || 'Sauvegarde ta progression et accède à toutes les fonctionnalités'}
              </p>
            </div>

            <div className={`rounded-2xl p-4 border ${
              isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-100'
            }`}>
              <p className={`text-sm ${isDark ? 'text-orange-300' : 'text-orange-800'}`}>
                {translate('quiz_signup_modal_benefit') || 'En créant un compte, tu pourras suivre tes progrès, gagner des badges et défier tes amis !'}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/auth/signup')}
                className="w-full px-6 py-4 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <Gift className="w-5 h-5" />
                {translate('quiz_signup_modal_cta') || 'Créer mon compte'}
              </button>
              <button
                onClick={() => setShowSignupModal(false)}
                className={`w-full px-6 py-3 font-medium transition-colors ${
                  isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {translate('later') || 'Plus tard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
