'use client';

import { useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function useSessionTracker(user: User | null) {
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Start session when user logs in
  useEffect(() => {
    if (!user) return;

    const startSession = async () => {
      try {
        const { data, error } = await supabase
          .from('sessions')
          .insert([{
            user_id: user.id,
            started_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (error) {
          console.error('Error starting session:', error);
          return;
        }

        sessionIdRef.current = data.id;
        startTimeRef.current = new Date();
      } catch (error) {
        console.error('Error starting session:', error);
      }
    };

    startSession();
  }, [user]);

  // End session on unmount or user change
  useEffect(() => {
    if (!user) return;

    const endSession = async () => {
      if (!sessionIdRef.current || !startTimeRef.current) return;

      try {
        const endTime = new Date();
        const durationSeconds = Math.floor(
          (endTime.getTime() - startTimeRef.current.getTime()) / 1000
        );

        // Update session with end time and duration
        const { error: sessionError } = await supabase
          .from('sessions')
          .update({
            ended_at: endTime.toISOString(),
            duration_seconds: durationSeconds,
          })
          .eq('id', sessionIdRef.current);

        if (sessionError) {
          console.error('Error ending session:', sessionError);
        }

        // Update or create user_stats
        const { data: existingStats } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (existingStats) {
          // Update existing stats
          await supabase
            .from('user_stats')
            .update({
              total_duration_seconds:
                existingStats.total_duration_seconds + durationSeconds,
              last_seen_at: endTime.toISOString(),
            })
            .eq('user_id', user.id);
        } else {
          // Create new stats
          await supabase.from('user_stats').insert({
            user_id: user.id,
            total_duration_seconds: durationSeconds,
            last_seen_at: endTime.toISOString(),
          });
        }
      } catch (error) {
        console.error('Error ending session:', error);
      }
    };

    // End session on page unload
    const handleBeforeUnload = () => {
      endSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // End session on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, [user]);

  return null;
}
