'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Check, X, ChevronRight, Loader2, Trophy, HelpCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import GenerationProgress from './GenerationProgress';
import MathText from '@/components/ui/MathText';


// Skeleton component for loading questions
function QuestionSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="p-6 space-y-6">
      {/* Question type badge skeleton */}
      <div className={`h-6 w-20 rounded-full animate-pulse ${
        isDark ? 'bg-neutral-700' : 'bg-gray-200'
      }`} />

      {/* Question text skeleton */}
      <div className="space-y-3">
        <div className={`h-5 rounded animate-pulse ${
          isDark ? 'bg-neutral-700' : 'bg-gray-200'
        }`} />
        <div className={`h-5 w-4/5 rounded animate-pulse ${
          isDark ? 'bg-neutral-700' : 'bg-gray-200'
        }`} />
      </div>

      {/* Options skeleton */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`p-4 rounded-xl border-2 flex items-center gap-3 ${
              isDark ? 'border-neutral-700' : 'border-gray-200'
            }`}
          >
            <div className={`w-8 h-8 rounded-full animate-pulse ${
              isDark ? 'bg-neutral-700' : 'bg-gray-200'
            }`} />
            <div className={`flex-1 h-4 rounded animate-pulse ${
              isDark ? 'bg-neutral-700' : 'bg-gray-200'
            }`} style={{ width: `${70 - i * 10}%` }} />
          </div>
        ))}
      </div>

      {/* Button skeleton */}
      <div className="flex justify-end">
        <div className={`h-12 w-32 rounded-xl animate-pulse ${
          isDark ? 'bg-neutral-700' : 'bg-gray-200'
        }`} />
      </div>
    </div>
  );
}

// Question interface matching the SSE event data
export interface StreamingQuestion {
  id: string;
  chapterId: string;
  chapterTitle: string;
  type: string; // 'QCM' | 'vrai_faux' | 'texte_trous'
  questionText: string;
  options: string[] | null;
  correctOptionIndex: number | null;
  answerText: string | null;
  explanation: string | null;
  questionNumber: number;
  sourceExcerpt: string | null;
  pageNumber: number | null;
}

interface UserAnswer {
  questionId: string;
  selectedIndex?: number;
  textAnswer?: string;
  isCorrect: boolean;
}

interface ProgressiveQuizViewProps {
  /** Questions received so far */
  questions: StreamingQuestion[];
  /** Whether more questions are being generated */
  isGenerating: boolean;
  /** Current generation progress (0-100) */
  progress: number;
  /** Number of questions generated */
  questionsGenerated: number;
  /** Total expected questions (if known) */
  totalQuestions?: number;
  /** Current progress message */
  progressMessage?: string;
  /** Called when user completes the quiz */
  onComplete?: (score: number, answers: UserAnswer[]) => void;
  /** Course ID for tracking */
  courseId: string;
}

export default function ProgressiveQuizView({
  questions,
  isGenerating,
  progress,
  questionsGenerated,
  totalQuestions,
  progressMessage,
  onComplete,
  courseId,
}: ProgressiveQuizViewProps) {
  const { translate } = useLanguage();
  const { isDark } = useTheme();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [isQuizComplete, setIsQuizComplete] = useState(false);

  // Storage key for persisting answers
  const storageKey = `progressive_quiz_answers_${courseId}`;

  // Restore userAnswers and currentQuestionIndex from sessionStorage on mount
  useEffect(() => {
    const savedData = sessionStorage.getItem(storageKey);
    if (savedData) {
      try {
        const { answers, questionIndex } = JSON.parse(savedData);
        if (Array.isArray(answers) && answers.length > 0) {
          setUserAnswers(answers);
          // Restore to the question after the last answered one, or last answered if it's incomplete
          const lastAnsweredIndex = Math.min(questionIndex ?? answers.length, questions.length - 1);
          setCurrentQuestionIndex(Math.max(0, lastAnsweredIndex));
          // If this question was already answered, show feedback
          const currentAnswer = answers.find((a: UserAnswer) => a.questionId === questions[lastAnsweredIndex]?.id);
          if (currentAnswer) {
            setShowFeedback(true);
            if (currentAnswer.selectedIndex !== undefined) {
              setSelectedAnswer(currentAnswer.selectedIndex);
            }
            if (currentAnswer.textAnswer) {
              setTextAnswer(currentAnswer.textAnswer);
            }
          }
        }
      } catch (e) {
        console.error('Failed to restore progressive quiz answers:', e);
      }
    }
  }, [storageKey]); // Only run on mount

  // Persist userAnswers and currentQuestionIndex to sessionStorage
  useEffect(() => {
    if (userAnswers.length > 0) {
      sessionStorage.setItem(storageKey, JSON.stringify({
        answers: userAnswers,
        questionIndex: currentQuestionIndex,
      }));
    }
  }, [userAnswers, currentQuestionIndex, storageKey]);

  // Clear storage when quiz is complete
  useEffect(() => {
    if (isQuizComplete) {
      sessionStorage.removeItem(storageKey);
    }
  }, [isQuizComplete, storageKey]);

  const currentQuestion = questions[currentQuestionIndex];
  const hasMoreQuestions = currentQuestionIndex < questions.length - 1 || isGenerating;
  const canGoNext = currentQuestionIndex < questions.length - 1;

  // Calculate score
  const score = useMemo(() => {
    if (userAnswers.length === 0) return 0;
    const correct = userAnswers.filter(a => a.isCorrect).length;
    return Math.round((correct / userAnswers.length) * 100);
  }, [userAnswers]);

  // Check if answer is correct
  const checkAnswer = useCallback((question: StreamingQuestion, answerIndex?: number, text?: string): boolean => {
    if (question.type === 'QCM' || question.type === 'vrai_faux') {
      return answerIndex === question.correctOptionIndex;
    }
    if (question.type === 'texte_trous' && question.answerText && text) {
      // Simple text comparison (could be enhanced with fuzzy matching)
      return text.trim().toLowerCase() === question.answerText.trim().toLowerCase();
    }
    return false;
  }, []);

  // Handle answer submission
  const handleSubmitAnswer = useCallback(() => {
    if (!currentQuestion) return;

    let isCorrect = false;

    if (currentQuestion.type === 'QCM' || currentQuestion.type === 'vrai_faux') {
      if (selectedAnswer === null) return;
      isCorrect = checkAnswer(currentQuestion, selectedAnswer);
    } else if (currentQuestion.type === 'texte_trous') {
      if (!textAnswer.trim()) return;
      isCorrect = checkAnswer(currentQuestion, undefined, textAnswer);
    }

    // Record answer
    setUserAnswers(prev => [
      ...prev.filter(a => a.questionId !== currentQuestion.id),
      {
        questionId: currentQuestion.id,
        selectedIndex: selectedAnswer ?? undefined,
        textAnswer: textAnswer || undefined,
        isCorrect,
      },
    ]);

    setShowFeedback(true);
  }, [currentQuestion, selectedAnswer, textAnswer, checkAnswer]);

  // Handle next question
  const handleNextQuestion = useCallback(() => {
    if (canGoNext) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setTextAnswer('');
      setShowFeedback(false);
    } else if (!isGenerating && questions.length > 0 && userAnswers.length === questions.length) {
      // Quiz complete
      setIsQuizComplete(true);
      onComplete?.(score, userAnswers);
    }
  }, [canGoNext, isGenerating, questions.length, userAnswers.length, score, userAnswers, onComplete]);

  // Check if current answer is already recorded
  const currentAnswer = useMemo(() => {
    if (!currentQuestion) return null;
    return userAnswers.find(a => a.questionId === currentQuestion.id);
  }, [currentQuestion, userAnswers]);

  // Restore state when viewing answered question
  useEffect(() => {
    if (currentAnswer && currentQuestion) {
      if (currentAnswer.selectedIndex !== undefined) {
        setSelectedAnswer(currentAnswer.selectedIndex);
      }
      if (currentAnswer.textAnswer) {
        setTextAnswer(currentAnswer.textAnswer);
      }
      setShowFeedback(true);
    }
  }, [currentAnswer, currentQuestion]);

  // Quiz completion screen
  if (isQuizComplete) {
    const correctCount = userAnswers.filter(a => a.isCorrect).length;

    return (
      <div className={`rounded-2xl border shadow-sm p-8 text-center ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${
          score >= 80 ? 'bg-green-500/20' : score >= 50 ? 'bg-orange-500/20' : 'bg-[#d91a1c]/20'
        }`}>
          <Trophy className={`w-10 h-10 ${
            score >= 80 ? 'text-green-500' : score >= 50 ? 'text-orange-500' : 'text-[#d91a1c]'
          }`} />
        </div>

        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
          {translate('results_title')}
        </h2>

        <p className={`text-lg mb-4 ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
          {score >= 80
            ? translate('results_excellent')
            : score >= 50
            ? translate('results_good')
            : translate('results_retry')}
        </p>

        <div className={`text-5xl font-bold mb-2 ${
          score >= 80 ? 'text-green-500' : score >= 50 ? 'text-orange-500' : 'text-[#d91a1c]'
        }`}>
          {score}%
        </div>

        <p className={`text-sm ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
          {correctCount} / {userAnswers.length} {translate('results_correct')}
        </p>
      </div>
    );
  }

  // Waiting for first question - show skeleton
  if (questions.length === 0) {
    return (
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${
        isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
      }`}>
        {/* Header with progress */}
        <div className={`p-4 border-b ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`h-4 w-32 rounded animate-pulse ${isDark ? 'bg-neutral-700' : 'bg-gray-200'}`} />
            <div className={`h-4 w-12 rounded animate-pulse ${isDark ? 'bg-neutral-700' : 'bg-gray-200'}`} />
          </div>

          {/* Progress bar */}
          <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {/* Generation progress steps */}
          <div className="mt-3">
            <GenerationProgress
              type="quiz"
              progress={progress}
              message={progressMessage}
              itemsGenerated={questionsGenerated}
              totalItems={totalQuestions}
              compact={true}
            />
          </div>
        </div>

        {/* Skeleton question */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <QuestionSkeleton isDark={isDark} />
        </motion.div>

        {/* Upcoming questions indicator */}
        {totalQuestions && totalQuestions > 0 && (
          <div className={`px-6 pb-6 border-t ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
            <p className={`text-xs text-center mb-3 pt-4 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              {translate('gen_questions_coming', { total: totalQuestions.toString() }) || `${totalQuestions} questions en préparation...`}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: Math.min(totalQuestions, 10) }).map((_, idx) => (
                <motion.div
                  key={idx}
                  className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-neutral-700' : 'bg-gray-300'}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.05, duration: 0.2 }}
                />
              ))}
              {totalQuestions > 10 && (
                <span className={`text-xs ml-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                  +{totalQuestions - 10}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main quiz view
  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${
      isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
    }`}>
      {/* Header with progress */}
      <div className={`p-4 border-b ${isDark ? 'border-neutral-800' : 'border-gray-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
              {translate('quiz_progress').replace('{current}', String(currentQuestionIndex + 1)).replace('{total}', String(questions.length))}
              {isGenerating && <span className="text-orange-500"> (+)</span>}
            </span>
            {currentQuestion?.chapterTitle && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {currentQuestion.chapterTitle}
              </span>
            )}
          </div>
          <div className={`text-sm font-semibold ${isDark ? 'text-neutral-200' : 'text-gray-800'}`}>
            {score}%
          </div>
        </div>

        {/* Progress bar */}
        <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? 'bg-neutral-800' : 'bg-gray-200'}`}>
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: `${((currentQuestionIndex + 1) / Math.max(questions.length, 1)) * 100}%`,
              background: 'linear-gradient(90deg, #f97316 0%, #fb923c 100%)',
            }}
          />
        </div>

        {/* Generation progress steps (compact mode while playing) */}
        {isGenerating && (
          <div className="mt-3">
            <GenerationProgress
              type="quiz"
              progress={progress}
              message={progressMessage}
              itemsGenerated={questionsGenerated}
              totalItems={totalQuestions}
              compact={true}
            />
          </div>
        )}
      </div>

      {/* Question content with animation */}
      <AnimatePresence mode="wait">
        {currentQuestion && (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="p-6"
          >
            {/* Question type badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                currentQuestion.type === 'QCM'
                  ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                  : currentQuestion.type === 'vrai_faux'
                  ? isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                  : isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
              }`}>
                {currentQuestion.type === 'QCM' && translate('quiz_question_type_mcq')}
                {currentQuestion.type === 'vrai_faux' && translate('quiz_question_type_true_false')}
                {currentQuestion.type === 'texte_trous' && translate('quiz_question_type_fill_blank')}
              </span>
            </div>

            {/* Question text */}
            <h3 className={`text-lg font-semibold mb-6 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              <MathText>{currentQuestion.questionText}</MathText>
            </h3>

            {/* Answer options with staggered animation */}
            {(currentQuestion.type === 'QCM' || currentQuestion.type === 'vrai_faux') && currentQuestion.options && (
              <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrect = index === currentQuestion.correctOptionIndex;
                  const showCorrectness = showFeedback;

                  let optionStyles = isDark
                    ? 'bg-neutral-800 border-neutral-700 hover:border-orange-500'
                    : 'bg-white border-gray-200 hover:border-orange-500';

                  if (showCorrectness) {
                    if (isCorrect) {
                      optionStyles = isDark
                        ? 'bg-green-500/20 border-green-500'
                        : 'bg-green-50 border-green-500';
                    } else if (isSelected && !isCorrect) {
                      optionStyles = isDark
                        ? 'bg-[#d91a1c]/20 border-[#d91a1c]'
                        : 'bg-[#d91a1c]/5 border-[#d91a1c]';
                    }
                  } else if (isSelected) {
                    optionStyles = isDark
                      ? 'bg-orange-500/20 border-orange-500'
                      : 'bg-orange-50 border-orange-500';
                  }

                  return (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      onClick={() => !showFeedback && setSelectedAnswer(index)}
                      disabled={showFeedback}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${optionStyles} ${
                        showFeedback ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          showCorrectness && isCorrect
                            ? 'bg-green-500 text-white'
                            : showCorrectness && isSelected && !isCorrect
                            ? 'bg-[#d91a1c] text-white'
                            : isSelected
                            ? 'bg-orange-500 text-white'
                            : isDark ? 'bg-neutral-700 text-neutral-300' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {showCorrectness && isCorrect ? (
                            <Check className="w-4 h-4" />
                          ) : showCorrectness && isSelected && !isCorrect ? (
                            <X className="w-4 h-4" />
                          ) : (
                            String.fromCharCode(65 + index)
                          )}
                        </div>
                        <span className={`flex-1 ${isDark ? 'text-neutral-100' : 'text-gray-800'}`}>
                          <MathText>{option}</MathText>
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Text input for fill-in-the-blank */}
            {currentQuestion.type === 'texte_trous' && (
              <div className="mb-6">
                <motion.input
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  type="text"
                  value={textAnswer}
                  onChange={(e) => !showFeedback && setTextAnswer(e.target.value)}
                  disabled={showFeedback}
                  placeholder={translate('quiz_short_placeholder')}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    showFeedback
                      ? currentAnswer?.isCorrect
                        ? isDark ? 'bg-green-500/20 border-green-500' : 'bg-green-50 border-green-500'
                        : isDark ? 'bg-[#d91a1c]/20 border-[#d91a1c]' : 'bg-[#d91a1c]/5 border-[#d91a1c]'
                      : isDark
                      ? 'bg-neutral-800 border-neutral-700 focus:border-orange-500'
                      : 'bg-white border-gray-200 focus:border-orange-500'
                  } ${isDark ? 'text-neutral-100 placeholder-neutral-500' : 'text-gray-800 placeholder-gray-400'}`}
                />
                {showFeedback && currentQuestion.answerText && (
                  <p className={`mt-2 text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                    {translate('quiz_correct_answer_is')} <strong>{currentQuestion.answerText}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Explanation (shown after answer) */}
            {showFeedback && currentQuestion.explanation && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`p-4 rounded-xl mb-4 ${
                  isDark ? 'bg-neutral-800' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <HelpCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
                  <p className={`text-sm ${isDark ? 'text-neutral-300' : 'text-gray-600'}`}>
                    {currentQuestion.explanation}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Source excerpt from course (shown after answer) */}
            {showFeedback && currentQuestion.sourceExcerpt && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className={`p-4 rounded-xl mb-6 border ${
                  isDark
                    ? 'bg-amber-950/30 border-amber-800/50'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDark ? 'text-amber-500' : 'text-amber-600'}`} />
                  <div>
                    <p className={`text-xs font-medium mb-1 ${isDark ? 'text-amber-500' : 'text-amber-700'}`}>
                      {translate('quiz_source_excerpt')}{currentQuestion.pageNumber ? ` — ${translate('quiz_page')} ${currentQuestion.pageNumber}` : ''}
                    </p>
                    <p className={`text-sm italic ${isDark ? 'text-amber-200/80' : 'text-amber-800'}`}>
                      &ldquo;{currentQuestion.sourceExcerpt}&rdquo;
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              {/* Navigation dots with animation */}
              <div className="flex items-center gap-1.5">
                {questions.slice(0, 10).map((q, idx) => (
                  <motion.button
                    key={q.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, delay: idx * 0.03 }}
                    onClick={() => {
                      setCurrentQuestionIndex(idx);
                      setShowFeedback(!!userAnswers.find(a => a.questionId === questions[idx]?.id));
                    }}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx === currentQuestionIndex
                        ? 'bg-orange-500 scale-125'
                        : userAnswers.find(a => a.questionId === questions[idx]?.id)
                        ? userAnswers.find(a => a.questionId === questions[idx]?.id)?.isCorrect
                          ? 'bg-green-500'
                          : 'bg-[#d91a1c]'
                        : isDark ? 'bg-neutral-700' : 'bg-gray-300'
                    }`}
                  />
                ))}
                {isGenerating && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="w-2.5 h-2.5 rounded-full bg-orange-500/50"
                  />
                )}
                {questions.length > 10 && (
                  <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                    +{questions.length - 10}
                  </span>
                )}
              </div>

              {/* Submit / Next button */}
              {!showFeedback ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={
                    (currentQuestion.type !== 'texte_trous' && selectedAnswer === null) ||
                    (currentQuestion.type === 'texte_trous' && !textAnswer.trim())
                  }
                  className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {translate('quiz_validate')}
                </button>
              ) : (
                <button
                  onClick={handleNextQuestion}
                  disabled={!canGoNext && isGenerating}
                  className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {!canGoNext && !isGenerating && userAnswers.length === questions.length ? (
                    translate('results_score')
                  ) : !canGoNext && isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {translate('loading')}
                    </>
                  ) : (
                    <>
                      {translate('quiz_next_question')}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
