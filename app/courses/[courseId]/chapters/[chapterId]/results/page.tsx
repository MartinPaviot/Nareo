'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowLeft, RotateCcw, Sparkles, Gift, X, Loader2, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import { useGamification } from '@/hooks/useGamification';
import { trackEvent } from '@/lib/posthog';
import { saveAnonymousContext } from '@/lib/anonymous-session';

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

interface BadgeEarned {
  id: string;
  badge: {
    code: string;
    name_fr: string;
    name_en: string;
    name_de: string;
    icon: string | null;
    rarity: string;
  };
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

// Color schemes based on score
const getScoreColors = (percentage: number) => {
  if (percentage < 40) {
    return { primary: '#F97316', secondary: '#FED7AA', bg: '#FFF7ED' };
  } else if (percentage <= 70) {
    return { primary: '#EAB308', secondary: '#FEF08A', bg: '#FEFCE8' };
  } else {
    return { primary: '#379f5a', secondary: '#b8dfc6', bg: '#edf7f1' };
  }
};

// Star calculation
const getStars = (percentage: number): number => {
  if (percentage >= 80) return 3;
  if (percentage >= 50) return 2;
  if (percentage >= 20) return 1;
  return 0;
};

// Encouraging messages based on score
const getEncouragingMessage = (percentage: number, translate: (key: string) => string): string => {
  if (percentage < 40) {
    return translate('results_message_low');
  } else if (percentage < 70) {
    return translate('results_message_medium');
  } else if (percentage < 90) {
    return translate('results_message_high');
  } else {
    return translate('results_message_perfect');
  }
};

// Circular Progress Component
const CircularProgress = ({
  percentage,
  score,
  total,
  colors,
  translate
}: {
  percentage: number;
  score: number;
  total: number;
  colors: { primary: string; secondary: string; bg: string };
  translate: (key: string) => string;
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
          {score}/{total} {translate('learn_pts')}
        </span>
      </div>
    </div>
  );
};

// Star Rating Component
const StarRating = ({
  earnedStars,
}: {
  earnedStars: number;
}) => {
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

// Progression Badge Component
const ProgressionBadge = ({
  currentPercentage,
  previousPercentage,
  colors,
  translate
}: {
  currentPercentage: number;
  previousPercentage: number | null;
  colors: { primary: string; secondary: string; bg: string };
  translate: (key: string) => string;
}) => {
  if (previousPercentage === null) return null;

  const diff = currentPercentage - previousPercentage;

  let Icon = Minus;
  let message = translate('results_same_score');

  if (diff > 0) {
    Icon = TrendingUp;
    message = `+${diff}% ${translate('results_vs_last')}`;
  } else if (diff < 0) {
    Icon = TrendingDown;
    message = `${diff}% ${translate('results_vs_last')}`;
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mt-2"
      style={{ backgroundColor: colors.bg, color: colors.primary }}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-medium">{message}</span>
    </div>
  );
};

export default function QuizResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { translate, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const { triggerRefresh } = useCoursesRefresh();
  const { recordActivity } = useGamification();

  const [newBadges, setNewBadges] = useState<BadgeEarned[]>([]);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [isFirstCourse, setIsFirstCourse] = useState(true);
  const [previousPercentage, setPreviousPercentage] = useState<number | null>(null);

  const courseId = params?.courseId as string;
  const chapterId = params?.chapterId as string;

  const score = parseInt(searchParams?.get('score') || '0');
  const total = parseInt(searchParams?.get('total') || '0');
  const correct = parseInt(searchParams?.get('correct') || '0');
  const totalQuestions = parseInt(searchParams?.get('totalQuestions') || '0');

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const colors = getScoreColors(percentage);
  const earnedStars = getStars(percentage);

  // Fetch previous attempt score
  useEffect(() => {
    const fetchPreviousAttempt = async () => {
      if (!user || !chapterId) return;

      try {
        const response = await fetch(`/api/quiz-attempts/previous?chapterId=${chapterId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.previousScore !== null && data.previousTotal) {
            setPreviousPercentage(Math.round((data.previousScore / data.previousTotal) * 100));
          }
        }
      } catch (error) {
        console.error('Error fetching previous attempt:', error);
      }
    };

    fetchPreviousAttempt();
  }, [user, chapterId]);

  // Save quiz attempt and record activity
  useEffect(() => {
    const saveAndRecordQuizCompletion = async () => {
      // Save quiz attempt to database (for logged-in users)
      if (user) {
        try {
          await fetch('/api/quiz-attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chapterId,
              courseId,
              score,
              completed: true,
            }),
          });
        } catch (error) {
          console.error('Error saving quiz attempt:', error);
        }

        // Record activity for badges
        const badges = await recordActivity({
          quizzes_completed: 1,
          questions_answered: totalQuestions,
          questions_correct: correct,
          points_earned: score,
        });

        if (badges.length > 0) {
          setNewBadges(badges);
          setShowBadgeCelebration(true);
        }

        // Trigger refresh of course cards on dashboard
        triggerRefresh();
      }
    };

    saveAndRecordQuizCompletion();
    trackEvent('quiz_results_viewed', {
      userId: user?.id,
      courseId,
      chapterId,
      score,
      total,
      percentage,
    });
  }, [user?.id, courseId, chapterId, score, total, percentage, correct, totalQuestions, recordActivity, user, triggerRefresh]);

  // Show signup modal for non-authenticated users after quiz completion
  // Also save context so they can resume after signup
  useEffect(() => {
    if (!user) {
      // Save the current context so user can resume after signup
      saveAnonymousContext({
        returnPath: `/courses/${courseId}/chapters/${chapterId}/results?score=${score}&total=${total}&correct=${correct}&totalQuestions=${totalQuestions}`,
        courseId,
        chapterId,
        quizResults: {
          score,
          total,
          correct,
          totalQuestions,
          percentage,
        },
      });

      // Check if this is the first course for the guest user
      const checkFirstCourse = async () => {
        try {
          const response = await fetch('/api/courses/guest-count');
          if (response.ok) {
            const data = await response.json();
            // If guest has more than 1 course, it's not their first
            setIsFirstCourse(data.count <= 1);
          }
        } catch (error) {
          console.error('Error checking guest course count:', error);
        }
      };
      checkFirstCourse();

      // Small delay to let the results render first
      const timer = setTimeout(() => {
        setShowSignupModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user, courseId, chapterId, score, total, correct, totalQuestions, percentage]);

  // Load review items from sessionStorage and fetch AI feedback
  useEffect(() => {
    let items: ReviewItem[] = [];

    try {
      const stored = sessionStorage.getItem(`quiz_review_${chapterId}`);
      if (stored) {
        items = JSON.parse(stored) as ReviewItem[];
        setReviewItems(items);
        // Only clear for logged-in users - anonymous users need it preserved for post-signup
        if (user) {
          sessionStorage.removeItem(`quiz_review_${chapterId}`);
        }
      }
    } catch (e) {
      console.error('Failed to load review items:', e);
    }

    // Fetch AI-based concept feedback if we have review items
    const fetchAIFeedback = async () => {
      if (items.length === 0) return;

      setFeedbackLoading(true);
      try {
        const response = await fetch('/api/quiz-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewItems: items,
            percentage,
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

    // Trigger fade-in animation after a short delay
    const timer = setTimeout(() => {
      setFeedbackVisible(true);
      trackEvent('quiz_feedback_shown', {
        userId: user?.id,
        courseId,
        chapterId,
        percentage,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [chapterId, user, courseId, percentage, currentLanguage]);

  const getBadgeName = (badge: BadgeEarned['badge']) => {
    if (currentLanguage === 'fr') return badge.name_fr;
    if (currentLanguage === 'de') return badge.name_de;
    return badge.name_en;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'from-purple-500 to-pink-500';
      case 'epic': return 'from-purple-400 to-indigo-400';
      case 'rare': return 'from-blue-400 to-cyan-400';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  // Get mascot image based on score
  const getMascotImage = () => {
    if (aiFeedback?.mascotte_humeur === 'disappointed') return '/chat/Disappointed.png';
    if (aiFeedback?.mascotte_humeur === 'neutral') return '/chat/Drag_and_Drop.png';
    if (aiFeedback?.mascotte_humeur === 'happy') return '/chat/Happy.png';

    if (percentage < 40) return '/chat/Disappointed.png';
    if (percentage < 70) return '/chat/Drag_and_Drop.png';
    return '/chat/Happy.png';
  };

  // Split review items into mastered and to-review
  const masteredItems = reviewItems.filter(item => item.is_correct);
  const toReviewItems = reviewItems.filter(item => !item.is_correct);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-3 sm:p-4">
      <div className="max-w-2xl mx-auto space-y-3">
        {/* Badge Celebration Modal */}
        {showBadgeCelebration && newBadges.length > 0 && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 animate-in zoom-in duration-300">
              <div className="flex justify-center">
                <Sparkles className="w-20 h-20 text-yellow-500 animate-pulse" />
              </div>

              <h2 className="text-3xl font-bold text-gray-900">
                {translate('mascot_new_badge')}
              </h2>

              <div className="space-y-4">
                {newBadges.map((badgeEarned) => (
                  <div
                    key={badgeEarned.id}
                    className={`bg-gradient-to-br ${getRarityColor(badgeEarned.badge.rarity)} rounded-2xl p-6 text-white shadow-lg`}
                  >
                    <div className="text-6xl mb-3">{badgeEarned.badge.icon || '🏆'}</div>
                    <h3 className="text-xl font-bold">{getBadgeName(badgeEarned.badge)}</h3>
                    <p className="text-sm opacity-90 mt-1 capitalize">{badgeEarned.badge.rarity}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowBadgeCelebration(false)}
                className="w-full px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
              >
                {translate('close')}
              </button>
            </div>
          </div>
        )}

        {/* Signup Incentive Modal for non-authenticated users */}
        {showSignupModal && !user && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-6 animate-in zoom-in duration-300 relative">
              <button
                onClick={() => setShowSignupModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                  <Gift className="w-10 h-10 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {translate('results_signup_modal_title')}
                </h2>
                <p className="text-gray-600">
                  {translate('results_signup_modal_subtitle')}
                </p>
              </div>

              {!isFirstCourse && (
                <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                  <p className="text-sm text-orange-800">
                    {translate('results_signup_modal_benefit')}
                  </p>
                </div>
              )}

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
                  className="w-full px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  {translate('later')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Score Card with Circular Progress */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-lg">
          <h1 className="text-lg font-bold text-gray-900 text-center mb-3">
            {translate('results_title')}
          </h1>

          {/* Circular Progress Gauge */}
          <CircularProgress
            percentage={percentage}
            score={score}
            total={total}
            colors={colors}
            translate={translate}
          />

          {/* Star Rating */}
          <StarRating earnedStars={earnedStars} />

          {/* Progression Badge (if retake) */}
          <div className="flex justify-center">
            <ProgressionBadge
              currentPercentage={percentage}
              previousPercentage={previousPercentage}
              colors={colors}
              translate={translate}
            />
          </div>
        </div>

        {/* Mascot Message Section */}
        <div
          className="rounded-xl p-3 border"
          style={{ backgroundColor: colors.bg, borderColor: colors.secondary }}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 flex items-center justify-center">
              <Image
                src={getMascotImage()}
                alt="Nareo"
                width={96}
                height={96}
                className="w-12 h-12 object-contain"
              />
            </div>
            <p className="text-sm font-medium leading-snug" style={{ color: colors.primary }}>
              {aiFeedback?.feedback_intro || getEncouragingMessage(percentage, translate)}
            </p>
          </div>
        </div>

        {/* Pedagogical Feedback Block */}
        {reviewItems.length > 0 && (
          <div
            className={`bg-white rounded-2xl border border-gray-200 p-3 shadow-lg transition-all duration-500 ${
              feedbackVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {/* Loading state for AI feedback */}
            {feedbackLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="text-center space-y-2">
                  <Loader2 className="w-5 h-5 text-orange-500 animate-spin mx-auto" />
                  <p className="text-xs text-gray-500">{translate('results_feedback_loading')}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Two-column concept lists */}
                <div className="grid grid-cols-2 gap-3 items-stretch">
                  {/* Mastered concepts */}
                  <div className="rounded-xl p-3 border h-full" style={{ backgroundColor: '#edf7f1', borderColor: '#b8dfc6' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#379f5a' }}>
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                      <h4 className="text-sm font-semibold" style={{ color: '#256838' }}>
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
                            <p className="text-xs font-medium" style={{ color: '#256838' }}>{item.concept}</p>
                            <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: '#2d8049' }}>{item.explication}</p>
                          </li>
                        ))}
                      </ul>
                    ) : masteredItems.length > 0 ? (
                      <ul className="space-y-1">
                        {masteredItems.slice(0, 3).map((item, idx) => (
                          <li
                            key={item.index}
                            className={`text-xs flex items-start gap-1.5 transition-all duration-300 ${
                              feedbackVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                            }`}
                            style={{ transitionDelay: `${150 + idx * 50}ms`, color: '#2d8049' }}
                          >
                            <span className="mt-0.5 flex-shrink-0" style={{ color: '#379f5a' }}>•</span>
                            <span className="line-clamp-2">{item.question}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs italic" style={{ color: '#2d8049' }}>
                        {translate('results_feedback_no_mastered')}
                      </p>
                    )}
                  </div>

                  {/* Concepts to review */}
                  <div className="bg-orange-50 rounded-xl p-3 border border-orange-100 h-full">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-5 h-5 rounded-full bg-orange-400 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">!</span>
                      </div>
                      <h4 className="text-sm font-semibold text-orange-800">
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
                            <p className="text-xs font-medium text-orange-800">{item.concept}</p>
                            <p className="text-[10px] text-orange-600 mt-0.5 line-clamp-2">{item.explication}</p>
                          </li>
                        ))}
                      </ul>
                    ) : toReviewItems.length > 0 ? (
                      <ul className="space-y-1">
                        {toReviewItems.slice(0, 3).map((item, idx) => (
                          <li
                            key={item.index}
                            className={`text-xs text-orange-700 flex items-start gap-1.5 transition-all duration-300 ${
                              feedbackVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                            }`}
                            style={{ transitionDelay: `${150 + idx * 50}ms` }}
                          >
                            <span className="text-orange-500 mt-0.5 flex-shrink-0">•</span>
                            <span className="line-clamp-2">{item.question}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-orange-600 italic">
                        {translate('results_feedback_all_mastered')}
                      </p>
                    )}
                  </div>
                </div>

              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => router.push(`/courses/${courseId}/chapters/${chapterId}`)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold shadow-md transition-colors hover:opacity-90"
            style={{ backgroundColor: colors.primary }}
          >
            <RotateCcw className="w-4 h-4" />
            {translate('results_retry')}
          </button>

          <button
            onClick={() => router.push(`/courses/${courseId}/learn?tab=quiz`)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium bg-white hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {translate('results_back_to_course')}
          </button>
        </div>
      </div>
    </div>
  );
}
