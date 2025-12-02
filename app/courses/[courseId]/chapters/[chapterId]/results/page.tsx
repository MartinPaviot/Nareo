'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, ArrowLeft, RotateCcw, Trophy, Sparkles, Gift, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/hooks/useGamification';
import { trackEvent } from '@/lib/posthog';

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

export default function QuizResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { translate, currentLanguage } = useLanguage();
  const { user } = useAuth();
  const { recordActivity } = useGamification();

  const [newBadges, setNewBadges] = useState<BadgeEarned[]>([]);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const courseId = params?.courseId as string;
  const chapterId = params?.chapterId as string;

  const score = parseInt(searchParams?.get('score') || '0');
  const total = parseInt(searchParams?.get('total') || '0');
  const correct = parseInt(searchParams?.get('correct') || '0');
  const totalQuestions = parseInt(searchParams?.get('totalQuestions') || '0');

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const isPerfectScore = percentage === 100;

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
  }, [user?.id, courseId, chapterId, score, total, percentage, correct, totalQuestions, recordActivity, user]);

  // Show signup modal for non-authenticated users after quiz completion
  useEffect(() => {
    if (!user) {
      // Small delay to let the results render first
      const timer = setTimeout(() => {
        setShowSignupModal(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Load review items from sessionStorage and fetch AI feedback
  useEffect(() => {
    let items: ReviewItem[] = [];

    try {
      const stored = sessionStorage.getItem(`quiz_review_${chapterId}`);
      if (stored) {
        items = JSON.parse(stored) as ReviewItem[];
        setReviewItems(items);
        // Clear after loading
        sessionStorage.removeItem(`quiz_review_${chapterId}`);
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
  }, [chapterId, user?.id, courseId, percentage, currentLanguage]);

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

  // Pedagogical feedback helpers
  const getFeedbackTier = () => {
    if (percentage <= 33) return 'low';
    if (percentage <= 66) return 'medium';
    return 'high';
  };

  const getFeedbackMascot = () => {
    const tier = getFeedbackTier();
    switch (tier) {
      case 'low': return '/chat/Disappointed.png';
      case 'medium': return '/chat/Drag_and_Drop.png';
      case 'high': return '/chat/Happy.png';
    }
  };

  const getFeedbackTitle = () => {
    const tier = getFeedbackTier();
    switch (tier) {
      case 'low': return translate('results_feedback_title_low');
      case 'medium': return translate('results_feedback_title_medium');
      case 'high': return translate('results_feedback_title_high');
    }
  };

  const getFeedbackSubtitle = () => {
    const tier = getFeedbackTier();
    switch (tier) {
      case 'low': return translate('results_feedback_subtitle_low');
      case 'medium': return translate('results_feedback_subtitle_medium');
      case 'high': return translate('results_feedback_subtitle_high');
    }
  };

  // Split review items into mastered and to-review
  const masteredItems = reviewItems.filter(item => item.is_correct);
  const toReviewItems = reviewItems.filter(item => !item.is_correct);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
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

              <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                <p className="text-sm text-orange-800">
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
                  className="w-full px-6 py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors"
                >
                  {translate('later')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Score Card */}
        <div className="bg-white rounded-3xl border border-gray-200 p-4 sm:p-8 shadow-lg space-y-4 sm:space-y-6">
          <div className="text-center space-y-1 sm:space-y-2">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
              {translate('results_title')}
            </h1>

            {/* Score percentage */}
            <div className="flex items-baseline justify-center gap-1 sm:gap-2">
              <span className="text-4xl sm:text-6xl font-bold text-orange-600">
                {percentage}
              </span>
              <span className="text-2xl sm:text-3xl font-semibold text-gray-400">%</span>
            </div>

            {isPerfectScore && (
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm sm:text-base">
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-semibold">Score Parfait !</span>
              </div>
            )}
          </div>

          {/* Score Points */}
          <div className="flex justify-center">
            <div className="bg-orange-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center min-w-[150px] sm:min-w-[200px]">
              <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">{translate('results_score')}</p>
              <p className="text-lg sm:text-2xl font-bold text-orange-600">
                {score} / {total}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500">{translate('learn_pts')}</p>
            </div>
          </div>

        </div>

        {/* Pedagogical Feedback Block */}
        {reviewItems.length > 0 && (
          <div
            className={`bg-white rounded-3xl border border-gray-200 p-4 sm:p-8 shadow-lg space-y-4 sm:space-y-6 transition-all duration-500 ${
              feedbackVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {/* Loading state for AI feedback */}
            {feedbackLoading ? (
              <div className="flex items-center justify-center py-6 sm:py-8">
                <div className="text-center space-y-2 sm:space-y-3">
                  <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500 animate-spin mx-auto" />
                  <p className="text-xs sm:text-sm text-gray-500">{translate('results_feedback_loading')}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Mascot + Message Header */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <Image
                    src={aiFeedback?.mascotte_humeur === 'disappointed' ? '/chat/Disappointed.png' :
                         aiFeedback?.mascotte_humeur === 'neutral' ? '/chat/Drag_and_Drop.png' :
                         aiFeedback?.mascotte_humeur === 'happy' ? '/chat/Happy.png' :
                         getFeedbackMascot() || '/chat/mascotte.png'}
                    alt="Nareo"
                    width={80}
                    height={80}
                    className="w-20 h-20 sm:w-20 sm:h-20 object-contain flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    {/* Mobile: single short phrase, Desktop: full text */}
                    <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-0.5 sm:mb-1">
                      <span className="sm:hidden">{getFeedbackTitle()}</span>
                      <span className="hidden sm:inline">{aiFeedback?.feedback_intro || getFeedbackTitle()}</span>
                    </h3>
                    <p className="text-gray-600 text-xs sm:text-sm hidden sm:block">
                      {!aiFeedback && getFeedbackSubtitle()}
                    </p>
                  </div>
                </div>

                {/* Two-column concept lists */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Mastered concepts */}
                  <div className="bg-green-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-green-100">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                      </div>
                      <h4 className="text-sm sm:text-base font-semibold text-green-800">
                        {translate('results_feedback_mastered')}
                      </h4>
                    </div>
                    {aiFeedback?.points_maitrises && aiFeedback.points_maitrises.length > 0 ? (
                      <ul className="space-y-2 sm:space-y-3">
                        {aiFeedback.points_maitrises.map((item, idx) => (
                          <li
                            key={idx}
                            className={`transition-all duration-300 ${
                              feedbackVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                            }`}
                            style={{ transitionDelay: `${150 + idx * 50}ms` }}
                          >
                            <p className="text-xs sm:text-sm font-medium text-green-800">{item.concept}</p>
                            <p className="text-[10px] sm:text-xs text-green-600 mt-0.5">{item.explication}</p>
                          </li>
                        ))}
                      </ul>
                    ) : masteredItems.length > 0 ? (
                      <ul className="space-y-1.5 sm:space-y-2">
                        {masteredItems.slice(0, 3).map((item, idx) => (
                          <li
                            key={item.index}
                            className={`text-xs sm:text-sm text-green-700 flex items-start gap-1.5 sm:gap-2 transition-all duration-300 ${
                              feedbackVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                            }`}
                            style={{ transitionDelay: `${150 + idx * 50}ms` }}
                          >
                            <span className="text-green-500 mt-0.5 flex-shrink-0">•</span>
                            <span>{item.question}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs sm:text-sm text-green-600 italic">
                        {translate('results_feedback_no_mastered')}
                      </p>
                    )}
                  </div>

                  {/* Concepts to review */}
                  <div className="bg-orange-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-orange-100">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                        <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
                      </div>
                      <h4 className="text-sm sm:text-base font-semibold text-orange-800">
                        {translate('results_feedback_to_review')}
                      </h4>
                    </div>
                    {aiFeedback?.points_a_revoir && aiFeedback.points_a_revoir.length > 0 ? (
                      <ul className="space-y-2 sm:space-y-3">
                        {aiFeedback.points_a_revoir.map((item, idx) => (
                          <li
                            key={idx}
                            className={`transition-all duration-300 ${
                              feedbackVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                            }`}
                            style={{ transitionDelay: `${150 + idx * 50}ms` }}
                          >
                            <p className="text-xs sm:text-sm font-medium text-orange-800">{item.concept}</p>
                            <p className="text-[10px] sm:text-xs text-orange-600 mt-0.5">{item.explication}</p>
                          </li>
                        ))}
                      </ul>
                    ) : toReviewItems.length > 0 ? (
                      <ul className="space-y-1.5 sm:space-y-2">
                        {toReviewItems.slice(0, 3).map((item, idx) => (
                          <li
                            key={item.index}
                            className={`text-xs sm:text-sm text-orange-700 flex items-start gap-1.5 sm:gap-2 transition-all duration-300 ${
                              feedbackVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                            }`}
                            style={{ transitionDelay: `${150 + idx * 50}ms` }}
                          >
                            <span className="text-orange-500 mt-0.5 flex-shrink-0">•</span>
                            <span>{item.question}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs sm:text-sm text-orange-600 italic">
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
        <div className="space-y-2 sm:space-y-3">
          <button
            onClick={() => router.push(`/courses/${courseId}/chapters/${chapterId}`)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl bg-orange-500 text-white text-sm sm:text-base font-semibold hover:bg-orange-600 shadow-md"
          >
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            {translate('results_retry')}
          </button>

          <button
            onClick={() => router.push(`/courses/${courseId}/learn`)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-xl border-2 border-orange-200 text-orange-700 text-sm sm:text-base font-semibold bg-white hover:bg-orange-50"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            {translate('results_back_to_course')}
          </button>
        </div>
      </div>
    </div>
  );
}
