'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { DailyActivity, QuizAnswerResult } from '@/lib/stats/types';

// Helper to get current date string in YYYY-MM-DD format (local timezone)
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  const lastFetchDateRef = useRef<string>(getTodayDateString());

  const fetchActivity = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Send local date to ensure timezone consistency
      const localDate = getTodayDateString();
      const response = await fetch(`/api/stats/daily-activity?date=${localDate}`);
      if (!response.ok) {
        throw new Error('Failed to fetch daily activity');
      }

      const data = await response.json();
      setTodayActivity(data.today);
      setRecentActivity(data.recent || []);
      lastFetchDateRef.current = getTodayDateString();
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

  // Initial fetch
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  // Auto-refresh at midnight and when user returns to tab
  useEffect(() => {
    // Calculate ms until next midnight
    const getMsUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight.getTime() - now.getTime();
    };

    // Schedule refresh at midnight
    let midnightTimeout: NodeJS.Timeout;
    const scheduleMidnightRefresh = () => {
      const msUntilMidnight = getMsUntilMidnight();
      midnightTimeout = setTimeout(() => {
        console.log('[useDailyActivity] Midnight reached, refreshing data...');
        fetchActivity();
        // Schedule next midnight refresh
        scheduleMidnightRefresh();
      }, msUntilMidnight + 1000); // +1s buffer to ensure we're past midnight
    };
    scheduleMidnightRefresh();

    // Also refresh when user returns to tab (if day changed while away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentDate = getTodayDateString();
        if (currentDate !== lastFetchDateRef.current) {
          console.log('[useDailyActivity] Day changed while away, refreshing data...');
          fetchActivity();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(midnightTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
