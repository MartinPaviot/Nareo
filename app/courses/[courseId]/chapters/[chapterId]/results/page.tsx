'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowLeft, RotateCcw, Sparkles, Gift, X, Loader2, TrendingUp, TrendingDown, Minus, Star, Eye, XCircle, Home, ChevronLeft, ChevronRight, Filter, FileText } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import { useGamification } from '@/hooks/useGamification';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import { useCoursesOrganized } from '@/hooks/useCoursesOrganized';
import { trackEvent } from '@/lib/posthog';
import { saveAnonymousContext } from '@/lib/anonymous-session';
import { CourseSidebar, CourseBreadcrumb } from '@/components/Sidebar';
import TopBarActions from '@/components/layout/TopBarActions';

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
    name_es?: string;
    icon: string | null;
    rarity: string;
  };
}

interface ReviewOption {
  label: string;
  value: string;
  isSelected: boolean;
  isCorrect: boolean;
}

interface ReviewItem {
  index: number;
  question: string;
  student_answer: string;
  is_correct: boolean;
  correct_answer: string;
  explanation?: string;
  page_source?: string | null;
  question_type?: 'mcq' | 'open';
  options?: ReviewOption[];
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
  const { isDark } = useTheme();
  const { triggerRefresh } = useCoursesRefresh();
  const { recordActivity } = useGamification();

  const courseId = params?.courseId as string;
  const chapterId = params?.chapterId as string;
  const isDemoId = courseId?.startsWith('demo-');

  // Sidebar navigation state
  const sidebar = useSidebarNavigation();
  const { folders } = useCoursesOrganized();

  // Find the folder containing the current course (for breadcrumb)
  const currentCourseFolder = useMemo(() => {
    for (const folder of folders) {
      if (folder.courses.some((c) => c.id === courseId)) {
        return { id: folder.id, name: folder.name };
      }
    }
    return null;
  }, [folders, courseId]);

  const [newBadges, setNewBadges] = useState<BadgeEarned[]>([]);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [isFirstCourse, setIsFirstCourse] = useState(true);
  const [previousPercentage, setPreviousPercentage] = useState<number | null>(null);
  const [showReviewMode, setShowReviewMode] = useState(false);
  const [reviewCurrentIndex, setReviewCurrentIndex] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'errors'>('all');
  const [courseTitle, setCourseTitle] = useState('');

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
    if (currentLanguage === 'es') return badge.name_es || badge.name_en;
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

  // Fetch course title for breadcrumb
  useEffect(() => {
    const fetchCourseTitle = async () => {
      if (!courseId || isDemoId) return;
      try {
        const response = await fetch(`/api/courses/${courseId}`);
        if (response.ok) {
          const data = await response.json();
          setCourseTitle(data.course?.title || '');
        }
      } catch (error) {
        console.error('Error fetching course title:', error);
      }
    };
    fetchCourseTitle();
  }, [courseId, isDemoId]);

  // Handle folder click from breadcrumb - open sidebar to that folder's courses
  const handleBreadcrumbFolderClick = useCallback(() => {
    if (currentCourseFolder) {
      sidebar.openToFolder(currentCourseFolder.id, currentCourseFolder.name);
    }
  }, [currentCourseFolder, sidebar]);

  // Split review items into mastered and to-review
  const masteredItems = reviewItems.filter(item => item.is_correct);
  const toReviewItems = reviewItems.filter(item => !item.is_correct);

  return (
    <div className={`min-h-screen flex flex-col ${
      isDark ? 'bg-neutral-900' : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
    }`}>
      {/* Sidebar navigation */}
      {!isDemoId && user && (
        <CourseSidebar
          isOpen={sidebar.isOpen}
          level={sidebar.level}
          selectedFolderId={sidebar.selectedFolderId}
          selectedFolderName={sidebar.selectedFolderName}
          currentCourseId={courseId}
          onClose={sidebar.closeSidebar}
          onOpen={sidebar.openSidebar}
          onGoToFolderLevel={sidebar.goToFolderLevel}
          onGoToCourseLevel={sidebar.goToCourseLevel}
          disabled={showBadgeCelebration || showSignupModal || showReviewMode}
        />
      )}

      {/* Content wrapper - pushes right when sidebar is open */}
      <div
        className={`flex-1 flex flex-col transition-[margin] duration-300 ease-out ${
          !isDemoId && user
            ? sidebar.isOpen
              ? 'md:ml-[250px]'  /* Sidebar width when open */
              : 'md:ml-[72px]'   /* Toggle button width when closed */
            : ''
        }`}
      >
        {/* Header */}
        <header
          className={`border-b sticky top-0 z-30 h-[52px] relative ${
            isDark
              ? 'bg-neutral-900 border-neutral-800 before:bg-neutral-900'
              : 'bg-white border-gray-200 before:bg-white'
          } before:absolute before:top-0 before:right-full before:w-[250px] before:h-full before:hidden md:before:block`}
        >
          <div className="max-w-4xl mx-auto px-3 sm:px-4 h-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CourseBreadcrumb
                folderName={currentCourseFolder?.name || null}
                courseName={courseTitle}
                onFolderClick={handleBreadcrumbFolderClick}
              />
            </div>
            <div className="flex-shrink-0">
              <TopBarActions showDarkModeToggle />
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-3 flex-1 w-full">
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
          {/* Primary action buttons row */}
          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/courses/${courseId}/chapters/${chapterId}`)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-semibold shadow-md transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary }}
            >
              <RotateCcw className="w-4 h-4" />
              {translate('results_retry')}
            </button>

            {reviewItems.length > 0 && (
              <button
                onClick={() => setShowReviewMode(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-colors hover:opacity-90"
                style={{ borderColor: colors.primary, color: colors.primary, backgroundColor: colors.bg }}
              >
                <Eye className="w-4 h-4" />
                {translate('results_view_answers')}
              </button>
            )}
          </div>

          <button
            onClick={() => router.push(`/courses/${courseId}/learn?tab=quiz`)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium bg-white hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {translate('results_back_to_course')}
          </button>
        </div>

      {/* Review Answers Modal - Question by Question Navigation */}
      {showReviewMode && (() => {
        const filteredItems = reviewFilter === 'errors'
          ? reviewItems.filter(item => !item.is_correct)
          : reviewItems;
        const currentItem = filteredItems[reviewCurrentIndex];
        const errorCount = reviewItems.filter(item => !item.is_correct).length;

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in duration-300 flex flex-col">
              {/* Header with filter */}
              <div className="bg-white border-b border-gray-100 px-3 py-2">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-sm font-bold text-gray-900">
                    {translate('results_review_title')}
                  </h2>
                  <button
                    onClick={() => {
                      setShowReviewMode(false);
                      setReviewCurrentIndex(0);
                      setReviewFilter('all');
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* Filter toggle */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setReviewFilter('all');
                      setReviewCurrentIndex(0);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      reviewFilter === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {translate('results_review_filter_all')} ({reviewItems.length})
                  </button>
                  <button
                    onClick={() => {
                      setReviewFilter('errors');
                      setReviewCurrentIndex(0);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                      reviewFilter === 'errors'
                        ? 'bg-red-500 text-white'
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    }`}
                    disabled={errorCount === 0}
                  >
                    <Filter className="w-2.5 h-2.5" />
                    {translate('results_review_filter_errors')} ({errorCount})
                  </button>
                </div>
              </div>

              {/* Question content */}
              {currentItem ? (
                <div className="flex-1 overflow-y-auto px-3 py-2">
                  {/* Question number and status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        currentItem.is_correct ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {currentItem.is_correct ? (
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        ) : (
                          <XCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-xs font-medium text-gray-500">
                        {translate('results_review_question')} {currentItem.index}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {reviewCurrentIndex + 1} / {filteredItems.length}
                    </span>
                  </div>

                  {/* Question text */}
                  <p className="text-[13px] font-medium text-gray-900 mb-2.5">
                    {currentItem.question}
                  </p>

                  {/* MCQ Options Display */}
                  {currentItem.question_type === 'mcq' && currentItem.options && currentItem.options.length > 0 ? (
                    <div className="space-y-1 mb-2.5">
                      {currentItem.options.map((option) => {
                        const isSelected = option.isSelected;
                        const isCorrectOption = option.isCorrect;

                        let bgColor = 'bg-gray-50 border-gray-200';
                        let textColor = 'text-gray-600';
                        let labelBg = 'bg-gray-200 text-gray-600';

                        if (isCorrectOption) {
                          bgColor = 'bg-green-50 border-green-300';
                          textColor = 'text-green-800';
                          labelBg = 'bg-green-500 text-white';
                        } else if (isSelected && !isCorrectOption) {
                          bgColor = 'bg-red-50 border-red-300';
                          textColor = 'text-red-800';
                          labelBg = 'bg-red-500 text-white';
                        }

                        return (
                          <div
                            key={option.label}
                            className={`flex items-start gap-2 px-2 py-1.5 rounded-md border ${bgColor}`}
                          >
                            <span className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold ${labelBg}`}>
                              {option.label}
                            </span>
                            <span className={`text-[12px] leading-snug ${textColor}`}>
                              {option.value}
                            </span>
                            {isCorrectOption && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-auto flex-shrink-0" />
                            )}
                            {isSelected && !isCorrectOption && (
                              <XCircle className="w-3.5 h-3.5 text-red-500 ml-auto flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Open question - show student answer and correct answer */
                    <div className="space-y-1.5 mb-2.5">
                      <div className={`rounded-md px-2 py-1.5 ${
                        currentItem.is_correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                      }`}>
                        <span className={`text-[10px] font-medium ${
                          currentItem.is_correct ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {translate('results_review_your_answer')}
                        </span>
                        <p className={`text-[12px] mt-0.5 ${
                          currentItem.is_correct ? 'text-green-800' : 'text-red-800'
                        }`}>
                          {currentItem.student_answer || '-'}
                        </p>
                      </div>

                      {!currentItem.is_correct && (
                        <div className="rounded-md px-2 py-1.5 bg-green-50 border border-green-200">
                          <span className="text-[10px] font-medium text-green-600">
                            {translate('results_review_correct_answer')}
                          </span>
                          <p className="text-[12px] text-green-800 mt-0.5">
                            {currentItem.correct_answer}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation */}
                  {currentItem.explanation && (
                    <div className="rounded-md px-2 py-1.5 bg-blue-50 border border-blue-100 mb-2">
                      <span className="text-[10px] font-medium text-blue-600 block">
                        {translate('results_review_explanation')}
                      </span>
                      <p className="text-[11px] text-blue-700 leading-snug mt-0.5">
                        {currentItem.explanation}
                      </p>
                    </div>
                  )}

                  {/* Page source */}
                  {currentItem.page_source && (
                    <div className="rounded-md px-2 py-1.5 bg-amber-50 border border-amber-100">
                      <div className="flex items-center gap-1 mb-0.5">
                        <FileText className="w-3 h-3 text-amber-600" />
                        <span className="text-[10px] font-medium text-amber-600">
                          {translate('results_review_source')}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-700 italic leading-snug">
                        {currentItem.page_source}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-4">
                  <p className="text-gray-500 text-center text-sm">
                    {translate('results_review_no_errors')}
                  </p>
                </div>
              )}

              {/* Navigation footer */}
              <div className="bg-white border-t border-gray-100 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setReviewCurrentIndex(prev => Math.max(0, prev - 1))}
                    disabled={reviewCurrentIndex === 0}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    {translate('previous')}
                  </button>

                  {/* Progress dots */}
                  <div className="flex items-center gap-0.5 overflow-x-auto max-w-[180px]">
                    {filteredItems.map((item, idx) => (
                      <button
                        key={item.index}
                        onClick={() => setReviewCurrentIndex(idx)}
                        className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${
                          idx === reviewCurrentIndex
                            ? 'ring-[1.5px] ring-offset-1 ring-orange-500'
                            : ''
                        } ${
                          item.is_correct
                            ? 'bg-green-400'
                            : 'bg-red-400'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setReviewCurrentIndex(prev => Math.min(filteredItems.length - 1, prev + 1))}
                    disabled={reviewCurrentIndex >= filteredItems.length - 1}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    {translate('next')}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
        </main>
      </div>
    </div>
  );
}
