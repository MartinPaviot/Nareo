import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get all active and paused learning sessions for the user
    const { data: sessions, error: sessionsError } = await supabase
      .from('learning_sessions')
      .select('*')
      .eq('user_id', userId)
      .in('session_state', ['active', 'paused'])
      .order('last_activity', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching learning sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch sessions', details: sessionsError.message },
        { status: 500 }
      );
    }

    // Get chapter details for each session
    const sessionsWithChapters = await Promise.all(
      (sessions || []).map(async (session) => {
        const { data: chapter } = await supabase
          .from('chapters')
          .select('id, title, summary')
          .eq('id', session.chapter_id)
          .single();

        // Get progress for this chapter
        const { data: progress } = await supabase
          .from('chapter_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('chapter_id', session.chapter_id)
          .single();

        return {
          ...session,
          chapter,
          progress,
        };
      })
    );

    return NextResponse.json({
      sessions: sessionsWithChapters,
    });
  } catch (error) {
    console.error('Error in active sessions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
