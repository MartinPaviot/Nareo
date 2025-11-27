'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2, Lock, Play } from 'lucide-react';
import TopBarActions from '@/components/layout/TopBarActions';
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
}

interface CourseData {
  id: string;
  title: string;
  status: string;
}

export default function CourseLearnPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { translate } = useLanguage();
  const courseId = params?.courseId as string;
  const isDemoId = courseId?.startsWith('demo-');

  const [showSignupModal, setShowSignupModal] = useState(false);

  // Demo course state (separate from API-based courses)
  const [demoLoading, setDemoLoading] = useState(isDemoId);
  const [demoCourse, setDemoCourse] = useState<CourseData | null>(null);
  const [demoChapters, setDemoChapters] = useState<Chapter[]>([]);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Use the polling hook for API-based courses
  // Disabled for demo courses to avoid unnecessary API calls
  const {
    loading: apiLoading,
    course: apiCourse,
    chapters: apiChapters,
    accessTier: apiAccessTier,
    error: apiError,
    isPolling,
  } = useCourseChapters({
    courseId,
    enabled: !isDemoId, // Only enable for non-demo courses
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
  const error = isDemoId ? demoError : apiError;

  const handleChapterClick = (chapter: Chapter, index: number) => {
    if (index === 0) {
      router.push(`/courses/${courseId}/chapters/${chapter.id}`);
      return;
    }

    if (index === 1) {
      if (!user) {
        setShowSignupModal(true);
        return;
      }
      router.push(`/courses/${courseId}/chapters/${chapter.id}`);
      return;
    }

    if (index >= 2) {
      router.push(`/paywall?courseId=${courseId}`);
    }
  };

  const bannerCopy = useMemo(() => {
    if (course?.status === 'processing' || course?.status === 'pending') {
      return translate('course_detail_processing');
    }
    if (course?.status === 'failed') {
      return translate('course_detail_error');
    }
    return translate('course_detail_intro');
  }, [course?.status, translate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
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
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-orange-600 font-semibold">
              {isDemoId ? 'Demo' : translate('sidebar_chapters')}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <p className="text-sm text-gray-600 mt-1">{bannerCopy}</p>
          </div>
          <TopBarActions />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {/* Processing banner - shown when course is pending/processing OR when polling */}
        {!isDemoId && (course?.status === 'pending' || course?.status === 'processing' || (isPolling && chapters.length === 0)) && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 flex items-start gap-3">
            <Loader2 className="w-5 h-5 animate-spin mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{translate('course_detail_processing')}</p>
              <p className="text-xs text-orange-700 mt-1">
                {translate('upload_extracting')}
                {isPolling && ' • Checking for updates...'}
              </p>
            </div>
          </div>
        )}

        {/* Failed status banner */}
        {!isDemoId && course?.status === 'failed' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Processing Failed</p>
              <p className="text-xs text-red-700 mt-1">
                There was an error processing this course. Please try uploading again.
              </p>
            </div>
          </div>
        )}

        {/* Chapters list or skeleton loading state */}
        {chapters.length === 0 && (loading || isPolling) ? (
          // Skeleton placeholders while loading/polling
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
              const locked = index === 1 && !user && !isDemoId;
              const premiumLock = index >= 2;
              return (
                <div
                  key={chapter.id}
                  className="p-4 sm:p-5 flex items-start gap-4 hover:bg-orange-50/40 transition-colors"
                >
                <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-semibold">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-1">
                      {chapter.title}
                    </h3>
                    {index === 0 && (
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                        {translate('course_detail_free_badge')}
                      </span>
                    )}
                    {(locked || premiumLock) && (
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {translate('course_detail_locked_badge')}
                      </span>
                    )}
                  </div>
                  {chapter.summary && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{chapter.summary}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100">
                      {chapter.question_count} {translate('chapter_questions')}
                    </span>
                    {chapter.score !== null && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-semibold">
                        {chapter.score} {translate('learn_pts')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleChapterClick(chapter, index)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${
                    (locked || premiumLock) && !isDemoId
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  {index === 0
                    ? translate('course_detail_cta_play')
                    : premiumLock
                    ? translate('course_detail_cta_paywall')
                    : translate('course_detail_cta_create_account')}
                  <Play className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          </div>
        )}

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          {translate('course_detail_lock_two')} <br />
          {translate('course_detail_lock_three')}
        </div>
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
    </div>
  );
}
