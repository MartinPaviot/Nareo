import { useEffect, useState, useCallback, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { QuizConfig } from '@/types/quiz-personnalisation';

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
  status: 'pending' | 'processing' | 'ready' | 'failed'; // Chapter processing status
  source_text?: string | null; // Original chapter text for quiz generation
}

interface CourseData {
  id: string;
  title: string;
  status: string; // 'pending' | 'processing' | 'ready' | 'failed'
  quiz_status?: 'pending' | 'generating' | 'ready' | 'partial' | 'failed'; // Quiz generation status
  quiz_config?: QuizConfig | null; // Saved quiz config for regeneration
  // Quiz generation progress fields for polling
  quiz_progress?: number;
  quiz_questions_generated?: number;
  quiz_total_questions?: number;
  quiz_current_step?: string | null;
  quiz_error_message?: string | null;
}

interface CourseChaptersResponse {
  success: boolean;
  course: CourseData;
  chapters: Chapter[];
  access_tier: string | null;
  is_premium?: boolean;
  is_free_monthly_course?: boolean;
}

interface UseCourseChaptersOptions {
  courseId: string;
  enabled?: boolean; // Allow disabling the hook (e.g., for demo courses)
  useRealtime?: boolean; // Use Supabase Realtime instead of polling (default: true)
  pollingInterval?: number; // Polling delay in ms (default: 3000) - used as fallback and during processing
}

interface UseCourseChaptersReturn {
  loading: boolean;
  course: CourseData | null;
  chapters: Chapter[];
  accessTier: string | null;
  isPremium: boolean;
  isFreeMonthlyCourse: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isPolling: boolean;
  isListening: boolean; // Indicates if Realtime subscription is active
}

// Aggressive polling interval during processing (2 seconds)
const PROCESSING_POLL_INTERVAL = 2000;

/**
 * Custom hook to fetch course chapters with automatic updates via Supabase Realtime
 *
 * Realtime behavior (default):
 * - Subscribes to chapters table filtered by courseId
 * - Automatically refetches when a chapter is inserted or updated
 * - Unsubscribes when component unmounts
 *
 * Fallback polling behavior (if useRealtime=false):
 * - Starts polling if course status is "pending" or "processing"
 * - Starts polling if chapters array is empty
 * - Stops polling when course status becomes "ready" or "failed" AND at least one chapter exists
 *
 * @param options - Hook configuration
 * @param options.courseId - The ID of the course to fetch
 * @param options.enabled - Whether the hook should fetch data (default: true)
 * @param options.useRealtime - Use Supabase Realtime instead of polling (default: true)
 * @param options.pollingInterval - Polling interval in milliseconds (default: 3000) - only used if useRealtime is false
 */
export function useCourseChapters({
  courseId,
  enabled = true,
  useRealtime = true,
  pollingInterval = 3000,
}: UseCourseChaptersOptions): UseCourseChaptersReturn {
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [accessTier, setAccessTier] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isFreeMonthlyCourse, setIsFreeMonthlyCourse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Use refs to avoid stale closures
  const courseRef = useRef<CourseData | null>(null);
  const chaptersRef = useRef<Chapter[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Determine if we should poll based on current state (used only in polling mode)
  // Note: Quiz generation polling is now handled via SSE in learn/page.tsx
  const shouldPoll = useCallback((currentCourse: CourseData | null, currentChapters: Chapter[]) => {
    if (!currentCourse) return false;

    const statusRequiresPolling =
      currentCourse.status === 'pending' ||
      currentCourse.status === 'processing';

    const noChapters = currentChapters.length === 0;

    return statusRequiresPolling || noChapters;
  }, []);

  // Ref to track if aggressive polling is active
  const pollingActiveRef = useRef(false);

  // Function to start aggressive polling during processing
  const startAggressivePolling = useCallback(() => {
    if (pollingActiveRef.current || intervalRef.current) return;

    console.log('Starting aggressive polling for processing course');
    pollingActiveRef.current = true;
    setIsPolling(true);
  }, []);

  // Function to stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    pollingActiveRef.current = false;
    setIsPolling(false);
  }, []);

  // Fetch course data
  const fetchCourseData = useCallback(async () => {
    if (!enabled || !courseId) return;

    try {
      const response = await fetch(`/api/courses/${courseId}/chapters`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error || `Failed to load course (${response.status})`;
        throw new Error(errorMessage);
      }

      const data: CourseChaptersResponse = await response.json();

      // Update state
      setCourse(data.course);
      setChapters(data.chapters);
      setAccessTier(data.access_tier);
      setIsPremium(data.is_premium || false);
      setIsFreeMonthlyCourse(data.is_free_monthly_course || false);
      setError(null);

      // Update refs
      courseRef.current = data.course;
      chaptersRef.current = data.chapters;

      // Check if course is processing - we need to poll for course extraction
      // Note: Quiz generation polling is now handled via SSE in learn/page.tsx
      const isProcessing = data.course.status === 'pending' || data.course.status === 'processing';
      const needsPolling = isProcessing;

      if (needsPolling && !pollingActiveRef.current) {
        // Start aggressive polling if not already active
        startAggressivePolling();
      } else if (!needsPolling && pollingActiveRef.current) {
        // Course finished processing, stop polling
        console.log('Course processing complete, stopping polling');
        stopPolling();
      }

      // If using polling mode only, check if we should stop
      if (!useRealtime && !shouldPoll(data.course, data.chapters)) {
        stopPolling();
      }
    } catch (err) {
      console.error('Error loading course:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');

      // Stop polling on error
      stopPolling();
    } finally {
      setLoading(false);
    }
  }, [courseId, enabled, useRealtime, shouldPoll, startAggressivePolling, stopPolling]);

  // Setup Realtime subscription
  useEffect(() => {
    if (!enabled || !courseId) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchCourseData();

    if (useRealtime) {
      // ===== REALTIME MODE =====
      const supabase = createSupabaseBrowserClient();

      // Create subscription to BOTH chapters AND courses tables
      const channel = supabase
        .channel(`course-${courseId}-updates`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'chapters',
            filter: `course_id=eq.${courseId}`,
          },
          (payload) => {
            console.log('Chapter change detected:', payload);
            // Refetch all data when any chapter changes
            fetchCourseData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE', // Listen to course status updates
            schema: 'public',
            table: 'courses',
            filter: `id=eq.${courseId}`,
          },
          (payload) => {
            console.log('Course status change detected:', payload);
            // Refetch all data when course status changes
            fetchCourseData();
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            setIsListening(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Realtime subscription error');
            setIsListening(false);
          }
        });

      channelRef.current = channel;

      // Cleanup function
      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
          setIsListening(false);
        }
      };
    }
  }, [courseId, enabled, useRealtime, fetchCourseData]);

  // Separate effect for aggressive polling during processing
  // This runs whenever isPolling changes
  useEffect(() => {
    if (!enabled || !courseId) return;

    if (isPolling && !intervalRef.current) {
      console.log('Setting up aggressive polling interval');
      intervalRef.current = setInterval(fetchCourseData, PROCESSING_POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPolling, courseId, enabled, fetchCourseData]);

  return {
    loading,
    course,
    chapters,
    accessTier,
    isPremium,
    isFreeMonthlyCourse,
    error,
    refetch: fetchCourseData,
    isPolling,
    isListening,
  };
}
