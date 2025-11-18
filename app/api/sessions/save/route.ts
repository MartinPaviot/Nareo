import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { chapterId, currentQuestion, chatMessages, sessionState } = body;

    if (!chapterId) {
      return NextResponse.json(
        { error: 'Missing required field: chapterId' },
        { status: 400 }
      );
    }

    console.log('📝 Saving learning session for user:', userId, 'chapter:', chapterId);
    console.log('📊 Session data to save:', {
      currentQuestion,
      messageCount: chatMessages?.length || 0,
      sessionState,
      sampleMessage: chatMessages?.[0],
    });

    // Use authenticated server client for RLS
    const serverClient = await createSupabaseServerClient();

    // Upsert learning session (insert or update if exists)
    const { data, error } = await serverClient
      .from('learning_sessions')
      .upsert(
        {
          user_id: userId,
          chapter_id: chapterId,
          current_question: currentQuestion || 1,
          chat_messages: chatMessages || [],
          session_state: sessionState || 'active',
          last_activity: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,chapter_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving learning session:', error);
      return NextResponse.json(
        { error: 'Failed to save session', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Learning session saved successfully');
    console.log('📊 Saved data:', {
      id: data.id,
      chapterId: data.chapter_id,
      messageCount: data.chat_messages?.length || 0,
    });

    return NextResponse.json({
      success: true,
      session: data,
    });
  } catch (error) {
    console.error('❌ Error in save session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
