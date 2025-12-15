'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, Lock, Play, RotateCcw, BookOpen, Layers, FileText } from 'lucide-react';
import Image from 'next/image';
import PageHeaderWithMascot from '@/components/layout/PageHeaderWithMascot';
import ChapterScoreBadge from '@/components/course/ChapterScoreBadge';
import PaywallModal from '@/components/course/PaywallModal';
import CourseLoadingProgress from '@/components/course/CourseLoadingProgress';
import FlashcardsView from '@/components/course/FlashcardsView';
import APlusNoteView from '@/components/course/APlusNoteView';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { trackEvent } from '@/lib/posthog';
import { loadDemoCourse } from '@/lib/demoCourse';
import { useCourseChapters } from '@/hooks/useCourseChapters';

interface Chapter {
  id: string;
  title: string;
  summary: string | null;
  difficulty: string | null;
  order_index: number;
  question_count: number;
  has_access: boolean;
  completed: boolean;
  in_progress: boolean;
  score: number | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
}

interface CourseData {
  id: string;
  title: string;
  status: string;
}

export default function CourseLearnPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { translate } = useLanguage();
  const courseId = params?.courseId as string;
  const isDemoId = courseId?.startsWith('demo-');

  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  // Get initial tab from URL or default to 'note' (Study Sheet first in learning flow)
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam === 'quiz' || tabParam === 'flashcards') ? tabParam : 'note';
  const [activeTab, setActiveTab] = useState<'quiz' | 'flashcards' | 'note'>(initialTab);

  // Update URL when tab changes (without full navigation)
  const handleTabChange = useCallback((tab: 'quiz' | 'flashcards' | 'note') => {
    setActiveTab(tab);
    const newUrl = tab === 'note'
      ? `/courses/${courseId}/learn`
      : `/courses/${courseId}/learn?tab=${tab}`;
    window.history.replaceState(null, '', newUrl);
  }, [courseId]);

  // Demo course state (separate from API-based courses)
  const [demoLoading, setDemoLoading] = useState(isDemoId);
  const [demoCourse, setDemoCourse] = useState<CourseData | null>(null);
  const [demoChapters, setDemoChapters] = useState<Chapter[]>([]);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Use the Realtime hook for API-based courses
  // Disabled for demo courses to avoid unnecessary API calls
  const {
    loading: apiLoading,
    course: apiCourse,
    chapters: apiChapters,
    accessTier: apiAccessTier,
    isPremium: apiIsPremium,
    isFreeMonthlyCourse: apiIsFreeMonthlyCourse,
    error: apiError,
    isPolling,
    isListening,
  } = useCourseChapters({
    courseId,
    enabled: !isDemoId, // Only enable for non-demo courses
    useRealtime: true, // Use Supabase Realtime for instant updates
  });

  // Load demo course data
  useEffect(() => {
    if (!isDemoId) return;

    setDemoLoading(true);
    setDemoError(null);

    const demo = loadDemoCourse(courseId);
    if (demo) {
      setDemoCourse({ id: demo.id, title: demo.title, status: 'ready' });
      setDemoChapters(
        demo.chapters.map((chapter, idx) => ({
          id: chapter.id,
          title: chapter.title,
          summary: chapter.summary,
          difficulty: idx === 0 ? 'easy' : idx === 1 ? 'medium' : 'hard',
          order_index: idx,
          question_count: chapter.questions.length,
          has_access: idx === 0,
          completed: false,
          in_progress: false,
          score: null,
          status: 'ready' as const,
        }))
      );
    } else {
      setDemoError('Course not found. Please upload again.');
    }

    setDemoLoading(false);
  }, [isDemoId, courseId]);

  // Track course view when data is loaded
  useEffect(() => {
    if (!isDemoId && apiCourse && !apiLoading) {
      trackEvent('course_viewed', { userId: user?.id, courseId });
    }
  }, [isDemoId, apiCourse, apiLoading, user?.id, courseId]);

  // Select the appropriate data source based on demo vs API
  const loading = isDemoId ? demoLoading : apiLoading;
  const course = isDemoId ? demoCourse : apiCourse;
  const chapters = isDemoId ? demoChapters : apiChapters;
  const accessTier = isDemoId ? null : apiAccessTier;
  const isPremium = isDemoId ? false : apiIsPremium;
  const isFreeMonthlyCourse = isDemoId ? false : apiIsFreeMonthlyCourse;
  const error = isDemoId ? demoError : apiError;

  // User has full access if they are premium OR viewing their free monthly course
  // In this case, we don't need to show "Free" or "Bonus" badges
  const hasFullAccess = isPremium || isFreeMonthlyCourse;

  // Check if at least one chapter is ready (has status 'ready' OR has questions for backwards compatibility)
  const hasReadyChapter = chapters.some(ch => ch.status === 'ready' || ch.question_count > 0);
  const isStillProcessing = course?.status === 'pending' || course?.status === 'processing';

  const handleChapterClick = (chapter: Chapter, index: number) => {
    // Chapter 1 is always accessible (even without account)
    if (index === 0) {
      router.push(`/courses/${courseId}/chapters/${chapter.id}`);
      return;
    }

    // For chapters 2+, user must be logged in
    if (!user && !isDemoId) {
      setShowSignupModal(true);
      return;
    }

    // If user has full access (premium OR free monthly course), all chapters are accessible
    if (hasFullAccess) {
      router.push(`/courses/${courseId}/chapters/${chapter.id}`);
      return;
    }

    // Otherwise, show paywall for chapters 2+
    setShowPaywallModal(true);
  };

  /**
   * Get the appropriate CTA text for a chapter based on its state
   * @param chapter - The chapter object with completion state
   * @param index - The chapter index (0-based)
   * @returns The translated CTA text
   */
  const getChapterCTA = (chapter: Chapter, index: number): string => {
    // Chapter 1 is always accessible
    if (index === 0) {
      if (chapter.completed) return translate('course_detail_cta_retake_quiz');
      if (chapter.in_progress) return translate('course_detail_cta_resume_quiz');
      return translate('course_detail_cta_start_quiz');
    }

    // For chapters 2+, if not logged in, show create account
    if (!user && !isDemoId) {
      return translate('course_detail_cta_create_account');
    }

    // If user has full access, show quiz state
    if (hasFullAccess) {
      if (chapter.completed) return translate('course_detail_cta_retake_quiz');
      if (chapter.in_progress) return translate('course_detail_cta_resume_quiz');
      return translate('course_detail_cta_start_quiz');
    }

    // No full access - show paywall CTA
    return translate('course_detail_cta_paywall');
  };

  const bannerCopy = useMemo(() => {
    if (course?.status === 'processing' || course?.status === 'pending') {
      return translate('course_detail_processing');
    }
    if (course?.status === 'failed') {
      return translate('course_detail_error');
    }
    return translate('course_detail_tagline');
  }, [course?.status, translate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Image
            src="/chat/mascotte.png"
            alt="Nareo"
            width={400}
            height={400}
            className="mx-auto mb-4 animate-bounce"
          />
          <p className="text-gray-600">{translate('loading')}</p>
        </div>
      </div>
    );
  }

  if (!course || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error || translate('course_detail_error')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <PageHeaderWithMascot
        title={course.title}
        subtitle={isDemoId ? 'Demo' : translate('learn_course_subtitle')}
        maxWidth="4xl"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {/* Tabs - Study Sheet / Quiz / Flashcards (logical learning order) */}
        <div className="flex gap-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-2">
          <button
            onClick={() => handleTabChange('note')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'note'
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">{translate('aplus_note_title')}</span>
          </button>
          <button
            onClick={() => handleTabChange('quiz')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'quiz'
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Quiz</span>
          </button>
          <button
            onClick={() => handleTabChange('flashcards')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'flashcards'
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Flashcards</span>
          </button>
        </div>

        {/* Processing progress - shown when course is pending/processing AND no chapter is ready yet */}
        {!isDemoId && isStillProcessing && !hasReadyChapter && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <CourseLoadingProgress
              courseStatus={course?.status || 'pending'}
              chaptersCount={chapters.length}
              courseTitle={course?.title}
            />
          </div>
        )}

        {/* Partial loading banner - shown when processing but at least one chapter is ready */}
        {!isDemoId && isStillProcessing && hasReadyChapter && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <p className="text-sm text-orange-700">
              {translate('course_loading_partial')}
            </p>
          </div>
        )}

        {/* Failed status banner */}
        {!isDemoId && course?.status === 'failed' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{translate('upload_processing_failed')}</p>
              <p className="text-xs text-red-700 mt-1">
                {translate('upload_processing_failed_desc')}
              </p>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'quiz' && (
          <>
            {/* Chapters list - show when ready OR when at least one chapter is ready during processing */}
            {!isDemoId && isStillProcessing && !hasReadyChapter ? null : chapters.length === 0 && (loading || isPolling || isListening) ? (
              // Skeleton placeholders while loading/polling (fallback)
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 sm:p-5 flex items-start gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-2xl bg-gray-200"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                    <div className="w-20 h-10 bg-gray-200 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : chapters.length === 0 ? (
              // No chapters and not loading
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No chapters available yet.</p>
              </div>
            ) : (
              // Chapters loaded - show list
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
                {chapters.map((chapter, index) => {
                  // Chapter is locked if: not chapter 1 AND (not logged in OR no full access)
                  const isLocked = index > 0 && (!user || !hasFullAccess) && !isDemoId;
                  // Check if chapter is ready (status is 'ready' OR has questions for backwards compatibility)
                  const isChapterReady = chapter.status === 'ready' || chapter.question_count > 0;
                  // Check if chapter is currently being processed
                  const isChapterProcessing = chapter.status === 'processing' || chapter.status === 'pending';
                  return (
                    <div
                      key={chapter.id}
                      className="p-3 sm:p-5 flex items-center gap-2.5 sm:gap-4 hover:bg-orange-50/40 transition-colors"
                    >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm sm:text-base flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
                          {chapter.title}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Free badge for chapter 1 - hidden when user has full access */}
                          {index === 0 && !hasFullAccess && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-green-100 text-green-700 text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                              {translate('course_detail_free_badge')}
                            </span>
                          )}
                          {/* Lock badge for chapters 2+ when user doesn't have full access */}
                          {isLocked && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] sm:text-xs font-semibold inline-flex items-center gap-0.5 sm:gap-1 whitespace-nowrap">
                              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              {translate('course_detail_locked_badge')}
                            </span>
                          )}
                          {isChapterProcessing && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-orange-100 text-orange-600 text-[10px] sm:text-xs font-semibold inline-flex items-center gap-0.5 sm:gap-1 whitespace-nowrap">
                              <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" />
                              {translate('chapter_preparing')}
                            </span>
                          )}
                          {chapter.status === 'failed' && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-red-100 text-red-600 text-[10px] sm:text-xs font-semibold inline-flex items-center gap-0.5 sm:gap-1 whitespace-nowrap">
                              <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              {translate('chapter_failed') || 'Erreur'}
                            </span>
                          )}
                        </div>
                      </div>
                      {chapter.summary && (
                        <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 mb-1 sm:mb-2">{chapter.summary}</p>
                      )}
                      <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-600">
                        <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-gray-100">
                          {chapter.question_count} {translate('chapter_questions')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 sm:gap-2 flex-shrink-0">
                      {chapter.score !== null && chapter.question_count > 0 && (
                        <>
                          {/* Mobile: compact score badge - same width as button */}
                          <div className="sm:hidden w-full">
                            <ChapterScoreBadge
                              scorePts={chapter.score}
                              maxPts={chapter.question_count * 10}
                              compact
                            />
                          </div>
                          {/* Desktop: full score badge */}
                          <div className="hidden sm:block">
                            <ChapterScoreBadge
                              scorePts={chapter.score}
                              maxPts={chapter.question_count * 10}
                            />
                          </div>
                        </>
                      )}
                      <button
                        onClick={() => handleChapterClick(chapter, index)}
                        disabled={!isChapterReady}
                        className={`inline-flex items-center justify-center gap-1 sm:gap-2 w-full sm:w-[180px] px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                          !isChapterReady
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isLocked
                            ? 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        {!isChapterReady ? (
                          <>
                            <span className="hidden sm:inline">{translate('chapter_preparing')}</span>
                            <span className="sm:hidden">{translate('chapter_preparing')}</span>
                            <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                          </>
                        ) : (
                          <>
                            <span className="hidden sm:inline">{getChapterCTA(chapter, index)}</span>
                            <span className="sm:hidden">{translate('quiz_start_short')}</span>
                            {chapter.completed ? (
                              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                            ) : (
                              <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                            )}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </>
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsView courseId={courseId} courseTitle={course.title} />
        )}

        {activeTab === 'note' && (
          <APlusNoteView courseId={courseId} courseTitle={course.title} />
        )}

      </main>

      {showSignupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {translate('course_detail_locked_paywall')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {translate('course_detail_lock_two')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignupModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
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

      {showPaywallModal && (
        <PaywallModal
          courseId={courseId}
          courseTitle={course?.title}
          onClose={() => setShowPaywallModal(false)}
        />
      )}
    </div>
  );
}
