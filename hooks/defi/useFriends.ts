'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { Friendship, UserProfile } from '@/types/defi';

interface UseFriendsReturn {
  friends: (Friendship & { friend_profile: UserProfile })[];
  pendingRequests: (Friendship & { friend_profile: UserProfile })[];
  loading: boolean;
  error: Error | null;
  sendFriendRequest: (friendCode: string) => Promise<{ success: boolean; error?: string }>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  rejectFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useFriends(userId: string | null): UseFriendsReturn {
  const [friends, setFriends] = useState<(Friendship & { friend_profile: UserProfile })[]>([]);
  const [pendingRequests, setPendingRequests] = useState<(Friendship & { friend_profile: UserProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const supabase = createSupabaseBrowserClient();

  const fetchFriends = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch friendships where user is either user_id or friend_id
      const { data: friendships, error: friendshipsError } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (friendshipsError) throw friendshipsError;

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        setPendingRequests([]);
        setLoading(false);
        return;
      }

      // Get all friend IDs
      const friendIds = friendships.map((f) =>
        f.user_id === userId ? f.friend_id : f.user_id
      );

      // Fetch profiles for all friends
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .in('id', friendIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Separate accepted friends and pending requests
      const acceptedFriends: (Friendship & { friend_profile: UserProfile })[] = [];
      const pending: (Friendship & { friend_profile: UserProfile })[] = [];

      friendships.forEach((f) => {
        const friendId = f.user_id === userId ? f.friend_id : f.user_id;
        const profile = profileMap.get(friendId);

        if (!profile) return;

        const friendshipWithProfile = {
          ...f,
          friend_profile: profile as UserProfile,
        };

        if (f.status === 'accepted') {
          acceptedFriends.push(friendshipWithProfile);
        } else if (f.status === 'pending' && f.friend_id === userId) {
          // Only show pending requests sent TO the current user
          pending.push(friendshipWithProfile);
        }
      });

      setFriends(acceptedFriends);
      setPendingRequests(pending);
    } catch (err) {
      console.error('Error fetching friends:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch friends'));
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const sendFriendRequest = useCallback(
    async (friendCode: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: 'Non connecté' };

      try {
        // Find user by friend code
        const { data: friendProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('friend_code', friendCode.toUpperCase())
          .maybeSingle();

        if (profileError || !friendProfile) {
          return { success: false, error: 'Code ami introuvable' };
        }

        if (friendProfile.id === userId) {
          return { success: false, error: 'Vous ne pouvez pas vous ajouter vous-même' };
        }

        // Check if friendship already exists
        const { data: existing } = await supabase
          .from('friendships')
          .select('id, status')
          .or(
            `and(user_id.eq.${userId},friend_id.eq.${friendProfile.id}),` +
            `and(user_id.eq.${friendProfile.id},friend_id.eq.${userId})`
          )
          .maybeSingle();

        if (existing) {
          if (existing.status === 'accepted') {
            return { success: false, error: 'Vous êtes déjà amis' };
          }
          if (existing.status === 'pending') {
            return { success: false, error: 'Demande déjà envoyée' };
          }
        }

        // Create friendship request
        const { error: insertError } = await supabase
          .from('friendships')
          .insert({
            user_id: userId,
            friend_id: friendProfile.id,
            status: 'pending',
          });

        if (insertError) throw insertError;

        await fetchFriends();
        return { success: true };
      } catch (err) {
        console.error('Error sending friend request:', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Erreur inconnue',
        };
      }
    },
    [userId, supabase, fetchFriends]
  );

  const acceptFriendRequest = useCallback(
    async (friendshipId: string) => {
      try {
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', friendshipId);

        if (error) throw error;

        await fetchFriends();
      } catch (err) {
        console.error('Error accepting friend request:', err);
        throw err;
      }
    },
    [supabase, fetchFriends]
  );

  const rejectFriendRequest = useCallback(
    async (friendshipId: string) => {
      try {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('id', friendshipId);

        if (error) throw error;

        await fetchFriends();
      } catch (err) {
        console.error('Error rejecting friend request:', err);
        throw err;
      }
    },
    [supabase, fetchFriends]
  );

  const removeFriend = useCallback(
    async (friendshipId: string) => {
      try {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('id', friendshipId);

        if (error) throw error;

        await fetchFriends();
      } catch (err) {
        console.error('Error removing friend:', err);
        throw err;
      }
    },
    [supabase, fetchFriends]
  );

  return {
    friends,
    pendingRequests,
    loading,
    error,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    refetch: fetchFriends,
  };
}
