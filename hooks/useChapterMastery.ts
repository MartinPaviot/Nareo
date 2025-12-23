'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCoursesRefresh } from '@/contexts/CoursesRefreshContext';
import type { ChapterMastery, CourseMasterySummary } from '@/lib/stats/types';
import { groupMasteryByCourse, getChaptersNeedingReview, getChaptersInDanger } from '@/lib/stats/utils';

interface UseChapterMasteryReturn {
  mastery: ChapterMastery[];
  courseSummaries: CourseMasterySummary[];
  chaptersNeedingReview: ChapterMastery[];
  chaptersInDanger: ChapterMastery[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getMasteryForCourse: (courseId: string) => ChapterMastery[];
  getMasteryForChapter: (chapterId: string) => ChapterMastery | null;
}

export function useChapterMastery(courseId?: string): UseChapterMasteryReturn {
  const { user } = useAuth();
  const { subscribe } = useCoursesRefresh();
  const [mastery, setMastery] = useState<ChapterMastery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMastery = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const url = courseId
        ? `/api/stats/mastery?course_id=${courseId}`
        : '/api/stats/mastery';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch chapter mastery');
      }

      const data = await response.json();
      setMastery(data.mastery || []);
    } catch (err) {
      console.error('Error fetching chapter mastery:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user, courseId]);

  const getMasteryForCourse = useCallback((targetCourseId: string): ChapterMastery[] => {
    return mastery.filter(m => m.course_id === targetCourseId);
  }, [mastery]);

  const getMasteryForChapter = useCallback((chapterId: string): ChapterMastery | null => {
    return mastery.find(m => m.chapter_id === chapterId) || null;
  }, [mastery]);

  useEffect(() => {
    fetchMastery();
  }, [fetchMastery]);

  // Subscribe to global refresh events
  useEffect(() => {
    const unsubscribe = subscribe(fetchMastery);
    return unsubscribe;
  }, [subscribe, fetchMastery]);

  const courseSummaries = groupMasteryByCourse(mastery);
  const chaptersNeedingReview = getChaptersNeedingReview(mastery);
  const chaptersInDanger = getChaptersInDanger(mastery);

  return {
    mastery,
    courseSummaries,
    chaptersNeedingReview,
    chaptersInDanger,
    isLoading,
    error,
    refetch: fetchMastery,
    getMasteryForCourse,
    getMasteryForChapter,
  };
}
