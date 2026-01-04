'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { trackEvent } from '@/lib/posthog';
import { loadDemoCourse } from '@/lib/demoCourse';
import { getLocalizedChapterTitleAsync } from '@/lib/content-translator';

// Types for quiz answers storage
interface QuizAnswers {
  [questionId: string]: {
    selectedAnswer: string;
    isCorrect?: boolean;
    feedback?: { isCorrect: boolean; message: string; points: number; explanation?: string; sourceExcerpt?: string };
    correctOptionId?: string;
  };
}

// Progress dots component
interface QuizProgressDotsProps {
  total: number;
  current: number;
  answers: QuizAnswers;
  questionIds: string[];
  onNavigate: (index: number) => void;
  isDark?: boolean;
}

function QuizProgressDots({ total, current, answers, questionIds, onNavigate, isDark }: QuizProgressDotsProps) {
  const dotsContainerRef = useRef<HTMLDivElement>(null);

  // Show compact text for >15 questions
  if (total > 15) {
    const answeredCount = questionIds.filter(id => answers[id]?.selectedAnswer).length;
    return (
      <div className="flex items-center justify-center gap-2 py-2">
        <span className={`text-sm ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>{current + 1}/{total}</span>
        <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>({answeredCount} répondues)</span>
      </div>
    );
  }

  return (
    <div
      ref={dotsContainerRef}
      className="flex items-center justify-center gap-1 py-3 overflow-x-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {Array.from({ length: total }).map((_, idx) => {
        const questionId = questionIds[idx];
        const hasAnswer = questionId && answers[questionId]?.selectedAnswer;
        const isCurrent = idx === current;

        return (
          <button
            key={idx}
            onClick={() => onNavigate(idx)}
            className="p-2 -m-1 focus:outline-none group"
            aria-label={`Question ${idx + 1}${hasAnswer ? ' (répondue)' : ''}`}
          >
            <span
              className={`
                block w-3 h-3 rounded-full transition-all duration-150
                ${hasAnswer
                  ? isDark ? 'bg-neutral-400' : 'bg-gray-700'
                  : isDark ? 'border-2 border-neutral-600 bg-transparent' : 'border-2 border-gray-300 bg-transparent'
                }
                ${isCurrent ? `ring-2 ring-orange-500 ${isDark ? 'ring-offset-neutral-800' : 'ring-offset-white'} ring-offset-2` : ''}
                group-hover:scale-125
              `}
            />
          </button>
        );
      })}
    </div>
  );
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
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>↑ ↓</span>
              <span>Options</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>A B C D</span>
              <span>Sélectionner</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className={isDark ? 'text-neutral-400' : 'text-gray-400'}>Entrée / Espace</span>
              <span>Valider</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Exit confirmation modal
interface ExitModalProps {
  remainingCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isDark?: boolean;
}

function ExitConfirmModal({ remainingCount, onConfirm, onCancel, isDark }: ExitModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className={`rounded-2xl p-6 max-w-sm w-full shadow-xl ${
        isDark ? 'bg-neutral-800 border border-neutral-700' : 'bg-white'
      }`}>
        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>Quitter le quiz ?</h3>
        <p className={`mb-4 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
          Tu as {remainingCount} question{remainingCount > 1 ? 's' : ''} non répondue{remainingCount > 1 ? 's' : ''}.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={`flex-1 px-4 py-2 rounded-xl border font-medium transition-colors ${
              isDark
                ? 'border-neutral-600 text-neutral-300 hover:bg-neutral-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Continuer
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
          >
            Quitter
          </button>
        </div>
      </div>
    </div>
  );
}

type QuestionType = 'mcq' | 'open' | 'short';

interface Question {
  id: string;
  question_text: string;
  question_number: number;
  type: QuestionType;
  options?: Record<string, string> | string[];
  optionsList?: { label: string; value: string; index: number; originalIndex: number }[];
  correct_option_index?: number | null;
  points: number;
  answer_text?: string | null;
  explanation?: string;
  page_source?: string | null;
}

interface ReviewItem {
  index: number;
  question: string;
  student_answer: string;
  is_correct: boolean;
  correct_answer: string;
  explanation?: string;
  page_source?: string | null;
}

interface ExplanationCardProps {
  isCorrect: boolean;
  correctAnswer?: string;
  explanation?: string;
  sourceExcerpt?: string;
  points: number;
  translate: (key: string) => string;
  // Mapping from original index (0,1,2,3) to new shuffled label (A,B,C,D)
  letterMapping?: Record<number, string>;
  isDark?: boolean;
}

function ExplanationCard({ isCorrect, correctAnswer, explanation, sourceExcerpt, points, translate, letterMapping, isDark }: ExplanationCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Remap letter references in explanation to match shuffled order
  const remapExplanation = (text: string): string => {
    if (!letterMapping) return text;

    const originalLetters = ['A', 'B', 'C', 'D'];
    // Create mapping: original letter -> new letter
    const letterToLetter: Record<string, string> = {};
    originalLetters.forEach((letter, idx) => {
      if (letterMapping[idx]) {
        letterToLetter[letter] = letterMapping[idx];
      }
    });

    // Replace letter references with placeholders first to avoid double replacement
    let result = text;
    const placeholders: Record<string, string> = {};
    originalLetters.forEach((letter, idx) => {
      const placeholder = `__LETTER_${idx}__`;
      placeholders[placeholder] = letterToLetter[letter] || letter;
      // Match patterns like "option A", "l'option A", "Option A", "A)", "(A)"
      result = result.replace(new RegExp(`([Oo]ption |[Ll]'option |\\()?${letter}(\\)|,|\\s|\\.|$)`, 'g'), `$1${placeholder}$2`);
    });

    // Replace placeholders with actual new letters
    Object.entries(placeholders).forEach(([placeholder, newLetter]) => {
      result = result.replace(new RegExp(placeholder, 'g'), newLetter);
    });

    return result;
  };

  const remappedExplanation = explanation ? remapExplanation(explanation) : undefined;
  const shouldTruncate = remappedExplanation && remappedExplanation.length > 150;

  return (
    <div className={`rounded-xl border-2 p-4 ${
      isCorrect
        ? isDark ? 'bg-green-500/15 border-green-500/40' : 'bg-green-50 border-green-200'
        : isDark ? 'bg-[#d91a1c]/15 border-[#d91a1c]/40' : 'bg-[#d91a1c]/5 border-[#d91a1c]/20'
    }`}>
      {/* Badge result */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isCorrect ? (
            <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#d91a1c' }} />
          )}
          <span className={`font-semibold text-sm ${
            isCorrect
              ? isDark ? 'text-green-400' : 'text-green-800'
              : isDark ? 'text-[#f87171]' : 'text-[#991b1b]'
          }`}>
            {isCorrect ? translate('quiz_feedback_correct') : 'Incorrect'}
          </span>
        </div>
        {points > 0 && (
          <span className={`text-xs font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>+{points} {translate('learn_pts')}</span>
        )}
      </div>

      {/* Correct answer if incorrect */}
      {!isCorrect && correctAnswer && (
        <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-neutral-100' : 'text-gray-900'}`}>
          La bonne réponse était : {correctAnswer}
        </p>
      )}

      {/* Explanation */}
      {remappedExplanation && (
        <div className={`text-sm leading-relaxed ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
          <p className={shouldTruncate && !expanded ? 'line-clamp-3' : ''}>
            {remappedExplanation}
          </p>
          {shouldTruncate && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`font-medium mt-1 text-xs hover:underline ${isDark ? 'text-orange-400' : 'text-orange-600'}`}
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>
      )}

      {/* Source excerpt */}
      {sourceExcerpt && (
        <div className={`mt-3 p-3 rounded-lg border-l-4 ${
          isDark ? 'bg-neutral-800 border-neutral-600' : 'bg-gray-100 border-gray-300'
        }`}>
          <p className={`text-xs mb-1 font-medium ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Extrait du cours :</p>
          <p className={`text-sm italic leading-relaxed ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>&ldquo;{sourceExcerpt}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

export default function ChapterQuizPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { translate, currentLanguage } = useLanguage();
  const { isDark } = useTheme();

  const courseId = params?.courseId as string;
  const chapterId = params?.chapterId as string;
  const isDemoId = courseId?.startsWith('demo-');

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string; points: number; explanation?: string; sourceExcerpt?: string } | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [chapterTitle, setChapterTitle] = useState('');
  const [originalChapterTitle, setOriginalChapterTitle] = useState('');
  const [courseTitle, setCourseTitle] = useState('');

  // Enhanced state for MCQ visual feedback
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);

  // New state for free navigation
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>({});
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Touch handling for swipe
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentQuestion = questions[currentIndex];
  const questionIds = useMemo(() => questions.map(q => q.id), [questions]);

  // Calculate answered and remaining counts
  const answeredCount = useMemo(() => {
    return questionIds.filter(id => quizAnswers[id]?.selectedAnswer).length;
  }, [questionIds, quizAnswers]);
  const remainingCount = questions.length - answeredCount;
  const allAnswered = remainingCount === 0;

  // Progress label
  const progressLabel = translate('quiz_progress')
    .replace('{current}', String(currentIndex + 1))
    .replace('{total}', String(questions.length));

  // Calculate total possible points - fixed at 10 points per question
  const totalPossiblePoints = useMemo(() => {
    return questions.length * 10;
  }, [questions]);

  useEffect(() => {
    loadQuestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, user]);

  // Load saved answers from localStorage
  useEffect(() => {
    if (chapterId) {
      try {
        const saved = localStorage.getItem(`quiz_answers_${chapterId}`);
        if (saved) {
          const parsed = JSON.parse(saved) as QuizAnswers;
          setQuizAnswers(parsed);
          // Restore score and correctCount from saved answers
          let restoredScore = 0;
          let restoredCorrectCount = 0;
          Object.values(parsed).forEach(ans => {
            if (ans.feedback) {
              restoredScore += ans.feedback.points || 0;
              if (ans.feedback.isCorrect) restoredCorrectCount++;
            }
          });
          setScore(restoredScore);
          setCorrectCount(restoredCorrectCount);
        }
      } catch (e) {
        console.error('Failed to load saved answers:', e);
      }
    }
  }, [chapterId]);

  // Save answers to localStorage whenever they change
  useEffect(() => {
    if (chapterId && Object.keys(quizAnswers).length > 0) {
      try {
        localStorage.setItem(`quiz_answers_${chapterId}`, JSON.stringify(quizAnswers));
      } catch (e) {
        console.error('Failed to save answers:', e);
      }
    }
  }, [chapterId, quizAnswers]);

  // Restore state when navigating to a question with saved answer
  useEffect(() => {
    if (currentQuestion && quizAnswers[currentQuestion.id]) {
      const savedAnswer = quizAnswers[currentQuestion.id];
      setAnswer(savedAnswer.selectedAnswer);
      setSelectedOptionId(savedAnswer.selectedAnswer);
      setCorrectOptionId(savedAnswer.correctOptionId || null);
      setFeedback(savedAnswer.feedback || null);
      setHasAnswered(!!savedAnswer.feedback);
    } else {
      // Reset state for unanswered question
      setAnswer('');
      setSelectedOptionId(null);
      setCorrectOptionId(null);
      setFeedback(null);
      setHasAnswered(false);
    }
  }, [currentIndex, currentQuestion, quizAnswers]);

  // Translate chapter title when language changes
  useEffect(() => {
    const translateChapterTitle = async () => {
      if (originalChapterTitle) {
        const translatedTitle = await getLocalizedChapterTitleAsync(
          { title: originalChapterTitle },
          currentLanguage || 'fr'
        );
        setChapterTitle(translatedTitle);
      }
    };

    translateChapterTitle();
  }, [originalChapterTitle, currentLanguage]);

  // Navigation functions
  const navigateToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length && index !== currentIndex) {
      setCurrentIndex(index);
    }
  }, [questions.length, currentIndex]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      navigateToQuestion(currentIndex - 1);
    }
  }, [currentIndex, navigateToQuestion]);

  const goToNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      navigateToQuestion(currentIndex + 1);
    }
  }, [currentIndex, questions.length, navigateToQuestion]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowUp':
          if (currentQuestion?.type === 'mcq' && currentQuestion.optionsList && !hasAnswered) {
            e.preventDefault();
            const options = currentQuestion.optionsList;
            if (!answer) {
              // Si rien sélectionné, sélectionner la dernière option
              setAnswer(options[options.length - 1].label);
            } else {
              const currentIdx = options.findIndex(o => o.label === answer);
              if (currentIdx > 0) {
                setAnswer(options[currentIdx - 1].label);
              }
            }
          }
          break;
        case 'ArrowDown':
          if (currentQuestion?.type === 'mcq' && currentQuestion.optionsList && !hasAnswered) {
            e.preventDefault();
            const options = currentQuestion.optionsList;
            if (!answer) {
              // Si rien sélectionné, sélectionner la première option
              setAnswer(options[0].label);
            } else {
              const currentIdx = options.findIndex(o => o.label === answer);
              if (currentIdx < options.length - 1) {
                setAnswer(options[currentIdx + 1].label);
              }
            }
          }
          break;
        case 'a':
        case 'A':
        case 'b':
        case 'B':
        case 'c':
        case 'C':
        case 'd':
        case 'D':
          if (currentQuestion?.type === 'mcq' && currentQuestion.optionsList && !hasAnswered) {
            const label = e.key.toUpperCase();
            const opt = currentQuestion.optionsList.find(o => o.label === label);
            if (opt) {
              setAnswer(opt.label);
            }
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (answer && !hasAnswered) {
            handleValidate(answer);
          } else if (hasAnswered) {
            goToNext();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentQuestion, hasAnswered, answer, goToPrevious, goToNext]);

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
        goToNext();
      } else {
        // Swipe right -> previous question
        goToPrevious();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  }, [goToNext, goToPrevious]);

  // Fisher-Yates shuffle algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const normalizeOptions = (options?: Record<string, string> | string[] | null, correctIndex?: number) => {
    if (!options) return { optionsList: undefined, newCorrectIndex: undefined };
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

    // Create array with original indices - preserve the actual index from the source
    let optionsWithOriginalIndex: { value: string; originalIndex: number }[];

    if (Array.isArray(options)) {
      // Array: index is the position in the array
      optionsWithOriginalIndex = options.map((value, idx) => ({
        value,
        originalIndex: idx,
      }));
    } else {
      // Object: use the numeric key as the original index, sorted by key
      const sortedKeys = Object.keys(options).sort((a, b) => Number(a) - Number(b));
      optionsWithOriginalIndex = sortedKeys.map((key) => ({
        value: options[key],
        originalIndex: Number(key),
      }));
    }

    // Shuffle the options
    const shuffled = shuffleArray(optionsWithOriginalIndex);

    // Find the new index of the correct answer
    const newCorrectIndex = correctIndex !== undefined
      ? shuffled.findIndex(opt => opt.originalIndex === correctIndex)
      : undefined;

    // Assign labels A, B, C, D to shuffled options
    const optionsList = shuffled.map((opt, idx) => ({
      label: letters[idx] || String.fromCharCode(65 + idx),
      value: opt.value,
      index: idx, // New index after shuffle
      originalIndex: opt.originalIndex, // Keep track of original for answer validation
    }));

    return { optionsList, newCorrectIndex };
  };

  const loadQuestions = async () => {
    try {
      setLoading(true);
      // Demo path: load from demo store instead of API
      if (isDemoId) {
        const demo = loadDemoCourse(courseId);
        const demoChapter = demo?.chapters.find((c) => c.id === chapterId);
        if (demo && demoChapter) {
          setCourseTitle(demo.title);
          // Store original chapter title for translation
          setOriginalChapterTitle(demoChapter.title);
          setQuestions(
            demoChapter.questions.map((q, idx) => {
              const originalCorrectIndex = Array.isArray(q.options)
                ? q.options.findIndex((opt) => opt === q.answer)
                : Object.values(q.options || {}).findIndex((opt) => opt === q.answer);
              const { optionsList, newCorrectIndex } = normalizeOptions(q.options, originalCorrectIndex);
              return {
                id: q.id,
                question_text: q.prompt,
                question_number: idx + 1,
                type: q.type === 'mcq' ? 'mcq' : 'short',
                options: q.options,
                optionsList,
                correct_option_index: newCorrectIndex ?? originalCorrectIndex,
                points: 10,
                answer_text: q.answer,
                explanation: q.explanation,
                page_source: (q as any)?.page_source || null,
              };
            })
          );
          return;
        } else {
          throw new Error('Demo chapter not found');
        }
      }

      const response = await fetch(`/api/chapters/${chapterId}/questions`);
      if (!response.ok) {
        throw new Error('Failed to load questions');
      }

      const data = await response.json();
      const normalized = data.questions.map((q: Question) => {
        const originalCorrectIndex = q.correct_option_index ?? 0;
        const { optionsList, newCorrectIndex } = normalizeOptions(q.options, originalCorrectIndex);
        return {
          ...q,
          optionsList,
          correct_option_index: newCorrectIndex ?? originalCorrectIndex,
          page_source: (q as any)?.page_source || null,
        };
      });
      setQuestions(normalized);
      // Store original chapter title for translation
      setOriginalChapterTitle(data.chapter.title);
      setCourseTitle(data.course?.title || '');
    } catch (error) {
      console.error('Error loading questions', error);
    } finally {
      setLoading(false);
    }
  };

  const evaluateDemoAnswer = (question: Question, value: string) => {
    if (question.type === 'mcq') {
      const selectedIndex = question.optionsList?.find((o) => o.label === value)?.index ?? -1;
      const expectedIndex =
        question.correct_option_index ??
        question.optionsList?.find((opt) => opt.value === question.answer_text)?.index ??
        0;
      const isCorrect = selectedIndex === expectedIndex;
      const correctLabel = question.optionsList?.find((o) => o.index === expectedIndex)?.label ?? '';
      return {
        isCorrect,
        message: isCorrect
          ? translate('quiz_feedback_correct')
          : `${translate('quiz_feedback_incorrect')} (${translate('quiz_feedback_prefix_correct')} ${correctLabel})`,
        points: isCorrect ? question.points : 0,
        explanation: question.explanation,
      };
    }
    const isCorrect = value.trim().length > 0;
    return {
      isCorrect,
      message: isCorrect ? translate('quiz_feedback_correct') : translate('quiz_feedback_incorrect'),
      points: isCorrect ? question.points : 5,
      explanation: question.explanation,
    };
  };

  const handleValidate = async (selectedAnswer?: string) => {
    const answerToValidate = selectedAnswer || answer;
    if (!answerToValidate.trim() || !currentQuestion) return;

    try {
      if (isDemoId) {
        // For DEMO mode: set everything BEFORE marking as answered
        if (currentQuestion.type === 'mcq' && currentQuestion.optionsList) {
          setSelectedOptionId(answerToValidate);

          // Set correct option ID BEFORE marking as answered to avoid flash
          const correctOpt = currentQuestion.optionsList.find(
            (opt) => opt.index === (currentQuestion.correct_option_index ?? 0)
          );
          if (correctOpt) {
            setCorrectOptionId(correctOpt.label);
          }
        }

        // Mark as answered AFTER setting correctOptionId
        setHasAnswered(true);

        const result = evaluateDemoAnswer(currentQuestion, answerToValidate);
        setFeedback(result);

        // Save to quizAnswers for navigation persistence
        const correctOpt = currentQuestion.optionsList?.find(
          (opt) => opt.index === (currentQuestion.correct_option_index ?? 0)
        );
        setQuizAnswers(prev => ({
          ...prev,
          [currentQuestion.id]: {
            selectedAnswer: answerToValidate,
            isCorrect: result.isCorrect,
            feedback: result,
            correctOptionId: correctOpt?.label
          }
        }));

        // Only update score if this question wasn't already answered
        if (!quizAnswers[currentQuestion.id]?.feedback) {
          setScore((prev) => prev + (result.points || 0));
          setCorrectCount((prev) => prev + (result.isCorrect ? 1 : 0));
        }
        setReviewItems((prev) => {
          // Avoid duplicates when re-answering
          const filtered = prev.filter(r => r.index !== currentIndex + 1);
          return [
            ...filtered,
            {
              index: currentIndex + 1,
              question: currentQuestion.question_text,
              student_answer: answerToValidate,
              is_correct: result.isCorrect,
              correct_answer: currentQuestion.answer_text || '',
              explanation: currentQuestion.explanation || result.message,
              page_source: currentQuestion.page_source || null,
            },
          ];
        });
        return;
      }

      // Send the ORIGINAL index to the API (before shuffle) for validation
      const selectedOption = currentQuestion.type === 'mcq'
        ? currentQuestion.optionsList?.find((o) => o.label === answerToValidate)
        : undefined;
      const selectedOriginalIndex = selectedOption?.originalIndex;

      console.log('[quiz-frontend] Sending answer:', {
        answerToValidate,
        selectedOption,
        selectedOriginalIndex,
        questionCorrectIndex: currentQuestion.correct_option_index,
        allOptions: currentQuestion.optionsList?.map(o => ({
          label: o.label,
          originalIndex: o.originalIndex,
          value: o.value?.substring(0, 30)
        }))
      });

      const response = await fetch(`/api/questions/${currentQuestion.id}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: currentQuestion.type === 'mcq' ? selectedOriginalIndex : answerToValidate,
        }),
      });
      const data = await response.json();

      // For API mode: set everything BEFORE marking as answered
      if (currentQuestion.type === 'mcq' && currentQuestion.optionsList) {
        setSelectedOptionId(answerToValidate);

        // API returns the ORIGINAL correct index, find the label by originalIndex
        const correctOriginalIndex = data.correctOptionIndex;
        const correctLabel = correctOriginalIndex !== undefined
          ? currentQuestion.optionsList.find((o) => o.originalIndex === correctOriginalIndex)?.label
          : currentQuestion.optionsList.find((o) => o.index === currentQuestion.correct_option_index)?.label;
        if (correctLabel) {
          setCorrectOptionId(correctLabel);
        }
      }

      // Mark as answered AFTER setting correctOptionId
      setHasAnswered(true);

      console.log('[quiz-frontend] API response:', {
        isCorrect: data.isCorrect,
        correctOptionIndex: data.correctOptionIndex,
        feedback: data.feedback,
      });

      const feedbackData = {
        isCorrect: data.isCorrect,
        message: data.feedback,
        points: data.pointsEarned || 0,
        explanation: data.explanation,
        sourceExcerpt: data.sourceExcerpt,
      };
      setFeedback(feedbackData);

      // Save to quizAnswers for navigation persistence
      const correctOriginalIndex = data.correctOptionIndex;
      const correctLabel = correctOriginalIndex !== undefined
        ? currentQuestion.optionsList?.find((o) => o.originalIndex === correctOriginalIndex)?.label
        : currentQuestion.optionsList?.find((o) => o.index === currentQuestion.correct_option_index)?.label;

      setQuizAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          selectedAnswer: answerToValidate,
          isCorrect: data.isCorrect,
          feedback: feedbackData,
          correctOptionId: correctLabel
        }
      }));

      // Only update score if this question wasn't already answered
      if (!quizAnswers[currentQuestion.id]?.feedback) {
        setScore((prev) => prev + (data.pointsEarned || 0));
        setCorrectCount((prev) => prev + (data.isCorrect ? 1 : 0));
      }
      setReviewItems((prev) => {
        // Avoid duplicates when re-answering
        const filtered = prev.filter(r => r.index !== currentIndex + 1);
        return [
          ...filtered,
          {
            index: currentIndex + 1,
            question: currentQuestion.question_text,
            student_answer:
              currentQuestion.type === 'mcq'
                ? `${answerToValidate} — ${currentQuestion.optionsList?.find((o) => o.label === answerToValidate)?.value ?? ''}`
                : answerToValidate,
            is_correct: data.isCorrect,
            correct_answer:
              data.correctAnswer ||
              currentQuestion.answer_text ||
              currentQuestion.optionsList?.find((o) => o.originalIndex === data.correctOptionIndex)?.value ||
              '',
            explanation: data.explanation || data.feedback,
            page_source: currentQuestion.page_source || null,
          },
        ];
      });
    } catch (error) {
      console.error('Error validating answer:', error);
      setFeedback({
        isCorrect: false,
        message: translate('quiz_feedback_error'),
        points: 0,
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      goToNext();
    } else if (allAnswered) {
      finishQuiz();
    }
  };

  const finishQuiz = useCallback(() => {
    // Store review items for results page
    try {
      sessionStorage.setItem(
        `quiz_review_${chapterId}`,
        JSON.stringify(reviewItems)
      );
      // Clear saved answers from localStorage
      localStorage.removeItem(`quiz_answers_${chapterId}`);
    } catch (e) {
      console.error('Failed to store review items:', e);
    }
    router.push(`/courses/${courseId}/chapters/${chapterId}/results?score=${score}&total=${totalPossiblePoints}&correct=${correctCount}&totalQuestions=${questions.length}`);
    trackEvent('quiz_completed', { userId: user?.id, chapterId, score, totalPossiblePoints });
  }, [chapterId, reviewItems, router, courseId, score, totalPossiblePoints, correctCount, questions.length, user?.id]);

  const handleFinishClick = () => {
    if (allAnswered) {
      finishQuiz();
    } else {
      setShowExitModal(true);
    }
  };

  const handleExitConfirm = () => {
    setShowExitModal(false);
    finishQuiz();
  };

  const handleExitCancel = () => {
    setShowExitModal(false);
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors ${
        isDark ? 'bg-neutral-900' : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
      }`}>
        <div className="text-center">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={400}
            height={400}
            className="mx-auto mb-4 animate-bounce"
          />
          <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{translate('learn_loading')}</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors ${
        isDark ? 'bg-neutral-900' : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
      }`}>
        <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{translate('learn_error_question')}</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-3 sm:p-6 transition-colors ${
      isDark ? 'bg-neutral-900' : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
    }`}>
      {showExitModal && (
        <ExitConfirmModal
          remainingCount={remainingCount}
          onConfirm={handleExitConfirm}
          onCancel={handleExitCancel}
          isDark={isDark}
        />
      )}
      <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
        <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-colors ${
          isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            <Image
              src="/chat/mascotte.png"
              alt="Nareo"
              width={80}
              height={80}
              className="rounded-2xl flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className={`text-xs uppercase tracking-wide font-semibold ${
                isDark ? 'text-orange-400' : 'text-orange-600'
              }`}>{courseTitle}</p>
              <h1 className={`text-xl sm:text-2xl font-bold truncate ${
                isDark ? 'text-neutral-50' : 'text-gray-900'
              }`}>{chapterTitle}</h1>
            </div>
            <KeyboardHelpTooltip isDark={isDark} />
          </div>
          <div className={`flex items-center justify-between mt-2 text-sm ${
            isDark ? 'text-neutral-400' : 'text-gray-600'
          }`}>
            <span className={isDark ? 'text-neutral-500' : 'text-gray-500'}>
              Question {currentIndex + 1} sur {questions.length}
            </span>
            <span className={`font-semibold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
              {score} / {totalPossiblePoints} {translate('learn_pts')}
            </span>
          </div>
        </div>

        <div
          ref={containerRef}
          className={`rounded-xl sm:rounded-2xl border p-3 sm:p-5 shadow-lg space-y-3 sm:space-y-4 transition-colors ${
            isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
          }`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <p className={`text-sm sm:text-lg font-semibold ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>{currentQuestion?.question_text}</p>
          {currentQuestion?.type === 'mcq' && currentQuestion.optionsList ? (
            <div className="space-y-2">
              {currentQuestion.optionsList.map((opt) => {
                const isSelected = answer === opt.label;
                const isCorrect = correctOptionId === opt.label;
                const isSelectedAndWrong = hasAnswered && isSelected && !isCorrect;

                let buttonClasses = 'w-full text-left p-2.5 sm:p-3 rounded-xl border-2 transition-all ';
                let labelClasses = 'font-semibold mr-2 text-sm sm:text-base ';
                let textClasses = 'text-sm sm:text-base ';

                if (hasAnswered) {
                  // After answering: show green for correct, red for selected wrong
                  if (isCorrect) {
                    buttonClasses += isDark
                      ? 'border-green-500 bg-green-500/90 '
                      : 'border-green-500 bg-green-500 ';
                    labelClasses += 'text-white ';
                    textClasses = 'text-white font-medium';
                  } else if (isSelectedAndWrong) {
                    buttonClasses += isDark
                      ? 'border-[#d91a1c] bg-[#d91a1c]/90 '
                      : 'border-[#d91a1c] bg-[#d91a1c] ';
                    labelClasses += 'text-white ';
                    textClasses = 'text-white';
                  } else {
                    buttonClasses += isDark
                      ? 'border-neutral-700 bg-neutral-700/50 opacity-60 '
                      : 'border-gray-200 bg-gray-50 opacity-60 ';
                    labelClasses += isDark ? 'text-neutral-500 ' : 'text-gray-400 ';
                    textClasses = isDark ? 'text-neutral-400' : 'text-gray-600';
                  }
                  buttonClasses += 'cursor-not-allowed';
                } else {
                  // Before answering: show selection state
                  if (isSelected) {
                    buttonClasses += isDark
                      ? 'border-orange-500 bg-orange-500/20 '
                      : 'border-orange-500 bg-orange-50 ';
                    labelClasses += isDark ? 'text-orange-400 ' : 'text-orange-600 ';
                    textClasses = isDark ? 'text-neutral-100' : 'text-gray-900';
                  } else {
                    buttonClasses += isDark
                      ? 'border-neutral-600 hover:border-orange-500/50 '
                      : 'border-gray-200 hover:border-orange-300 ';
                    labelClasses += isDark ? 'text-orange-400 ' : 'text-orange-600 ';
                    textClasses = isDark ? 'text-neutral-200' : 'text-gray-900';
                  }
                }

                return (
                  <button
                    key={opt.label}
                    onClick={() => {
                      if (!hasAnswered) {
                        setAnswer(opt.label);
                        handleValidate(opt.label);
                      }
                    }}
                    className={buttonClasses}
                    disabled={hasAnswered}
                  >
                    <span className={labelClasses}>{opt.label}.</span>
                    <span className={textClasses}>{opt.value}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              placeholder={translate('quiz_short_placeholder')}
              className={`w-full p-3 rounded-xl border-2 focus:border-orange-500 focus:outline-none transition-colors ${
                isDark
                  ? 'bg-neutral-700 border-neutral-600 text-neutral-100 placeholder-neutral-500'
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
              disabled={!!feedback}
            />
          )}

          {feedback && (
            <ExplanationCard
              isCorrect={feedback.isCorrect}
              correctAnswer={!feedback.isCorrect && currentQuestion?.type === 'mcq' && correctOptionId
                ? `${correctOptionId}: ${currentQuestion.optionsList?.find(o => o.label === correctOptionId)?.value || ''}`
                : undefined}
              explanation={feedback.explanation}
              sourceExcerpt={feedback.sourceExcerpt}
              points={feedback.points}
              translate={translate}
              letterMapping={currentQuestion?.optionsList?.reduce((acc, opt) => {
                acc[opt.originalIndex] = opt.label;
                return acc;
              }, {} as Record<number, string>)}
              isDark={isDark}
            />
          )}

          {!feedback && currentQuestion?.type !== 'mcq' && (
            <button
              onClick={() => handleValidate()}
              disabled={!answer.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500 text-white text-sm sm:text-base font-semibold hover:bg-orange-600 disabled:opacity-60"
            >
              {translate('quiz_validate')}
            </button>
          )}

          {/* Navigation and finish buttons */}
          <div className="flex items-center gap-2">
            {/* Previous button */}
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className={`px-4 py-3 rounded-xl border font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                isDark
                  ? 'border-neutral-600 text-neutral-300 hover:bg-neutral-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              aria-label="Question précédente"
            >
              ←
            </button>

            {/* Next/Finish button */}
            {feedback && currentIndex < questions.length - 1 && (
              <button
                onClick={goToNext}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm sm:text-base font-semibold transition-colors ${
                  isDark
                    ? 'bg-neutral-700 text-neutral-100 hover:bg-neutral-600'
                    : 'bg-gray-900 text-white hover:bg-black'
                }`}
              >
                {translate('quiz_next_question')}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Finish button or remaining count - only show when not on last question or when on last */}
            {(currentIndex === questions.length - 1 || !feedback) && (
              allAnswered ? (
                <button
                  onClick={handleFinishClick}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500 text-white text-sm sm:text-base font-semibold hover:bg-orange-600"
                >
                  Terminer le quiz
                </button>
              ) : (
                <span className={`flex-1 text-center text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                  {remainingCount} question{remainingCount > 1 ? 's' : ''} restante{remainingCount > 1 ? 's' : ''}
                </span>
              )
            )}

            {/* Next button */}
            <button
              onClick={goToNext}
              disabled={currentIndex === questions.length - 1}
              className={`px-4 py-3 rounded-xl border font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
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
            answers={quizAnswers}
            questionIds={questionIds}
            onNavigate={navigateToQuestion}
            isDark={isDark}
          />
        </div>
      </div>
    </div>
  );
}




