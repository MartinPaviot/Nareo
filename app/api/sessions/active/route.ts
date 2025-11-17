import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;
    console.log('🔐 Fetching active sessions for user:', userId);

    // Use authenticated server client for RLS
    const serverClient = await createSupabaseServerClient();

    // Get all active and paused learning sessions for the user
    const { data: sessions, error: sessionsError } = await serverClient
      .from('learning_sessions')
      .select('*')
      .eq('user_id', userId)
      .in('session_state', ['active', 'paused'])
      .order('last_activity', { ascending: false });

    if (sessionsError) {
      console.error('❌ Error fetching learning sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch sessions', details: sessionsError.message },
        { status: 500 }
      );
    }

    console.log('✅ Found', sessions?.length || 0, 'active sessions');

    // Get chapter details for each session
    const sessionsWithChapters = await Promise.all(
      (sessions || []).map(async (session) => {
        const { data: chapter } = await serverClient
          .from('chapters')
          .select('id, title, summary')
          .eq('id', session.chapter_id)
          .maybeSingle();

        // Get progress for this chapter
        const { data: progress } = await serverClient
          .from('chapter_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('chapter_id', session.chapter_id)
          .maybeSingle();

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
    console.error('❌ Error in active sessions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
