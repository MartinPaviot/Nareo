import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/flashcards/sessions
 * Save a flashcard session for analytics
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      courseId,
      totalCards,
      cardsHard,
      cardsGood,
      cardsEasy,
      durationSeconds,
      startedAt,
      completedAt,
    } = body;

    // Insert session record
    const { data, error } = await supabase
      .from('flashcard_sessions')
      .insert({
        user_id: user.id,
        course_id: courseId || null,
        total_cards: totalCards,
        cards_hard: cardsHard || 0,
        cards_good: cardsGood || 0,
        cards_easy: cardsEasy || 0,
        duration_seconds: durationSeconds || null,
        started_at: startedAt || new Date().toISOString(),
        completed_at: completedAt || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving session:', error);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: data,
    });
  } catch (error) {
    console.error('Error in sessions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/flashcards/sessions
 * Get user's session history
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const courseId = searchParams.get('courseId');

    let query = supabase
      .from('flashcard_sessions')
      .select(`
        *,
        course:courses(id, title)
      `)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      sessions: data,
    });
  } catch (error) {
    console.error('Error in sessions GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
