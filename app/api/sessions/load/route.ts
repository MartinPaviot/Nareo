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
    const searchParams = request.nextUrl.searchParams;
    const chapterId = searchParams.get('chapterId');

    if (!chapterId) {
      return NextResponse.json(
        { error: 'Missing required parameter: chapterId' },
        { status: 400 }
      );
    }

    console.log('📚 Loading learning session for user:', userId, 'chapter:', chapterId);

    // Use authenticated server client for RLS
    const serverClient = await createSupabaseServerClient();

    // Load learning session
    const { data, error } = await serverClient
      .from('learning_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error loading learning session:', error);
      return NextResponse.json(
        { error: 'Failed to load session', details: error.message },
        { status: 500 }
      );
    }

    // If no session found, return null
    if (!data) {
      console.log('ℹ️ No saved session found for chapter:', chapterId);
      console.log('🔍 Checking all sessions for user:', userId);

      // Debug: Check if there are any sessions at all
      const { data: allSessions, error: debugError } = await serverClient
        .from('learning_sessions')
        .select('*')
        .eq('user_id', userId);

      if (!debugError && allSessions) {
        console.log('📊 Found', allSessions.length, 'total sessions for user');
        allSessions.forEach((session: any) => {
          console.log('  - Chapter ID:', session.chapter_id, 'Messages:', session.chat_messages?.length || 0);
        });
      }

      return NextResponse.json({
        session: null,
      });
    }

    console.log('✅ Learning session loaded successfully');
    console.log('📊 Session data:', {
      chapterId: data.chapter_id,
      currentQuestion: data.current_question,
      messageCount: data.chat_messages?.length || 0,
      sessionState: data.session_state,
    });

    return NextResponse.json({
      session: {
        id: data.id,
        chapterId: data.chapter_id,
        currentQuestion: data.current_question,
        chatMessages: data.chat_messages || [],
        sessionState: data.session_state,
        lastActivity: data.last_activity,
      },
    });
  } catch (error) {
    console.error('❌ Error in load session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
