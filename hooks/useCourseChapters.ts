import { useEffect, useState, useCallback, useRef } from 'react';

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
  pollingInterval?: number; // Polling delay in ms (default: 3000)
}

interface UseCourseChaptersReturn {
  loading: boolean;
  course: CourseData | null;
  chapters: Chapter[];
  accessTier: string | null;
  error: string | null;
  refetch: () => Promise<void>;
  isPolling: boolean;
}

/**
 * Custom hook to fetch course chapters with automatic polling
 *
 * Polling behavior:
 * - Starts polling if course status is "pending" or "processing"
 * - Starts polling if chapters array is empty
 * - Stops polling when:
 *   - Course status becomes "ready" or "failed"
 *   - At least one chapter is received
 *   - Component unmounts
 *
 * @param options - Hook configuration
 * @param options.courseId - The ID of the course to fetch
 * @param options.enabled - Whether the hook should fetch data (default: true)
 * @param options.pollingInterval - Polling interval in milliseconds (default: 3000)
 */
export function useCourseChapters({
  courseId,
  enabled = true,
  pollingInterval = 3000, // 3 seconds - can be adjusted here
}: UseCourseChaptersOptions): UseCourseChaptersReturn {
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [accessTier, setAccessTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Use refs to avoid stale closures in setInterval
  const courseRef = useRef<CourseData | null>(null);
  const chaptersRef = useRef<Chapter[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if we should poll based on current state
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

      // Update refs for polling decision
      courseRef.current = data.course;
      chaptersRef.current = data.chapters;

      // If we have chapters and status is ready/failed, stop polling
      if (!shouldPoll(data.course, data.chapters)) {
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
  }, [courseId, enabled, shouldPoll]);

  // Setup polling effect
  useEffect(() => {
    if (!enabled || !courseId) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchCourseData();

    // Check if we need to start polling after initial fetch
    const checkAndStartPolling = () => {
      if (shouldPoll(courseRef.current, chaptersRef.current)) {
        // Clear any existing interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }

        // Start polling
        setIsPolling(true);
        intervalRef.current = setInterval(() => {
          fetchCourseData();
        }, pollingInterval);
      }
    };

    // Small delay to let initial fetch complete before checking polling
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
  }, [courseId, enabled, pollingInterval, fetchCourseData, shouldPoll]);

  return {
    loading,
    course,
    chapters,
    accessTier,
    error,
    refetch: fetchCourseData,
    isPolling,
  };
}
