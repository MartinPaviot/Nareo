import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/flashcards/record-session
 * Record flashcard session activity for daily goal tracking
 * Updates activity_units in daily_activity table
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
    const { hard = 0, good = 0, easy = 0, courseId = null } = body;

    // Validate input
    if (hard < 0 || good < 0 || easy < 0) {
      return NextResponse.json({ error: 'Invalid counts' }, { status: 400 });
    }

    const totalReviewed = hard + good + easy;
    if (totalReviewed === 0) {
      return NextResponse.json({
        success: true,
        result: {
          flashcards_reviewed: 0,
          activity_units_added: 0,
          current_activity_units: 0,
          goal_completed: false,
          goal_just_completed: false,
          xp_earned: 0,
          total_xp_with_bonus: 0,
        }
      });
    }

    // Call RPC function to record activity and update daily goal
    const { data: result, error } = await supabase.rpc('record_flashcard_session_activity', {
      p_user_id: user.id,
      p_hard: hard,
      p_good: good,
      p_easy: easy,
      p_course_id: courseId,
    });

    if (error) {
      console.error('Error recording flashcard session:', error);
      return NextResponse.json(
        { error: 'Failed to record session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error in record-session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
