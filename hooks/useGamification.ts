import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Badge {
  id: string;
  code: string;
  name_fr: string;
  name_en: string;
  name_de: string;
  description_fr: string | null;
  description_en: string | null;
  description_de: string | null;
  icon: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface UserBadge {
  id: string;
  earned_at: string;
  badge: Badge;
}

interface DailyActivity {
  activity_date: string;
  quizzes_completed: number;
  questions_answered: number;
  questions_correct: number;
  points_earned: number;
  time_spent_minutes: number;
}

interface GamificationStats {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_points: number;
  total_quizzes_completed: number;
  total_chapters_completed: number;
  total_questions_answered: number;
  total_questions_correct: number;
}

interface UseGamificationReturn {
  stats: GamificationStats | null;
  badges: UserBadge[];
  todayActivity: DailyActivity | null;
  recentActivity: DailyActivity[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  recordActivity: (activity: {
    quizzes_completed?: number;
    questions_answered?: number;
    questions_correct?: number;
    points_earned?: number;
    time_spent_minutes?: number;
  }) => Promise<UserBadge[]>;
}

/**
 * Hook to manage user gamification data including streaks, badges, and activity
 */
export function useGamification(): UseGamificationReturn {
  const { user } = useAuth();
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [todayActivity, setTodayActivity] = useState<DailyActivity | null>(null);
  const [recentActivity, setRecentActivity] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/gamification/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch gamification stats');
      }

      const data = await response.json();
      setStats(data.gamification);
      setBadges(data.badges);
      setTodayActivity(data.today_activity);
      setRecentActivity(data.recent_activity);
    } catch (err) {
      console.error('Error fetching gamification stats:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const recordActivity = useCallback(
    async (activity: {
      quizzes_completed?: number;
      questions_answered?: number;
      questions_correct?: number;
      points_earned?: number;
      time_spent_minutes?: number;
    }): Promise<UserBadge[]> => {
      if (!user) return [];

      try {
        const response = await fetch('/api/gamification/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activity),
        });

        if (!response.ok) {
          throw new Error('Failed to record activity');
        }

        const data = await response.json();

        // Refetch stats to get updated values
        await fetchStats();

        return data.new_badges || [];
      } catch (err) {
        console.error('Error recording activity:', err);
        return [];
      }
    },
    [user, fetchStats]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    badges,
    todayActivity,
    recentActivity,
    loading,
    error,
    refetch: fetchStats,
    recordActivity,
  };
}
