'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, BookOpen, Layers, FileText, RefreshCw } from 'lucide-react';
import GenerationLoadingScreen from '@/components/course/GenerationLoadingScreen';
import ExtractionLoader from '@/components/course/ExtractionLoader';
import Image from 'next/image';
import TopBarActions from '@/components/layout/TopBarActions';
import { CourseSidebar, CourseBreadcrumb } from '@/components/Sidebar';
import ChapterScoreBadge from '@/components/course/ChapterScoreBadge';
import PaywallModal from '@/components/course/PaywallModal';
import FlashcardsView from '@/components/course/FlashcardsView';
import APlusNoteView from '@/components/course/APlusNoteView';
import QuizPersonnalisationScreen from '@/components/course/QuizPersonnalisationScreen';
import QuizChapterManagement from '@/components/course/QuizChapterManagement';
import { StreamingQuestion } from '@/components/course/ProgressiveQuizView';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import { trackEvent } from '@/lib/posthog';
import { loadDemoCourse } from '@/lib/demoCourse';
import { useCourseChapters } from '@/hooks/useCourseChapters';
import { useSidebarNavigation } from '@/hooks/useSidebarNavigation';
import { useCoursesOrganized } from '@/hooks/useCoursesOrganized';
import { useQuizProgressStream } from '@/hooks/useSSEStream';
import { useSmoothedProgress } from '@/hooks/useAnimatedProgress';
import { QuizConfig } from '@/types/quiz-personnalisation';
import GlobalDropZone from '@/components/upload/GlobalDropZone';

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
  quiz_config?: QuizConfig | null;
  // Quiz generation progress fields for polling
  quiz_progress?: number;
  quiz_questions_generated?: number;
  quiz_total_questions?: number;
  quiz_current_step?: string | null;
  quiz_error_message?: string | null;
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
  const { triggerRefresh } = useCoursesRefresh();

  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [isChildModalOpen, setIsChildModalOpen] = useState(false);

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
  const [quizGenerationError, setQuizGenerationError] = useState<string | null>(null);
  const [streamingQuestions, setStreamingQuestions] = useState<StreamingQuestion[]>([]);
  // Local state to show loading immediately when generation starts (before server confirms)
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);

  // Map step keys to translation keys for quiz generation
  const translateQuizStepMessage = useCallback((step: string | undefined, message: string | undefined): string => {
    const STEP_TO_TRANSLATION_KEY: Record<string, string> = {
      'starting': 'gen_step_starting',
      'analyzing_document': 'gen_step_analyzing_document',
      'extracting_chapter': 'gen_step_extracting_chapter',
      'identifying_concepts': 'gen_step_identifying_concepts',
      'generating_content': 'gen_step_generating_questions',
      'verifying_content': 'gen_step_verifying_duplicates',
      'saving_content': 'gen_step_finalizing',
      'finalizing': 'gen_step_finalizing',
      'retrying_failed': 'gen_step_retrying_failed',
      'complete': 'gen_step_complete',
    };

    if (step) {
      const translationKey = STEP_TO_TRANSLATION_KEY[step];
      if (translationKey) {
        return translate(translationKey);
      }
    }

    // Fallback to message if no step
    return message || translate('gen_step_analyzing_document');
  }, [translate]);

  // Track if user started playing during generation - persisted to survive navigation
  const [wasPlayingProgressiveQuiz, setWasPlayingProgressiveQuiz] = useState(false);
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

  // Quiz generation progress is now tracked via polling from the database
  // These computed values come from the course data fetched by useCourseChapters
  const quizGenerationProgress = apiCourse?.quiz_progress ?? 0;
  const quizGenerationStep = apiCourse?.quiz_current_step ?? undefined;
  const totalExpectedQuestions = apiCourse?.quiz_total_questions ?? undefined;
  const questionsGenerated = apiCourse?.quiz_questions_generated ?? 0;

  // isGeneratingQuiz is now derived from the server status OR local starting state
  // This ensures the loading screen appears immediately when user clicks generate
  const isGeneratingQuiz = isStartingGeneration || apiCourse?.quiz_status === 'generating';

  // Debug log for isGeneratingQuiz state
  useEffect(() => {
    console.log('[learn] Generation state:', {
      isStartingGeneration,
      quiz_status: apiCourse?.quiz_status,
      isGeneratingQuiz,
    });
  }, [isStartingGeneration, apiCourse?.quiz_status, isGeneratingQuiz]);

  // Clear isStartingGeneration once server confirms generation has REALLY started
  // We check BOTH quiz_status AND quiz_progress to ensure we have fresh data
  // This prevents the race condition where quiz_status is 'generating' but quiz_progress is still 100%
  useEffect(() => {
    if (isStartingGeneration && apiCourse?.quiz_status === 'generating') {
      // Only clear if quiz_progress is also reset (< 50%), proving we have fresh data
      const progress = apiCourse?.quiz_progress ?? 0;
      if (progress < 50) {
        console.log(`[learn] Server confirmed generation started (progress=${progress}%), clearing isStartingGeneration`);
        setIsStartingGeneration(false);
      } else {
        console.log(`[learn] quiz_status is 'generating' but progress=${progress}% - waiting for fresh data`);
      }
    }
  }, [isStartingGeneration, apiCourse?.quiz_status, apiCourse?.quiz_progress]);

  // Generate a progress message based on the step
  const quizGenerationMessage = useMemo(() => {
    if (!quizGenerationStep) return '';
    const STEP_TO_MESSAGE: Record<string, string> = {
      'starting': 'Démarrage...',
      'analyzing_document': 'Analyse du document...',
      'extracting_chapter': 'Extraction du chapitre...',
      'identifying_concepts': 'Identification des concepts...',
      'generating_content': 'Génération des questions...',
      'verifying_content': 'Vérification des doublons...',
      'saving_content': 'Sauvegarde...',
      'complete': 'Terminé !',
      'error': 'Erreur',
    };
    return STEP_TO_MESSAGE[quizGenerationStep] || quizGenerationStep;
  }, [quizGenerationStep]);

  // Function to generate quiz on demand - synchronous approach
  // The backend now waits for completion before returning
  // Progress is tracked via polling from the database during generation
  const handleGenerateQuiz = useCallback(async (config?: QuizConfig) => {
    console.log('[learn] handleGenerateQuiz called with config:', config);
    if (!courseId || isDemoId) {
      console.log('[learn] handleGenerateQuiz aborted:', { courseId, isDemoId });
      return;
    }

    // Check if already generating on server or locally
    if (isStartingGeneration || apiCourse?.quiz_status === 'generating') {
      console.log('[learn] Quiz already generating, skipping');
      return;
    }

    setQuizGenerationError(null);
    setStreamingQuestions([]); // Reset streaming questions
    setIsStartingGeneration(true); // Show loading immediately

    // Clear sessionStorage to ensure clean state on regeneration
    sessionStorage.removeItem(`progressive_quiz_${courseId}`);
    setWasPlayingProgressiveQuiz(false);

    // Small delay to allow React to re-render and show the loading screen
    // before the long-running fetch blocks the main thread
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      console.log('[learn] Starting quiz generation...');

      // Call the API - it now waits for completion (synchronous)
      const response = await fetch(`/api/courses/${courseId}/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to start quiz generation');
      }

      const result = await response.json();
      console.log('[learn] Quiz generation completed:', result);

      // Refetch to get the updated status (should be 'ready' now)
      await refetch();

      // Generation completed successfully - clear local state
      // At this point, server has already set quiz_status to 'ready' or 'partial'
      setIsStartingGeneration(false);

      trackEvent('quiz_generation_started', {
        userId: user?.id,
        courseId,
        config,
      });

    } catch (err) {
      console.error('Error during quiz generation:', err);
      setQuizGenerationError(err instanceof Error ? err.message : 'Failed to generate quiz');
      await refetch();
      // Clear isStartingGeneration on error too
      setIsStartingGeneration(false);
    }
  }, [courseId, isDemoId, isStartingGeneration, apiCourse?.quiz_status, refetch, user?.id]);

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

  // Persist streaming questions to sessionStorage during generation
  useEffect(() => {
    if (streamingQuestions.length > 0 && courseId) {
      sessionStorage.setItem(`progressive_quiz_${courseId}`, JSON.stringify(streamingQuestions));
    }
  }, [streamingQuestions, courseId]);

  // Persist wasPlayingProgressiveQuiz state
  useEffect(() => {
    if (courseId) {
      if (wasPlayingProgressiveQuiz) {
        sessionStorage.setItem(`progressive_quiz_playing_${courseId}`, 'true');
      } else {
        sessionStorage.removeItem(`progressive_quiz_playing_${courseId}`);
      }
    }
  }, [wasPlayingProgressiveQuiz, courseId]);

  // Restore streaming questions and playing state from sessionStorage on mount
  useEffect(() => {
    if (courseId && !isGeneratingQuiz) {
      const savedQuestions = sessionStorage.getItem(`progressive_quiz_${courseId}`);
      const wasPlaying = sessionStorage.getItem(`progressive_quiz_playing_${courseId}`);

      if (savedQuestions) {
        try {
          const parsed = JSON.parse(savedQuestions) as StreamingQuestion[];
          if (parsed.length > 0) {
            setStreamingQuestions(parsed);
            if (wasPlaying === 'true') {
              setWasPlayingProgressiveQuiz(true);
            }
          }
        } catch (e) {
          console.error('Failed to restore progressive quiz state:', e);
        }
      }
    }
  }, [courseId]); // Only run on mount/courseId change, not when isGeneratingQuiz changes

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

  // SSE stream for quiz generation progress
  // This replaces polling with real-time updates via Server-Sent Events
  const quizStream = useQuizProgressStream(courseId || '', {
    onEvent: (event) => {
      console.log('[quiz-sse] Event received:', event.type);
    },
    onQuestion: (event) => {
      // Add streaming question for progressive quiz view
      // The event is SSEQuestionEvent which has a 'data' property
      const questionEvent = event as { type: 'question'; data: { chapterId: string; chapterTitle: string; question: { id: string; questionText: string; type: string; options: string[] | null; correctOptionIndex: number | null; answerText: string | null; explanation: string | null; questionNumber: number } }; questionsGenerated: number; progress: number };
      if (questionEvent.data) {
        const { chapterId, chapterTitle, question } = questionEvent.data;
        setStreamingQuestions(prev => {
          // Avoid duplicates
          if (prev.some(q => q.id === question.id)) return prev;
          const newQuestion: StreamingQuestion = {
            id: question.id,
            chapterId,
            chapterTitle: chapterTitle || '',
            questionText: question.questionText,
            type: question.type,
            options: question.options,
            correctOptionIndex: question.correctOptionIndex,
            answerText: question.answerText,
            explanation: question.explanation,
            questionNumber: question.questionNumber || prev.length + 1,
          };
          return [...prev, newQuestion];
        });
      }
    },
    onComplete: async () => {
      console.log('[quiz-sse] Generation complete');
      // Refetch to get final state
      await refetch();
    },
    onError: (error) => {
      console.error('[quiz-sse] Stream error:', error);
      setQuizGenerationError(error);
    },
  });

  // SSE-based progress values (override polling values when streaming)
  const rawProgress = quizStream.isStreaming ? quizStream.progress : quizGenerationProgress;
  const sseQuestionsGenerated = quizStream.isStreaming
    ? quizStream.events.filter(e => e.type === 'question').length
    : questionsGenerated;

  // Apply smooth animation to progress (slowly increments 0.5%/sec between server updates)
  // This prevents the progress bar from "freezing" and gives users visual feedback
  const sseProgress = useSmoothedProgress(rawProgress, isGeneratingQuiz);

  // Start SSE stream when quiz generation begins
  useEffect(() => {
    if (isDemoId || !courseId) return;

    const shouldStream = course?.quiz_status === 'generating';

    if (shouldStream && !quizStream.isStreaming && !quizStream.isComplete) {
      console.log('[quiz-sse] Starting SSE stream for quiz progress');
      quizStream.startListening();
    }

    // Reset stream when generation completes
    if (!shouldStream && quizStream.isComplete) {
      quizStream.reset();
    }
  }, [isDemoId, courseId, course?.quiz_status, quizStream]);

  // Poll for quiz status during generation
  // This ensures the UI stays updated with progress from the server
  // IMPORTANT: We poll REGARDLESS of SSE streaming status because SSE only provides
  // streaming questions - we still need to refetch to get updated chapter question_count
  // BUT: Don't poll if user is actively playing a quiz (it causes disruptive re-renders)
  useEffect(() => {
    if (isDemoId || !courseId) return;

    // Poll if quiz is generating (either locally started or server confirmed)
    // Don't gate on SSE streaming - we need chapter data to update even when SSE is active
    const shouldPoll = isStartingGeneration || course?.quiz_status === 'generating';
    if (!shouldPoll) return;

    // IMPORTANT: Don't poll if user is playing the progressive quiz
    // This prevents disruptive re-renders that reset the quiz to question 1
    if (wasPlayingProgressiveQuiz) {
      console.log('[quiz-poll] User is playing quiz, skipping poll to avoid disruption');
      return;
    }

    console.log('[quiz-poll] Starting progress poll (SSE streaming:', quizStream.isStreaming, ')');
    const pollInterval = setInterval(async () => {
      // Double-check user isn't playing before each poll
      if (wasPlayingProgressiveQuiz) {
        console.log('[quiz-poll] User started playing quiz, stopping poll');
        return;
      }
      console.log('[quiz-poll] Polling for progress...');
      await refetch();
    }, 3000); // Poll every 3 seconds for responsive progress updates

    return () => {
      console.log('[quiz-poll] Stopping progress poll');
      clearInterval(pollInterval);
    };
  }, [isDemoId, courseId, isStartingGeneration, course?.quiz_status, quizStream.isStreaming, refetch, wasPlayingProgressiveQuiz]);

  // With fire-and-forget mode, quiz generation continues on the server
  // even if the user navigates away. The status 'generating' is valid.
  // We only consider it stuck if progress hasn't changed in a long time (server might have crashed).
  // The server handles this automatically by updating quiz_status when done.

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

  // Handle folder click from breadcrumb - open sidebar to that folder's courses
  // This must be declared before early returns to follow Rules of Hooks
  const handleBreadcrumbFolderClick = useCallback(() => {
    if (currentCourseFolder) {
      sidebar.openToFolder(currentCourseFolder.id, currentCourseFolder.name);
    }
  }, [currentCourseFolder, sidebar]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-neutral-900' : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'}`}>
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
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-neutral-900' : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'}`}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#d91a1c' }} />
          <p className="text-gray-600">{error || translate('course_detail_error')}</p>
        </div>
      </div>
    );
  }

  // Show ExtractionLoader when course is being processed (not ready yet)
  // This happens right after upload when the pipeline is extracting text
  if (!isDemoId && course.status !== 'ready' && course.status !== 'failed') {
    console.log(`[LearnPage] Showing ExtractionLoader for courseId: ${courseId}, status: ${course.status}`);
    return (
      <div className={`min-h-screen transition-colors ${
        isDark
          ? 'bg-neutral-900'
          : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
      }`}>
        <ExtractionLoader
          courseId={courseId}
          onComplete={() => {
            // Refetch course data to get the updated status
            refetch();
          }}
        />
      </div>
    );
  }

  return (
    <GlobalDropZone>
      <div className={`min-h-screen flex flex-col ${
        isDark
          ? 'bg-neutral-900'
          : 'bg-gradient-to-br from-orange-50 via-white to-orange-50'
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
          disabled={isChildModalOpen || showSignupModal || showPaywallModal}
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
                courseName={course.title}
                onFolderClick={handleBreadcrumbFolderClick}
              />
            </div>
            <div className="flex-shrink-0">
              <TopBarActions showDarkModeToggle />
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-4 flex-1 w-full">
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
          <div
            className="rounded-2xl border p-4 text-sm flex items-start gap-3"
            style={{
              borderColor: isDark ? 'rgba(217, 26, 28, 0.3)' : 'rgba(217, 26, 28, 0.2)',
              backgroundColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3',
              color: isDark ? '#f87171' : '#991b1b'
            }}
          >
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#d91a1c' }} />
            <div className="flex-1">
              <p className="font-semibold">{translate('upload_processing_failed')}</p>
              <p className="text-xs mt-1" style={{ color: isDark ? '#f87171' : '#b91c1c' }}>
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
                      <div className="mt-1" style={{ color: '#d91a1c' }}>Erreur: {jobStatus.error_message}</div>
                    )}
                  </div>
                )}
                {isStuck && (
                  <div className="mt-6">
                    {retryError && (
                      <div
                        className="mb-4 p-3 rounded-xl text-sm"
                        style={{
                          backgroundColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3',
                          color: isDark ? '#f87171' : '#d91a1c'
                        }}
                      >
                        {retryError}
                      </div>
                    )}
                    <button
                      onClick={handleRetryProcessing}
                      disabled={isRetrying}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold disabled:opacity-60 transition-colors"
                      style={{ backgroundColor: '#ff751f' }}
                      onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#e5681b')}
                      onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#ff751f')}
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

            {/* Quiz not generated yet - show personnalisation screen (hide once generation starts) */}
            {/* Use isGeneratingQuiz which includes local isStartingGeneration state for immediate feedback */}
            {!isDemoId && course?.status === 'ready' && !isGeneratingQuiz && course?.quiz_status !== 'ready' && course?.quiz_status !== 'partial' && (
              <>
                {quizGenerationError && (
                  <div
                    className="mb-4 p-3 rounded-xl text-sm"
                    style={{
                      backgroundColor: isDark ? 'rgba(217, 26, 28, 0.2)' : '#fff6f3',
                      color: isDark ? '#f87171' : '#d91a1c'
                    }}
                  >
                    {quizGenerationError}
                  </div>
                )}
                <QuizPersonnalisationScreen
                  onGenerate={handleGenerateQuiz}
                  isGenerating={isGeneratingQuiz}
                />
              </>
            )}

            {/* Chapters list OR Progressive Quiz during generation */}
            {/* Show QuizChapterManagement when quiz exists or is being generated
                Always show if chapters exist to prevent blank screen after quiz completion
            */}
            {(isDemoId || course?.quiz_status === 'ready' || course?.quiz_status === 'partial' || course?.quiz_status === 'generating' || isGeneratingQuiz || chapters.length > 0) && (
              <QuizChapterManagement
                courseId={courseId}
                courseTitle={course.title}
                chapters={chapters}
                quizStatus={course.quiz_status}
                savedQuizConfig={course.quiz_config}
                onChapterClick={handleChapterClick}
                onRegenerateQuiz={handleGenerateQuiz}
                isGenerating={isGeneratingQuiz || course?.quiz_status === 'generating'}
                isStartingGeneration={isStartingGeneration}
                generationProgress={sseProgress}
                generationProgressRaw={rawProgress}
                generationMessage={translateQuizStepMessage(quizGenerationStep, quizGenerationMessage)}
                streamingQuestions={streamingQuestions}
                totalExpectedQuestions={totalExpectedQuestions}
                questionsGenerated={sseQuestionsGenerated}
                enableProgressiveQuiz={true}
                hasFullAccess={hasFullAccess}
                isDemoId={isDemoId}
                refetch={refetch}
                wasPlayingProgressiveQuiz={wasPlayingProgressiveQuiz}
                onPlayingStateChange={setWasPlayingProgressiveQuiz}
                onClearProgressiveQuiz={async () => {
                  // Clear playing state immediately
                  setWasPlayingProgressiveQuiz(false);
                  if (courseId) {
                    sessionStorage.removeItem(`progressive_quiz_playing_${courseId}`);
                    sessionStorage.removeItem(`progressive_quiz_answers_${courseId}`);
                  }

                  // Only clear streaming questions if generation is NOT in progress
                  if (!isGeneratingQuiz) {
                    // Refetch to ensure we have the latest data from DB
                    await refetch();

                    // DON'T clear streaming questions immediately - let them persist
                    // They will be naturally replaced on the next quiz generation
                    // This prevents the blank screen issue when returning from progressive quiz
                    // The streaming questions serve as a fallback display until user navigates away

                    // Only clear sessionStorage for answers (not the questions themselves)
                    // Questions in sessionStorage will be cleared on next generation start
                  }
                }}
              />
            )}
          </>
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsView
            courseId={courseId}
            courseTitle={course.title}
            courseStatus={course.status}
            onModalStateChange={setIsChildModalOpen}
          />
        )}

        {activeTab === 'note' && (
          <APlusNoteView
            courseId={courseId}
            courseTitle={course.title}
            courseStatus={course.status}
            onModalStateChange={setIsChildModalOpen}
          />
        )}

      </main>

        {/* Footer - integrated in content wrapper for proper margin */}
        <footer className={`border-t mt-auto ${
          isDark
            ? 'bg-neutral-900/50 border-neutral-800'
            : 'bg-gray-50/50 border-gray-100'
        }`}>
          <div className={`max-w-4xl mx-auto px-4 py-1.5 flex items-center justify-center gap-4 text-[10px] ${
            isDark ? 'text-neutral-500' : 'text-gray-400'
          }`}>
            <span>© 2026 Nareo</span>
            <span className={isDark ? 'text-neutral-700' : 'text-gray-300'}>·</span>
            <span className="hover:text-orange-500 transition-colors cursor-pointer">
              Contact
            </span>
          </div>
        </footer>
      </div>

      {showSignupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]">
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
                className="flex-1 px-4 py-3 text-white rounded-xl font-semibold transition-colors"
                style={{ backgroundColor: '#ff751f' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5681b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff751f'}
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
    </GlobalDropZone>
  );
}
