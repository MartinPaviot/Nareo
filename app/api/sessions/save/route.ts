import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, chapterId, currentQuestion, chatMessages, sessionState } = body;

    if (!userId || !chapterId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Upsert learning session (insert or update if exists)
    const { data, error } = await supabase
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
      console.error('Error saving learning session:', error);
      return NextResponse.json(
        { error: 'Failed to save session', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      session: data,
    });
  } catch (error) {
    console.error('Error in save session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
