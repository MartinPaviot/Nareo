import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Find the active session (where ended_at is null)
    const { data: activeSessions, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Error fetching active session:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch active session', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!activeSessions || activeSessions.length === 0) {
      // No active session found, this is okay - user might have already closed it
      return NextResponse.json({
        success: true,
        message: 'No active session to close',
      });
    }

    const activeSession = activeSessions[0];
    const endTime = new Date();
    const startTime = new Date(activeSession.started_at);
    const durationSeconds = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000
    );

    // Update the session with end time and duration
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        ended_at: endTime.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', activeSession.id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      return NextResponse.json(
        { error: 'Failed to update session', details: updateError.message },
        { status: 500 }
      );
    }

    // Update or create user_stats
    const { data: existingStats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statsError && statsError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is okay
      console.error('Error fetching user stats:', statsError);
    }

    if (existingStats) {
      // Update existing stats
      const { error: updateStatsError } = await supabase
        .from('user_stats')
        .update({
          total_duration_seconds:
            existingStats.total_duration_seconds + durationSeconds,
          last_seen_at: endTime.toISOString(),
        })
        .eq('user_id', userId);

      if (updateStatsError) {
        console.error('Error updating user stats:', updateStatsError);
        // Don't fail the request if stats update fails
      }
    } else {
      // Create new stats
      const { error: insertStatsError } = await supabase
        .from('user_stats')
        .insert({
          user_id: userId,
          total_duration_seconds: durationSeconds,
          last_seen_at: endTime.toISOString(),
        });

      if (insertStatsError) {
        console.error('Error creating user stats:', insertStatsError);
        // Don't fail the request if stats creation fails
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: activeSession.id,
      duration: durationSeconds,
    });
  } catch (error) {
    console.error('Error in close session API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
