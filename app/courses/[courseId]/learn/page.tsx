'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, Lock, Play, RotateCcw, BookOpen, Layers, FileText, Sparkles, RefreshCw } from 'lucide-react';
import GenerationLoadingScreen from '@/components/course/GenerationLoadingScreen';
import Image from 'next/image';
import PageHeaderWithMascot from '@/components/layout/PageHeaderWithMascot';
import ChapterScoreBadge from '@/components/course/ChapterScoreBadge';
import PaywallModal from '@/components/course/PaywallModal';
import FlashcardsView from '@/components/course/FlashcardsView';
import APlusNoteView from '@/components/course/APlusNoteView';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
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
  quiz_status?: 'pending' | 'generating' | 'ready' | 'partial' | 'failed';
}

export default function CourseLearnPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { translate } = useLanguage();
  const { isDark } = useTheme();
  const courseId = params?.courseId as string;
  const isDemoId = courseId?.startsWith('demo-');

  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizGenerationError, setQuizGenerationError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<{
    stage: string;
    elapsed_seconds: number | null;
    last_update_seconds: number | null;
    error_message: string | null;
  } | null>(null);

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
    refetch,
  } = useCourseChapters({
    courseId,
    enabled: !isDemoId, // Only enable for non-demo courses
    useRealtime: true, // Use Supabase Realtime for instant updates
  });

  // Function to generate quiz on demand
  const handleGenerateQuiz = useCallback(async () => {
    if (isGeneratingQuiz || !courseId || isDemoId) return;

    setIsGeneratingQuiz(true);
    setQuizGenerationError(null);

    try {
      const response = await fetch(`/api/courses/${courseId}/quiz/generate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to generate quiz');
      }

      // Refetch course data to get updated quiz_status
      await refetch();
      trackEvent('quiz_generated', { userId: user?.id, courseId });
    } catch (err) {
      console.error('Error generating quiz:', err);
      setQuizGenerationError(err instanceof Error ? err.message : 'Failed to generate quiz');
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [courseId, isDemoId, isGeneratingQuiz, refetch, user?.id]);

  // Function to retry processing a stuck course
  const handleRetryProcessing = useCallback(async () => {
    if (isRetrying || !courseId || isDemoId) return;

    setIsRetrying(true);
    setRetryError(null);

    try {
      // First, try to fix the status if chapters already exist (course stuck at 'processing')
      if (apiChapters.length > 0) {
        console.log('Attempting to fix stuck course status (has chapters)');
        const fixResponse = await fetch(`/api/courses/${courseId}/status`, {
          method: 'POST',
        });

        if (fixResponse.ok) {
          const fixData = await fixResponse.json();
          if (fixData.success) {
            console.log('Course status fixed successfully:', fixData);
            await refetch();
            trackEvent('course_status_fixed', { userId: user?.id, courseId });
            return; // Success, no need to retry full pipeline
          }
        }
      }

      // If no chapters or fix didn't work, retry full pipeline
      const response = await fetch(`/api/courses/${courseId}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to retry processing');
      }

      // Reset processing start time
      setProcessingStartTime(Date.now());
      // Refetch course data to get updated status
      await refetch();
      trackEvent('course_retry', { userId: user?.id, courseId });
    } catch (err) {
      console.error('Error retrying processing:', err);
      setRetryError(err instanceof Error ? err.message : 'Failed to retry processing');
    } finally {
      setIsRetrying(false);
    }
  }, [courseId, isDemoId, isRetrying, refetch, user?.id, apiChapters.length]);

  // Track processing start time to detect stuck courses
  useEffect(() => {
    if (!isDemoId && apiCourse && (apiCourse.status === 'pending' || apiCourse.status === 'processing')) {
      if (!processingStartTime) {
        setProcessingStartTime(Date.now());
      }
    } else if (apiCourse?.status === 'ready' || apiCourse?.status === 'failed') {
      setProcessingStartTime(null);
    }
  }, [isDemoId, apiCourse?.status, processingStartTime]);

  // State to track if course is stuck (updates every 10 seconds)
  const [isStuck, setIsStuck] = useState(false);

  // Update isStuck every 10 seconds while processing
  useEffect(() => {
    if (!processingStartTime) {
      setIsStuck(false);
      return;
    }
    if (!apiCourse || (apiCourse.status !== 'pending' && apiCourse.status !== 'processing')) {
      setIsStuck(false);
      return;
    }

    // Check immediately
    const checkStuck = () => {
      const elapsedMs = Date.now() - processingStartTime;
      // Consider stuck if:
      // - Processing for > 30 seconds AND still has 0 chapters
      // - OR processing for > 2 minutes regardless
      const hasNoChapters = apiChapters.length === 0;
      const stuck = (elapsedMs > 30 * 1000 && hasNoChapters) || elapsedMs > 2 * 60 * 1000;
      setIsStuck(stuck);
    };
    checkStuck();

    // Then check every 10 seconds
    const interval = setInterval(checkStuck, 10000);

    return () => clearInterval(interval);
  }, [processingStartTime, apiCourse?.status, apiChapters.length]);

  // Fetch detailed job status while processing
  useEffect(() => {
    if (isDemoId || !courseId) return;
    if (!apiCourse || (apiCourse.status !== 'pending' && apiCourse.status !== 'processing')) {
      setJobStatus(null);
      return;
    }

    const fetchJobStatus = async () => {
      try {
        const response = await fetch(`/api/courses/${courseId}/status`);
        if (response.ok) {
          const data = await response.json();
          if (data.job) {
            setJobStatus({
              stage: data.job.stage,
              elapsed_seconds: data.job.elapsed_seconds,
              last_update_seconds: data.job.last_update_seconds,
              error_message: data.job.error_message || data.course.error_message,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching job status:', err);
      }
    };

    // Fetch immediately
    fetchJobStatus();

    // Then fetch every 5 seconds
    const interval = setInterval(fetchJobStatus, 5000);

    return () => clearInterval(interval);
  }, [isDemoId, courseId, apiCourse?.status]);

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

  // Debug log for course status
  useEffect(() => {
    if (course) {
      console.log('[DEBUG] Course status:', {
        status: course.status,
        quiz_status: course.quiz_status,
        chapters_count: chapters.length,
        isStuck,
        processingTime: processingStartTime ? `${Math.round((Date.now() - processingStartTime) / 1000)}s` : null,
        jobStage: jobStatus?.stage || null,
      });
    }
  }, [course, chapters.length, isStuck, processingStartTime, jobStatus?.stage]);


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
    <div className={`min-h-screen transition-colors ${
      isDark
        ? 'bg-neutral-900'
        : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
    }`}>
      <PageHeaderWithMascot
        title={course.title}
        subtitle={isDemoId ? 'Demo' : translate('learn_course_subtitle')}
        maxWidth="4xl"
        showDarkModeToggle
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {/* Tabs - Study Sheet / Quiz / Flashcards (logical learning order) */}
        <div className={`flex gap-2 rounded-2xl border shadow-sm p-2 transition-colors ${
          isDark
            ? 'bg-neutral-900 border-neutral-800'
            : 'bg-white border-gray-200'
        }`}>
          <button
            onClick={() => handleTabChange('note')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'note'
                ? 'bg-orange-500 text-white'
                : isDark
                  ? 'text-neutral-400 hover:bg-neutral-800 hover:text-orange-400'
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
                : isDark
                  ? 'text-neutral-400 hover:bg-neutral-800 hover:text-orange-400'
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
                : isDark
                  ? 'text-neutral-400 hover:bg-neutral-800 hover:text-orange-400'
                  : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Flashcards</span>
          </button>
        </div>

        {/* Failed status banner - only show if course upload failed completely */}
        {!isDemoId && course?.status === 'failed' && (
          <div className={`rounded-2xl border p-4 text-sm flex items-start gap-3 ${
            isDark ? 'border-red-500/30 bg-red-500/20 text-red-300' : 'border-red-200 bg-red-50 text-red-800'
          }`}>
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">{translate('upload_processing_failed')}</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
                {translate('upload_processing_failed_desc')}
              </p>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'quiz' && (
          <>
            {/* Course still processing (text extraction) - show waiting message with retry option */}
            {!isDemoId && (course?.status === 'pending' || course?.status === 'processing') && (
              <div className={`rounded-2xl border shadow-sm p-6 sm:p-8 text-center transition-colors ${
                isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
              }`}>
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                  isDark ? 'bg-orange-500/20' : 'bg-orange-100'
                }`}>
                  {isStuck ? (
                    <AlertCircle className={`w-8 h-8 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                  ) : (
                    <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                  )}
                </div>
                <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                  {isStuck
                    ? (translate('quiz_stuck_title') || 'Le traitement semble bloqué')
                    : (translate('quiz_extracting_title') || 'Extraction du cours en cours...')}
                </h3>
                <p className={`text-sm max-w-md mx-auto ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                  {isStuck
                    ? (translate('quiz_stuck_description') || 'Le traitement prend plus de temps que prévu. Tu peux réessayer.')
                    : (translate('quiz_extracting_description') || 'Le quiz sera disponible une fois l\'extraction terminée.')}
                </p>
                {/* Debug: Job status details */}
                {jobStatus && (
                  <div className={`mt-4 p-3 rounded-xl text-xs font-mono ${
                    isDark ? 'bg-neutral-800 text-neutral-300' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <div>Étape: <span className="font-bold">{jobStatus.stage || 'inconnue'}</span></div>
                    {jobStatus.elapsed_seconds !== null && (
                      <div>Temps écoulé: {Math.floor(jobStatus.elapsed_seconds / 60)}m {jobStatus.elapsed_seconds % 60}s</div>
                    )}
                    {jobStatus.last_update_seconds !== null && (
                      <div>Dernière MAJ: il y a {jobStatus.last_update_seconds}s</div>
                    )}
                    {jobStatus.error_message && (
                      <div className="text-red-500 mt-1">Erreur: {jobStatus.error_message}</div>
                    )}
                  </div>
                )}
                {isStuck && (
                  <div className="mt-6">
                    {retryError && (
                      <div className={`mb-4 p-3 rounded-xl text-sm ${
                        isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
                      }`}>
                        {retryError}
                      </div>
                    )}
                    <button
                      onClick={handleRetryProcessing}
                      disabled={isRetrying}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {translate('retrying') || 'Relance en cours...'}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-5 h-5" />
                          {translate('retry_processing') || 'Réessayer'}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quiz not generated yet - show generate button */}
            {!isDemoId && course?.status === 'ready' && course?.quiz_status !== 'ready' && course?.quiz_status !== 'generating' && course?.quiz_status !== 'partial' && (
              <div className={`rounded-2xl border shadow-sm p-6 sm:p-8 text-center transition-colors ${
                isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
              }`}>
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                  isDark ? 'bg-orange-500/20' : 'bg-orange-100'
                }`}>
                  <Sparkles className={`w-8 h-8 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                </div>
                <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                  {translate('quiz_generate_title') || 'Prêt à tester tes connaissances ?'}
                </h3>
                <p className={`text-sm mb-6 max-w-md mx-auto ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                  {translate('quiz_generate_description') || 'Génère un quiz personnalisé basé sur ton cours pour réviser efficacement.'}
                </p>
                {quizGenerationError && (
                  <div className={`mb-4 p-3 rounded-xl text-sm ${
                    isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
                  }`}>
                    {quizGenerationError}
                  </div>
                )}
                <button
                  onClick={handleGenerateQuiz}
                  disabled={isGeneratingQuiz}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
                >
                  {isGeneratingQuiz ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {translate('quiz_generating') || 'Génération en cours...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {translate('quiz_generate_button') || 'Générer le Quiz'}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Quiz generating - show progress with mascot rotation */}
            {!isDemoId && course?.quiz_status === 'generating' && (
              <GenerationLoadingScreen type="quiz" />
            )}

            {/* Chapters list - show when quiz is ready OR partial */}
            {(isDemoId || course?.quiz_status === 'ready' || course?.quiz_status === 'partial') && (
              <>
                {chapters.length === 0 ? (
              // No chapters available
              <div className={`rounded-2xl border shadow-sm p-8 text-center transition-colors ${
                isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-gray-200'
              }`}>
                <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`} />
                <p className={isDark ? 'text-neutral-400' : 'text-gray-600'}>{translate('no_chapters_available') || 'Aucun chapitre disponible.'}</p>
              </div>
            ) : (
              // Chapters loaded - show list
              <div className={`rounded-2xl border shadow-sm divide-y transition-colors ${
                isDark ? 'bg-neutral-900 border-neutral-800 divide-neutral-800' : 'bg-white border-gray-200 divide-gray-100'
              }`}>
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
                      className={`p-3 sm:p-5 flex items-center gap-2.5 sm:gap-4 transition-colors ${
                        isDark ? 'hover:bg-neutral-800/50' : 'hover:bg-orange-50/40'
                      }`}
                    >
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center font-semibold text-sm sm:text-base flex-shrink-0 ${
                      isDark ? 'bg-orange-400/15 text-orange-300' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <h3 className={`text-sm sm:text-lg font-semibold truncate ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
                          {chapter.title}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Free badge for chapter 1 - hidden when user has full access */}
                          {index === 0 && !hasFullAccess && (
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                              isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                            }`}>
                              {translate('course_detail_free_badge')}
                            </span>
                          )}
                          {/* Lock badge for chapters 2+ when user doesn't have full access */}
                          {isLocked && (
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold inline-flex items-center gap-0.5 sm:gap-1 whitespace-nowrap ${
                              isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-gray-100 text-gray-600'
                            }`}>
                              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              {translate('course_detail_locked_badge')}
                            </span>
                          )}
                          {isChapterProcessing && (
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold inline-flex items-center gap-0.5 sm:gap-1 whitespace-nowrap ${
                              isDark ? 'bg-orange-400/15 text-orange-300' : 'bg-orange-100 text-orange-600'
                            }`}>
                              <Loader2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" />
                              {translate('chapter_preparing')}
                            </span>
                          )}
                          {chapter.status === 'failed' && (
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold inline-flex items-center gap-0.5 sm:gap-1 whitespace-nowrap ${
                              isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
                            }`}>
                              <AlertCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              {translate('chapter_failed') || 'Erreur'}
                            </span>
                          )}
                        </div>
                      </div>
                      {chapter.summary && (
                        <p className={`text-xs sm:text-sm line-clamp-2 mb-1 sm:mb-2 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>{chapter.summary}</p>
                      )}
                      <div className={`flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs ${isDark ? 'text-neutral-500' : 'text-gray-600'}`}>
                        <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                          isDark ? 'bg-neutral-800' : 'bg-gray-100'
                        }`}>
                          {chapter.question_count} {translate('chapter_questions')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      {chapter.score !== null && chapter.question_count > 0 && (
                        <>
                          {/* Mobile: compact score badge */}
                          <div className="sm:hidden">
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
                            ? isDark ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isLocked
                            ? isDark ? 'bg-neutral-800 text-neutral-400 hover:bg-orange-500/20 hover:text-orange-400' : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600'
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
          </>
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsView
            courseId={courseId}
            courseTitle={course.title}
            courseStatus={course.status}
          />
        )}

        {activeTab === 'note' && (
          <APlusNoteView
            courseId={courseId}
            courseTitle={course.title}
            courseStatus={course.status}
          />
        )}

      </main>

      {showSignupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className={`rounded-2xl max-w-md w-full p-6 shadow-xl ${
            isDark ? 'bg-neutral-900 border border-neutral-800' : 'bg-white'
          }`}>
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-neutral-50' : 'text-gray-900'}`}>
              {translate('course_detail_locked_paywall')}
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
              {translate('course_detail_lock_two')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSignupModal(false)}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-colors ${
                  isDark ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
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
