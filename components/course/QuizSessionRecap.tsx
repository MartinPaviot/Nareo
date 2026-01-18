'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { RotateCcw, Check, Clock, Star, CheckCircle2, ChevronDown, ChevronUp, Loader2, Gift, X, Sparkles } from 'lucide-react';
import Image from 'next/image';

// AI Feedback types
interface ConceptFeedback {
  concept: string;
  explication: string;
}

interface AIFeedback {
  feedback_intro: string;
  points_maitrises: ConceptFeedback[];
  points_a_revoir: ConceptFeedback[];
  mascotte_humeur: 'happy' | 'neutral' | 'disappointed';
}

// Question result for recap
export interface QuestionResult {
  id: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
}

// Quiz session statistics
export interface QuizSessionStats {
  total: number;
  correct: number;
  incorrect: number;
  score: number; // 0-100
  duration?: number; // in seconds
  questionResults: QuestionResult[];
}

interface QuizSessionRecapProps {
  stats: QuizSessionStats;
  onFinish: () => void;
  onRetryErrors?: () => void;
  courseTitle?: string;
  courseId?: string;
}

// Color schemes based on score percentage - Orange theme
const getScoreColors = (percentage: number, isDark: boolean) => {
  if (percentage < 40) {
    // Low score - red tone
    return isDark
      ? { primary: '#ef4444', secondary: '#7f1d1d', bg: 'rgba(239, 68, 68, 0.1)' }
      : { primary: '#ef4444', secondary: '#fecaca', bg: '#fef2f2' };
  } else if (percentage < 70) {
    // Medium score - orange
    return isDark
      ? { primary: '#F97316', secondary: '#7c2d12', bg: 'rgba(249, 115, 22, 0.1)' }
      : { primary: '#F97316', secondary: '#FED7AA', bg: '#FFF7ED' };
  } else {
    // High score - green
    return isDark
      ? { primary: '#379f5a', secondary: '#14532d', bg: 'rgba(55, 159, 90, 0.1)' }
      : { primary: '#379f5a', secondary: '#b8dfc6', bg: '#edf7f1' };
  }
};

// Star calculation
const getStars = (percentage: number): number => {
  if (percentage >= 80) return 3;
  if (percentage >= 50) return 2;
  if (percentage >= 20) return 1;
  return 0;
};

// Circular Progress Component
const CircularProgress = ({
  percentage,
  correct,
  total,
  colors,
}: {
  percentage: number;
  correct: number;
  total: number;
  colors: { primary: string; secondary: string; bg: string };
}) => {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={colors.secondary}
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={colors.primary}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: colors.primary }}>
          {Math.round(animatedPercentage)}%
        </span>
        <span className="text-xs text-gray-500">
          {correct}/{total}
        </span>
      </div>
    </div>
  );
};

// Star Rating Component
const StarRating = ({ earnedStars }: { earnedStars: number }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex justify-center gap-1 mt-2">
      {[1, 2, 3].map((star) => {
        const isEarned = star <= earnedStars;
        return (
          <Star
            key={star}
            className={`w-6 h-6 transition-all duration-500 ${
              visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            } ${isEarned ? '' : 'opacity-30 scale-75'}`}
            style={{
              transitionDelay: `${star * 150}ms`,
              fill: isEarned ? '#FBBF24' : '#D1D5DB',
              color: isEarned ? '#FBBF24' : '#D1D5DB'
            }}
          />
        );
      })}
    </div>
  );
};

export default function QuizSessionRecap({
  stats,
  onFinish,
  onRetryErrors,
  courseTitle,
  courseId,
}: QuizSessionRecapProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { translate, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  // Guest user modals
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showFirstQuizCelebration, setShowFirstQuizCelebration] = useState(false);
  const [isFirstQuiz, setIsFirstQuiz] = useState(false);

  const colors = getScoreColors(stats.score, isDark);
  const earnedStars = getStars(stats.score);

  // Separate correct and incorrect questions
  const correctQuestions = stats.questionResults.filter(q => q.isCorrect);
  const incorrectQuestions = stats.questionResults.filter(q => !q.isCorrect);

  // Fetch AI feedback for concepts
  useEffect(() => {
    const fetchAIFeedback = async () => {
      if (stats.questionResults.length === 0) return;

      setFeedbackLoading(true);
      try {
        // Convert QuestionResult to the format expected by the API
        const reviewItems = stats.questionResults.map((q, idx) => ({
          index: idx + 1,
          question: q.questionText,
          student_answer: q.userAnswer,
          is_correct: q.isCorrect,
          correct_answer: q.correctAnswer,
          explanation: q.explanation,
        }));

        const response = await fetch('/api/quiz-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewItems,
            percentage: stats.score,
            language: currentLanguage,
          }),
        });

        if (response.ok) {
          const feedback = await response.json() as AIFeedback;
          setAiFeedback(feedback);
        }
      } catch (error) {
        console.error('Failed to fetch AI feedback:', error);
      } finally {
        setFeedbackLoading(false);
      }
    };

    fetchAIFeedback();

    // Trigger fade-in animation
    const timer = setTimeout(() => {
      setFeedbackVisible(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [stats.questionResults, stats.score, currentLanguage]);

  // Show celebration and signup modals for guest users
  useEffect(() => {
    if (!user) {
      // Check if this is the user's first completed quiz
      const checkFirstQuiz = async () => {
        try {
          const response = await fetch('/api/courses/guest-count');
          if (response.ok) {
            const data = await response.json();
            // If guest has only 1 course, this is their first quiz
            setIsFirstQuiz(data.count <= 1);
          }
        } catch (error) {
          console.error('Error checking guest quiz count:', error);
        }
      };
      checkFirstQuiz();

      // Show first quiz celebration immediately, then signup modal after
      const celebrationTimer = setTimeout(() => {
        setShowFirstQuizCelebration(true);
      }, 800);

      return () => clearTimeout(celebrationTimer);
    }
  }, [user]);

  // When celebration is closed, show signup modal
  const handleCloseCelebration = () => {
    setShowFirstQuizCelebration(false);
    // Show signup modal after celebration
    setTimeout(() => {
      setShowSignupModal(true);
    }, 300);
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Get encouragement message based on performance
  const getEncouragementMessage = (): string => {
    if (stats.score >= 90) return translate('quiz_session_excellent');
    if (stats.score >= 70) return translate('quiz_session_good');
    if (stats.score >= 50) return translate('quiz_session_keep_going');
    return translate('quiz_session_practice_more');
  };

  // Get mascot image based on score or AI feedback
  const getMascotImage = () => {
    if (aiFeedback?.mascotte_humeur === 'disappointed') return '/chat/Disappointed.png';
    if (aiFeedback?.mascotte_humeur === 'neutral') return '/chat/Drag_and_Drop.png';
    if (aiFeedback?.mascotte_humeur === 'happy') return '/chat/Happy.png';

    if (stats.score < 40) return '/chat/Disappointed.png';
    if (stats.score < 70) return '/chat/Drag_and_Drop.png';
    return '/chat/Happy.png';
  };

  return (
    <div className={`p-4 sm:p-6 space-y-4 rounded-2xl ${isDark ? 'bg-neutral-900' : 'bg-white'}`}>
      {/* Score Card */}
      <div className={`rounded-2xl border p-4 ${
        isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
      }`}>
        <h1 className={`text-lg font-bold text-center mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {translate('quiz_session_complete')}
        </h1>

        {courseTitle && (
          <p className={`text-sm text-center mb-3 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            {courseTitle}
          </p>
        )}

        {/* Circular Progress */}
        <CircularProgress
          percentage={stats.score}
          correct={stats.correct}
          total={stats.total}
          colors={colors}
        />

        {/* Star Rating */}
        <StarRating earnedStars={earnedStars} />

        {/* Duration */}
        {stats.duration && (
          <div className={`flex items-center justify-center gap-2 mt-3 text-sm ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            <Clock className="w-4 h-4" />
            <span>{formatDuration(stats.duration)}</span>
          </div>
        )}
      </div>

      {/* Mascot Message */}
      <div
        className="rounded-xl p-3 border"
        style={{ backgroundColor: colors.bg, borderColor: colors.secondary }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <Image
              src={getMascotImage()}
              alt="Nareo"
              width={48}
              height={48}
              className="w-12 h-12 object-contain"
            />
          </div>
          <p className="text-sm font-medium leading-snug" style={{ color: colors.primary }}>
            {aiFeedback?.feedback_intro || getEncouragementMessage()}
          </p>
        </div>
      </div>

      {/* Pedagogical Feedback - Concepts maîtrisés et à revoir */}
      {stats.questionResults.length > 0 && (
        <div
          className={`rounded-2xl border p-3 shadow-lg transition-all duration-500 ${
            isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
          } ${feedbackVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {/* Loading state for AI feedback */}
          {feedbackLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="text-center space-y-2">
                <Loader2 className="w-5 h-5 text-orange-500 animate-spin mx-auto" />
                <p className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                  {translate('results_feedback_loading')}
                </p>
              </div>
            </div>
          ) : (
            /* Two-column concept lists */
            <div className="grid grid-cols-2 gap-3 items-stretch">
              {/* Points maîtrisés */}
              <div
                className={`rounded-xl p-3 border h-full ${
                  isDark ? 'bg-green-500/10 border-green-500/30' : ''
                }`}
                style={!isDark ? { backgroundColor: '#edf7f1', borderColor: '#b8dfc6' } : {}}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#379f5a' }}>
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                  <h4 className="text-sm font-semibold" style={{ color: isDark ? '#6ee7b7' : '#256838' }}>
                    {translate('results_feedback_mastered')}
                  </h4>
                </div>
                {aiFeedback?.points_maitrises && aiFeedback.points_maitrises.length > 0 ? (
                  <ul className="space-y-1.5">
                    {aiFeedback.points_maitrises.map((item, idx) => (
                      <li
                        key={idx}
                        className={`transition-all duration-300 ${
                          feedbackVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                        }`}
                        style={{ transitionDelay: `${150 + idx * 50}ms` }}
                      >
                        <p className="text-xs font-medium" style={{ color: isDark ? '#6ee7b7' : '#256838' }}>{item.concept}</p>
                        <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: isDark ? '#4ade80' : '#2d8049' }}>{item.explication}</p>
                      </li>
                    ))}
                  </ul>
                ) : correctQuestions.length > 0 ? (
                  <p className="text-xs italic" style={{ color: isDark ? '#4ade80' : '#2d8049' }}>
                    {translate('results_feedback_no_mastered')}
                  </p>
                ) : (
                  <p className="text-xs italic" style={{ color: isDark ? '#4ade80' : '#2d8049' }}>
                    {translate('results_feedback_no_mastered')}
                  </p>
                )}
              </div>

              {/* Points à revoir */}
              <div
                className={`rounded-xl p-3 border h-full ${
                  isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-orange-400 flex items-center justify-center">
                    <span className="text-white text-[10px] font-bold">!</span>
                  </div>
                  <h4 className={`text-sm font-semibold ${isDark ? 'text-orange-300' : 'text-orange-800'}`}>
                    {translate('results_feedback_to_review')}
                  </h4>
                </div>
                {aiFeedback?.points_a_revoir && aiFeedback.points_a_revoir.length > 0 ? (
                  <ul className="space-y-1.5">
                    {aiFeedback.points_a_revoir.map((item, idx) => (
                      <li
                        key={idx}
                        className={`transition-all duration-300 ${
                          feedbackVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                        }`}
                        style={{ transitionDelay: `${150 + idx * 50}ms` }}
                      >
                        <p className={`text-xs font-medium ${isDark ? 'text-orange-300' : 'text-orange-800'}`}>{item.concept}</p>
                        <p className={`text-[10px] mt-0.5 line-clamp-2 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{item.explication}</p>
                      </li>
                    ))}
                  </ul>
                ) : incorrectQuestions.length === 0 ? (
                  <p className={`text-xs italic ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                    {translate('results_feedback_all_mastered')}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {incorrectQuestions.slice(0, 3).map((item, idx) => (
                      <li
                        key={item.id}
                        className={`text-xs flex items-start gap-1.5 transition-all duration-300 ${
                          isDark ? 'text-orange-400' : 'text-orange-700'
                        } ${feedbackVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}
                        style={{ transitionDelay: `${150 + idx * 50}ms` }}
                      >
                        <span className={`mt-0.5 flex-shrink-0 ${isDark ? 'text-orange-500' : 'text-orange-500'}`}>•</span>
                        <span className="line-clamp-2">{item.questionText}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detailed question breakdown - collapsible */}
      {stats.questionResults.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-gray-200'
        }`}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`w-full flex items-center justify-between p-4 transition-colors ${
              isDark ? 'hover:bg-neutral-700/50' : 'hover:bg-gray-50'
            }`}
          >
            <span className={`text-sm font-semibold ${isDark ? 'text-neutral-200' : 'text-gray-700'}`}>
              {translate('quiz_detailed_results')}
            </span>
            {showDetails ? (
              <ChevronUp className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`} />
            )}
          </button>

          {showDetails && (
            <div className={`border-t ${isDark ? 'border-neutral-700' : 'border-gray-200'}`}>
              {/* Maîtrisé questions */}
              {correctQuestions.length > 0 && (
                <QuestionGroup
                  title={translate('quiz_mastered')}
                  questions={correctQuestions}
                  colorClass="text-green-500"
                  bgClass={isDark ? 'bg-green-500/5' : 'bg-green-50/50'}
                  icon={<CheckCircle2 className="w-3 h-3" />}
                  isDark={isDark}
                  translate={translate}
                />
              )}

              {/* À revoir questions */}
              {incorrectQuestions.length > 0 && (
                <QuestionGroup
                  title={translate('quiz_to_review')}
                  questions={incorrectQuestions}
                  colorClass="text-orange-500"
                  bgClass={isDark ? 'bg-orange-500/5' : 'bg-orange-50/50'}
                  icon={<RotateCcw className="w-3 h-3" />}
                  isDark={isDark}
                  showCorrectAnswer
                  translate={translate}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {/* Retry incorrect questions */}
        {stats.incorrect > 0 && onRetryErrors && (
          <button
            onClick={onRetryErrors}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors border ${
              isDark
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            {translate('quiz_retry_incorrect')} {stats.incorrect} {translate('quiz_incorrect_questions')}
          </button>
        )}

        {/* Finish button - always orange */}
        <button
          onClick={onFinish}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold shadow-md transition-colors bg-orange-500 hover:bg-orange-600"
        >
          <Check className="w-4 h-4" />
          {translate('quiz_finish_session')}
        </button>
      </div>

      {/* First Quiz Celebration Modal for guests */}
      {showFirstQuizCelebration && !user && isFirstQuiz && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className={`rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 animate-in zoom-in duration-300 ${
            isDark ? 'bg-neutral-800' : 'bg-white'
          }`}>
            <div className="flex justify-center">
              <Sparkles className="w-20 h-20 text-yellow-500 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('quiz_first_complete_title')}
              </h2>
              <p className={isDark ? 'text-neutral-300' : 'text-gray-600'}>
                {translate('quiz_first_complete_subtitle')}
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="text-5xl mb-3">🎓</div>
              <h3 className="text-xl font-bold">
                {translate('quiz_first_complete_badge')}
              </h3>
              <p className="text-sm opacity-90 mt-1">
                {translate('quiz_first_complete_badge_desc')}
              </p>
            </div>

            <button
              onClick={handleCloseCelebration}
              className="w-full px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              {translate('continue')}
            </button>
          </div>
        </div>
      )}

      {/* First Quiz Celebration for non-first quiz guests (simpler) */}
      {showFirstQuizCelebration && !user && !isFirstQuiz && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className={`rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 animate-in zoom-in duration-300 ${
            isDark ? 'bg-neutral-800' : 'bg-white'
          }`}>
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {translate('quiz_complete_title')}
              </h2>
              <p className={isDark ? 'text-neutral-300' : 'text-gray-600'}>
                {stats.score >= 70
                  ? translate('quiz_complete_good')
                  : translate('quiz_complete_keep_going')
                }
              </p>
            </div>

            <button
              onClick={handleCloseCelebration}
              className="w-full px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              {translate('continue')}
            </button>
          </div>
        </div>
      )}

      {/* Signup Modal for guests after celebration */}
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
                {translate('results_signup_modal_title')}
              </h2>
              <p className={isDark ? 'text-neutral-300' : 'text-gray-600'}>
                {translate('results_signup_modal_subtitle')}
              </p>
            </div>

            <div className={`rounded-2xl p-4 border ${
              isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-100'
            }`}>
              <p className={`text-sm ${isDark ? 'text-orange-300' : 'text-orange-800'}`}>
                {translate('results_signup_modal_benefit')}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => router.push('/auth/signup')}
                className="w-full px-6 py-4 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <Gift className="w-5 h-5" />
                {translate('results_signup_modal_cta')}
              </button>
              <button
                onClick={() => setShowSignupModal(false)}
                className={`w-full px-6 py-3 font-medium transition-colors ${
                  isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {translate('later')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component to display a group of questions
function QuestionGroup({
  title,
  questions,
  colorClass,
  bgClass,
  icon,
  isDark,
  showCorrectAnswer = false,
  translate,
}: {
  title: string;
  questions: QuestionResult[];
  colorClass: string;
  bgClass: string;
  icon: React.ReactNode;
  isDark: boolean;
  showCorrectAnswer?: boolean;
  translate: (key: string) => string;
}) {
  return (
    <div className={bgClass}>
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${isDark ? 'border-neutral-700' : 'border-gray-200'}`}>
        <span className={colorClass}>{icon}</span>
        <span className={`text-xs font-semibold ${colorClass}`}>{title}</span>
        <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>({questions.length})</span>
      </div>
      <div className={`divide-y ${isDark ? 'divide-neutral-700/30' : 'divide-gray-200/50'}`}>
        {questions.map((question, index) => (
          <div key={question.id} className="px-4 py-3">
            <p className={`text-sm mb-1 ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
              <span className={`font-medium ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Q{index + 1}:</span>{' '}
              {question.questionText.length > 80
                ? question.questionText.substring(0, 80) + '...'
                : question.questionText}
            </p>
            {showCorrectAnswer && (
              <div className="mt-1 space-y-0.5">
                <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                  {translate('quiz_your_answer')}: {question.userAnswer}
                </p>
                <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  {translate('quiz_correct_answer')}: {question.correctAnswer}
                </p>
              </div>
            )}
            {question.explanation && showCorrectAnswer && (
              <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                {question.explanation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
