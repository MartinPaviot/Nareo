'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { UserStats, StreakCheckResult, DailyGoalLevel } from '@/lib/stats/types';

interface UseUserStatsReturn {
  stats: UserStats | null;
  streakState: StreakCheckResult | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateDailyGoalLevel: (level: DailyGoalLevel) => Promise<boolean>;
}

export function useUserStats(): UseUserStatsReturn {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [streakState, setStreakState] = useState<StreakCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/stats/user');
      if (!response.ok) {
        throw new Error('Failed to fetch user stats');
      }

      const data = await response.json();
      setStats(data.stats);
      setStreakState(data.streakState);
    } catch (err) {
      console.error('Error fetching user stats:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const updateDailyGoalLevel = useCallback(async (level: DailyGoalLevel): Promise<boolean> => {
    if (!user) return false;

    try {
      const response = await fetch('/api/stats/user/goal-level', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });

      if (!response.ok) {
        throw new Error('Failed to update goal level');
      }

      await fetchStats();
      return true;
    } catch (err) {
      console.error('Error updating goal level:', err);
      return false;
    }
  }, [user, fetchStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    streakState,
    isLoading,
    error,
    refetch: fetchStats,
    updateDailyGoalLevel,
  };
}
