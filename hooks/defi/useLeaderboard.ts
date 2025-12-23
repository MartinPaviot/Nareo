'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { WeeklyPoints, UserProfile } from '@/types/defi';

interface LeaderboardEntry extends WeeklyPoints {
  user_profile: UserProfile;
  rank: number;
}

interface UseLeaderboardReturn {
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
  myPoints: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useLeaderboard(userId: string | null): UseLeaderboardReturn {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createSupabaseBrowserClient();

  const fetchLeaderboard = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current week start (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split('T')[0];

      // First get the user's friends
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      // Get friend IDs plus current user
      const friendIds = new Set([userId]);
      friendships?.forEach((f) => {
        friendIds.add(f.user_id === userId ? f.friend_id : f.user_id);
      });

      // Fetch weekly points for all friends
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('weekly_points')
        .select(`
          *,
          user_profile:user_profiles(*)
        `)
        .eq('week_start', weekStartStr)
        .in('user_id', Array.from(friendIds))
        .order('points', { ascending: false });

      if (weeklyError) throw weeklyError;

      // Also get profiles for users who don't have weekly points yet
      const usersWithPoints = new Set(weeklyData?.map((w) => w.user_id) || []);
      const usersWithoutPoints = Array.from(friendIds).filter(
        (id) => !usersWithPoints.has(id)
      );

      let additionalProfiles: UserProfile[] = [];
      if (usersWithoutPoints.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('*')
          .in('id', usersWithoutPoints);

        additionalProfiles = (profiles || []) as UserProfile[];
      }

      // Combine and rank
      const entries: LeaderboardEntry[] = [];

      // Add users with weekly points
      weeklyData?.forEach((w, index) => {
        if (w.user_profile) {
          entries.push({
            ...w,
            user_profile: w.user_profile as UserProfile,
            rank: index + 1,
          });
        }
      });

      // Add users without weekly points (they have 0 points)
      additionalProfiles.forEach((profile) => {
        entries.push({
          id: `temp-${profile.id}`,
          user_id: profile.id,
          week_start: weekStartStr,
          points: 0,
          challenges_played: 0,
          challenges_won: 0,
          best_streak: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_profile: profile,
          rank: entries.length + 1,
        });
      });

      // Sort by points and assign ranks
      entries.sort((a, b) => b.points - a.points);
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      setLeaderboard(entries);

      // Find current user's position
      const myEntry = entries.find((e) => e.user_id === userId);
      setMyRank(myEntry?.rank || null);
      setMyPoints(myEntry?.points || 0);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch leaderboard'));
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    leaderboard,
    myRank,
    myPoints,
    loading,
    error,
    refetch: fetchLeaderboard,
  };
}
