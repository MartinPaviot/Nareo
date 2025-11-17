import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    console.log('🔐 Resuming session:', id, 'for user:', userId);

    // Use authenticated server client for RLS
    const serverClient = await createSupabaseServerClient();

    // Get the learning session
    const { data: session, error: sessionError } = await serverClient
      .from('learning_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)  // Ensure user owns this session
      .maybeSingle();

    if (sessionError || !session) {
      console.error('❌ Error fetching learning session:', sessionError);
      return NextResponse.json(
        { error: 'Session not found', details: sessionError?.message },
        { status: 404 }
      );
    }

    // Get chapter details
    const { data: chapter, error: chapterError } = await serverClient
      .from('chapters')
      .select('*')
      .eq('id', session.chapter_id)
      .maybeSingle();

    if (chapterError || !chapter) {
      console.error('❌ Error fetching chapter:', chapterError);
      return NextResponse.json(
        { error: 'Chapter not found', details: chapterError?.message },
        { status: 404 }
      );
    }

    // Update session state to active and last_activity
    const { error: updateError } = await serverClient
      .from('learning_sessions')
      .update({
        session_state: 'active',
        last_activity: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateError) {
      console.error('❌ Error updating session:', updateError);
    }

    console.log('✅ Session resumed successfully');

    return NextResponse.json({
      session: {
        ...session,
        chapter,
      },
    });
  } catch (error) {
    console.error('❌ Error in resume session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
