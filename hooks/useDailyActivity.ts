'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { DailyActivity, QuizAnswerResult } from '@/lib/stats/types';

interface UseDailyActivityReturn {
  todayActivity: DailyActivity | null;
  recentActivity: DailyActivity[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  recordQuizAnswer: (params: {
    chapterId: string;
    courseId: string;
    isCorrect: boolean;
    currentCorrectStreak?: number;
  }) => Promise<QuizAnswerResult | null>;
}

export function useDailyActivity(): UseDailyActivityReturn {
  const { user } = useAuth();
  const [todayActivity, setTodayActivity] = useState<DailyActivity | null>(null);
  const [recentActivity, setRecentActivity] = useState<DailyActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/stats/daily-activity');
      if (!response.ok) {
        throw new Error('Failed to fetch daily activity');
      }

      const data = await response.json();
      setTodayActivity(data.today);
      setRecentActivity(data.recent || []);
    } catch (err) {
      console.error('Error fetching daily activity:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const recordQuizAnswer = useCallback(async (params: {
    chapterId: string;
    courseId: string;
    isCorrect: boolean;
    currentCorrectStreak?: number;
  }): Promise<QuizAnswerResult | null> => {
    if (!user) return null;

    try {
      const response = await fetch('/api/stats/record-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapter_id: params.chapterId,
          course_id: params.courseId,
          is_correct: params.isCorrect,
          current_correct_streak: params.currentCorrectStreak || 0,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to record quiz answer');
      }

      const data = await response.json();

      // Refetch activity to get updated values
      await fetchActivity();

      return data.result as QuizAnswerResult;
    } catch (err) {
      console.error('Error recording quiz answer:', err);
      return null;
    }
  }, [user, fetchActivity]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    todayActivity,
    recentActivity,
    isLoading,
    error,
    refetch: fetchActivity,
    recordQuizAnswer,
  };
}
