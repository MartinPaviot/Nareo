import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/stats/record-answer
 * Record a quiz answer with XP calculation
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
    const { chapter_id, course_id, is_correct, current_correct_streak = 0 } = body;

    if (!chapter_id || !course_id || typeof is_correct !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: chapter_id, course_id, is_correct' },
        { status: 400 }
      );
    }

    // Call the RPC function to record the answer
    const { data: result, error: rpcError } = await supabase.rpc('record_quiz_answer_with_xp', {
      p_user_id: user.id,
      p_chapter_id: chapter_id,
      p_course_id: course_id,
      p_is_correct: is_correct,
      p_current_correct_streak: current_correct_streak,
    });

    if (rpcError) {
      console.error('Error recording quiz answer:', rpcError);
      return NextResponse.json({ error: 'Failed to record answer' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      result: result || {
        xp_earned: 0,
        multiplier: 1.0,
        goal_completed: false,
        chapter_in_danger: false,
      },
    });
  } catch (error) {
    console.error('Error in record answer API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
