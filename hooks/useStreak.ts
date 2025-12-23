'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { StreakState, StreakCheckResult, MilestoneReward } from '@/lib/stats/types';

interface UseStreakReturn {
  currentStreak: number;
  longestStreak: number;
  streakState: StreakState;
  freezesAvailable: number;
  previousStreakLost: number;
  isLoading: boolean;
  error: string | null;
  checkStreak: () => Promise<StreakCheckResult | null>;
  checkMilestones: () => Promise<MilestoneReward[]>;
  useStreakFreeze: () => Promise<boolean>;
}

export function useStreak(): UseStreakReturn {
  const { user } = useAuth();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [streakState, setStreakState] = useState<StreakState>('new_user');
  const [freezesAvailable, setFreezesAvailable] = useState(0);
  const [previousStreakLost, setPreviousStreakLost] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStreak = useCallback(async (): Promise<StreakCheckResult | null> => {
    if (!user) return null;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/stats/streak/check', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to check streak');
      }

      const data = await response.json();
      const result = data.result as StreakCheckResult;

      setCurrentStreak(result.current_streak);
      setLongestStreak(result.longest_streak);
      setStreakState(result.streak_state);
      setFreezesAvailable(result.freezes_available);
      setPreviousStreakLost(result.previous_streak_lost);

      return result;
    } catch (err) {
      console.error('Error checking streak:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const checkMilestones = useCallback(async (): Promise<MilestoneReward[]> => {
    if (!user) return [];

    try {
      const response = await fetch('/api/stats/streak/milestones', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to check milestones');
      }

      const data = await response.json();
      return data.rewards || [];
    } catch (err) {
      console.error('Error checking milestones:', err);
      return [];
    }
  }, [user]);

  const useStreakFreeze = useCallback(async (): Promise<boolean> => {
    if (!user || freezesAvailable <= 0) return false;

    try {
      const response = await fetch('/api/stats/streak/use-freeze', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to use streak freeze');
      }

      const data = await response.json();
      if (data.success) {
        setFreezesAvailable(prev => prev - 1);
      }
      return data.success;
    } catch (err) {
      console.error('Error using streak freeze:', err);
      return false;
    }
  }, [user, freezesAvailable]);

  useEffect(() => {
    if (user) {
      checkStreak();
    } else {
      setIsLoading(false);
    }
  }, [user, checkStreak]);

  return {
    currentStreak,
    longestStreak,
    streakState,
    freezesAvailable,
    previousStreakLost,
    isLoading,
    error,
    checkStreak,
    checkMilestones,
    useStreakFreeze,
  };
}
