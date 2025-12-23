'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import type { CoursesData, Folder, Course } from '@/lib/courses/types';

interface UseCoursesOrganizedReturn {
  folders: Folder[];
  uncategorized: Course[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  moveCourse: (courseId: string, folderId: string | null) => Promise<boolean>;
}

export function useCoursesOrganized(): UseCoursesOrganizedReturn {
  const { user } = useAuth();
  const { subscribe } = useCoursesRefresh();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [uncategorized, setUncategorized] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/courses/organized');
      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const data: CoursesData = await response.json();
      setFolders(data.folders || []);
      setUncategorized(data.uncategorized || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const moveCourse = useCallback(async (courseId: string, folderId: string | null): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await fetch('/api/courses/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, folderId }),
      });

      if (!response.ok) {
        throw new Error('Failed to move course');
      }

      await fetchCourses();
      return true;
    } catch (err) {
      console.error('Error moving course:', err);
      return false;
    }
  }, [user, fetchCourses]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Subscribe to global refresh events
  useEffect(() => {
    const unsubscribe = subscribe(fetchCourses);
    return unsubscribe;
  }, [subscribe, fetchCourses]);

  return {
    folders,
    uncategorized,
    isLoading,
    error,
    refetch: fetchCourses,
    moveCourse,
  };
}
