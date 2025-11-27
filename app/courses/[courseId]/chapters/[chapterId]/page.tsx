'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackEvent } from '@/lib/posthog';
import { loadDemoCourse } from '@/lib/demoCourse';
import { getLocalizedChapterTitleAsync } from '@/lib/content-translator';

type QuestionType = 'mcq' | 'open' | 'short';

interface Question {
  id: string;
  question_text: string;
  question_number: number;
  type: QuestionType;
  options?: Record<string, string> | string[];
  optionsList?: { label: string; value: string; index: number }[];
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

export default function ChapterQuizPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { translate, currentLanguage } = useLanguage();

  const courseId = params?.courseId as string;
  const chapterId = params?.chapterId as string;
  const isDemoId = courseId?.startsWith('demo-');

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string; points: number; explanation?: string } | null>(null);
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

  const currentQuestion = questions[currentIndex];

  // Progress label
  const progressLabel = `${translate('quiz_question')} ${currentIndex + 1}/${questions.length}`;

  // Calculate total possible points
  const totalPossiblePoints = useMemo(() => {
    return questions.reduce((sum, q) => {
      const points = typeof q.points === 'number' ? q.points : 10;
      return sum + points;
    }, 0);
  }, [questions]);

  useEffect(() => {
    loadQuestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, user]);

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

  const normalizeOptions = (options?: Record<string, string> | string[] | null) => {
    if (!options) return undefined;
    const entries = Array.isArray(options) ? options.map((v, idx) => [idx.toString(), v]) : Object.entries(options);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    return entries.map(([_, value], idx) => ({
      label: letters[idx] || String.fromCharCode(65 + idx),
      value,
      index: idx,
    }));
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
            demoChapter.questions.map((q, idx) => ({
              id: q.id,
              question_text: q.prompt,
              question_number: idx + 1,
              type: q.type === 'mcq' ? 'mcq' : 'short',
              options: q.options,
              optionsList: normalizeOptions(q.options),
              correct_option_index: Array.isArray(q.options)
                ? q.options.findIndex((opt) => opt === q.answer)
                : Object.values(q.options || {}).findIndex((opt) => opt === q.answer),
              points: 10,
              answer_text: q.answer,
              explanation: q.explanation,
              page_source: (q as any)?.page_source || null,
            }))
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
      const normalized = data.questions.map((q: Question) => ({
        ...q,
        optionsList: normalizeOptions(q.options),
        page_source: (q as any)?.page_source || null,
      }));
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
        setScore((prev) => prev + (result.points || 0));
        setCorrectCount((prev) => prev + (result.isCorrect ? 1 : 0));
        setReviewItems((prev) => [
          ...prev,
          {
            index: currentIndex + 1,
            question: currentQuestion.question_text,
            student_answer: answerToValidate,
            is_correct: result.isCorrect,
            correct_answer: currentQuestion.answer_text || '',
            explanation: currentQuestion.explanation || result.message,
            page_source: currentQuestion.page_source || null,
          },
        ]);
        return;
      }

      console.log('[frontend] DEBUG STEP 1 - answerToValidate received:', answerToValidate);
      console.log('[frontend] DEBUG STEP 2 - currentQuestion.optionsList:', currentQuestion.optionsList);

      const selectedIndex =
        currentQuestion.type === 'mcq'
          ? currentQuestion.optionsList?.find((o) => o.label === answerToValidate)?.index
          : undefined;

      console.log('[frontend] DEBUG STEP 3 - selectedIndex calculated:', selectedIndex);
      console.log('[frontend] DEBUG STEP 4 - willSend to API:', currentQuestion.type === 'mcq' ? selectedIndex : answerToValidate);

      const response = await fetch(`/api/questions/${currentQuestion.id}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: currentQuestion.type === 'mcq' ? selectedIndex : answerToValidate,
        }),
      });
      const data = await response.json();

      // For API mode: set everything BEFORE marking as answered
      if (currentQuestion.type === 'mcq' && currentQuestion.optionsList) {
        setSelectedOptionId(answerToValidate);

        const correctIndex = data.correctOptionIndex ?? currentQuestion.correct_option_index ?? 0;
        const correctLabel = currentQuestion.optionsList.find((o) => o.index === correctIndex)?.label;
        if (correctLabel) {
          setCorrectOptionId(correctLabel);
        }
      }

      // Mark as answered AFTER setting correctOptionId
      setHasAnswered(true);

      setFeedback({
        isCorrect: data.isCorrect,
        message: data.feedback,
        points: data.pointsEarned || 0,
        explanation: data.explanation,
      });
      setScore((prev) => prev + (data.pointsEarned || 0));
      setCorrectCount((prev) => prev + (data.isCorrect ? 1 : 0));
      setReviewItems((prev) => [
        ...prev,
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
            currentQuestion.optionsList?.find((o) => o.index === data.correctOptionIndex)?.value ||
            '',
          explanation: data.explanation || data.feedback,
          page_source: currentQuestion.page_source || null,
        },
      ]);
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
      setCurrentIndex((prev) => prev + 1);
      setAnswer('');
      setFeedback(null);
      setSelectedOptionId(null);
      setCorrectOptionId(null);
      setHasAnswered(false);
    } else {
      // Quiz completed - redirect to results
      router.push(`/courses/${courseId}/chapters/${chapterId}/results?score=${score}&total=${totalPossiblePoints}&correct=${correctCount}&totalQuestions=${questions.length}`);
      trackEvent('quiz_completed', { userId: user?.id, chapterId, score, totalPossiblePoints });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{translate('learn_loading')}</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <p className="text-gray-600">{translate('learn_error_question')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-orange-600 font-semibold">{courseTitle}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{chapterTitle}</h1>
          <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
            <span>{progressLabel}</span>
            <span className="font-semibold text-orange-600">
              {score} / {totalPossiblePoints} {translate('learn_pts')}
            </span>
          </div>
          <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-lg space-y-4">
          <p className="text-base sm:text-lg font-semibold text-gray-900">{currentQuestion?.question_text}</p>
          {currentQuestion?.type === 'mcq' && currentQuestion.optionsList ? (
            <div className="space-y-2">
              {currentQuestion.optionsList.map((opt) => {
                const isSelected = answer === opt.label;
                const isCorrect = correctOptionId === opt.label;
                const isSelectedAndWrong = hasAnswered && isSelected && !isCorrect;

                let buttonClasses = 'w-full text-left p-3 rounded-xl border-2 transition-all ';
                let labelClasses = 'font-semibold mr-2 ';
                let textClasses = '';

                if (hasAnswered) {
                  // After answering: show green for correct, red for selected wrong
                  if (isCorrect) {
                    buttonClasses += 'border-green-500 bg-green-500 ';
                    labelClasses += 'text-white ';
                    textClasses = 'text-white font-medium';
                  } else if (isSelectedAndWrong) {
                    buttonClasses += 'border-red-500 bg-red-500 ';
                    labelClasses += 'text-white ';
                    textClasses = 'text-white';
                  } else {
                    buttonClasses += 'border-gray-200 bg-gray-50 opacity-60 ';
                    labelClasses += 'text-gray-400 ';
                    textClasses = 'text-gray-600';
                  }
                  buttonClasses += 'cursor-not-allowed';
                } else {
                  // Before answering: show selection state
                  if (isSelected) {
                    buttonClasses += 'border-orange-500 bg-orange-50 ';
                    labelClasses += 'text-orange-600 ';
                    textClasses = 'text-gray-900';
                  } else {
                    buttonClasses += 'border-gray-200 hover:border-orange-300 ';
                    labelClasses += 'text-orange-600 ';
                    textClasses = 'text-gray-900';
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
              className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
              disabled={!!feedback}
            />
          )}

          {feedback && (
            <div
              className={`rounded-xl border-2 p-4 ${
                feedback.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              {feedback.isCorrect ? (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-green-800 text-sm">
                      {translate('quiz_feedback_correct')}
                    </p>
                    {feedback.points > 0 && (
                      <p className="text-xs text-green-700 mt-1">+{feedback.points} {translate('learn_pts')}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 text-sm mb-2">
                      Mauvaise réponse
                    </p>
                    <p className="text-sm text-gray-800 leading-relaxed">
                      <span className="font-semibold text-gray-900">
                        La bonne réponse était {correctOptionId}
                        {currentQuestion?.type === 'mcq' && currentQuestion.optionsList && correctOptionId && (
                          <>
                            {' : '}
                            {currentQuestion.optionsList.find((o) => o.label === correctOptionId)?.value}
                          </>
                        )}
                        .{' '}
                      </span>
                      {feedback.explanation && (
                        <span>{feedback.explanation}</span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!feedback && currentQuestion?.type !== 'mcq' && (
            <button
              onClick={handleValidate}
              disabled={!answer.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60"
            >
              {translate('quiz_validate')}
            </button>
          )}

          {feedback && (
            <button
              onClick={handleNext}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-black"
            >
              {currentIndex < questions.length - 1 ? translate('quiz_next_question') : translate('quiz_end_continue')}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}




