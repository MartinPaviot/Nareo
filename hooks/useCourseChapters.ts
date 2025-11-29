import { useEffect, useState, useCallback, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import type { RealtimeChannel } from '@supabase/supabase-js';

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
  status: string; // 'pending' | 'processing' | 'ready' | 'failed'
}

interface CourseChaptersResponse {
  success: boolean;
  course: CourseData;
  chapters: Chapter[];
  access_tier: string | null;
}

interface UseCourseChaptersOptions {
  courseId: string;
  enabled?: boolean; // Allow disabling the hook (e.g., for demo courses)
  useRealtime?: boolean; // Use Supabase Realtime instead of polling (default: true)
  pollingInterval?: number; // Polling delay in ms (default: 3000) - only used if useRealtime is false
}

interface UseCourseChaptersReturn {
  loading: boolean;
  course: CourseData | null;
  chapters: Chapter[];
  accessTier: string | null;
  error: string | null;
  refetch: () => Promise<void>;
  isPolling: boolean;
  isListening: boolean; // Indicates if Realtime subscription is active
}

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
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Use refs to avoid stale closures
  const courseRef = useRef<CourseData | null>(null);
  const chaptersRef = useRef<Chapter[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Determine if we should poll based on current state (used only in polling mode)
  const shouldPoll = useCallback((currentCourse: CourseData | null, currentChapters: Chapter[]) => {
    if (!currentCourse) return false;

    const statusRequiresPolling =
      currentCourse.status === 'pending' ||
      currentCourse.status === 'processing';

    const noChapters = currentChapters.length === 0;

    return statusRequiresPolling || noChapters;
  }, []);

  // Fetch course data
  const fetchCourseData = useCallback(async () => {
    if (!enabled || !courseId) return;

    try {
      const response = await fetch(`/api/courses/${courseId}/chapters`);

      if (!response.ok) {
        throw new Error('Failed to load course');
      }

      const data: CourseChaptersResponse = await response.json();

      // Update state
      setCourse(data.course);
      setChapters(data.chapters);
      setAccessTier(data.access_tier);
      setError(null);

      // Update refs
      courseRef.current = data.course;
      chaptersRef.current = data.chapters;

      // If using polling mode, check if we should stop
      if (!useRealtime && !shouldPoll(data.course, data.chapters)) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsPolling(false);
        }
      }
    } catch (err) {
      console.error('Error loading course:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');

      // Stop polling on error
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsPolling(false);
      }
    } finally {
      setLoading(false);
    }
  }, [courseId, enabled, useRealtime, shouldPoll]);

  // Setup Realtime subscription or polling
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

      // Create subscription to chapters table for this course
      const channel = supabase
        .channel(`course-${courseId}-chapters`)
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
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
          if (status === 'SUBSCRIBED') {
            setIsListening(true);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('Realtime subscription error, falling back to polling');
            setIsListening(false);
            // Fallback to polling on error
            setIsPolling(true);
            intervalRef.current = setInterval(fetchCourseData, pollingInterval);
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
    } else {
      // ===== POLLING MODE (fallback) =====
      const checkAndStartPolling = () => {
        if (shouldPoll(courseRef.current, chaptersRef.current)) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }

          setIsPolling(true);
          intervalRef.current = setInterval(() => {
            fetchCourseData();
          }, pollingInterval);
        }
      };

      const timeoutId = setTimeout(checkAndStartPolling, 100);

      // Cleanup function
      return () => {
        clearTimeout(timeoutId);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsPolling(false);
      };
    }
  }, [courseId, enabled, useRealtime, pollingInterval, fetchCourseData, shouldPoll]);

  return {
    loading,
    course,
    chapters,
    accessTier,
    error,
    refetch: fetchCourseData,
    isPolling,
    isListening,
  };
}
