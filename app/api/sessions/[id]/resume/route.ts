import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing session ID' },
        { status: 400 }
      );
    }

    // Get the learning session
    const { data: session, error: sessionError } = await supabase
      .from('learning_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      console.error('Error fetching learning session:', sessionError);
      return NextResponse.json(
        { error: 'Session not found', details: sessionError?.message },
        { status: 404 }
      );
    }

    // Get chapter details
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', session.chapter_id)
      .single();

    if (chapterError || !chapter) {
      console.error('Error fetching chapter:', chapterError);
      return NextResponse.json(
        { error: 'Chapter not found', details: chapterError?.message },
        { status: 404 }
      );
    }

    // Update session state to active and last_activity
    await supabase
      .from('learning_sessions')
      .update({
        session_state: 'active',
        last_activity: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({
      session: {
        ...session,
        chapter,
      },
    });
  } catch (error) {
    console.error('Error in resume session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
