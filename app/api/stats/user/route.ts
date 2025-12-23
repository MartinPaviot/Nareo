import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/stats/user
 * Get user stats including streak state
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

    // Get or create user gamification record
    let { data: stats, error: statsError } = await supabase
      .from('user_gamification')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (statsError && statsError.code === 'PGRST116') {
      // Record doesn't exist, create it
      const { data: newStats, error: insertError } = await supabase
        .from('user_gamification')
        .insert({
          user_id: user.id,
          current_streak: 0,
          longest_streak: 0,
          total_points: 0,
          total_xp: 0,
          streak_freezes_available: 1,
          daily_goal_level: 'standard',
          total_quizzes_completed: 0,
          total_chapters_completed: 0,
          total_questions_answered: 0,
          total_questions_correct: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user stats:', insertError);
        return NextResponse.json({ error: 'Failed to create user stats' }, { status: 500 });
      }

      stats = newStats;
    } else if (statsError) {
      console.error('Error fetching user stats:', statsError);
      return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 });
    }

    // Check and update streak state
    const { data: streakResult, error: streakError } = await supabase.rpc('check_and_update_streak', {
      p_user_id: user.id,
    });

    if (streakError) {
      console.error('Error checking streak:', streakError);
      // Don't fail the request, just return default streak state
    }

    return NextResponse.json({
      success: true,
      stats: {
        user_id: stats?.user_id,
        current_streak: stats?.current_streak || 0,
        longest_streak: stats?.longest_streak || 0,
        streak_freezes_available: stats?.streak_freezes_available || 1,
        total_xp: stats?.total_xp || 0,
        total_points: stats?.total_points || 0,
        daily_goal_level: stats?.daily_goal_level || 'standard',
        last_activity_date: stats?.last_activity_date,
        streak_lost_at: stats?.streak_lost_at,
        previous_streak_before_loss: stats?.previous_streak_before_loss || 0,
        total_quizzes_completed: stats?.total_quizzes_completed || 0,
        total_chapters_completed: stats?.total_chapters_completed || 0,
        total_questions_answered: stats?.total_questions_answered || 0,
        total_questions_correct: stats?.total_questions_correct || 0,
        created_at: stats?.created_at,
        updated_at: stats?.updated_at,
      },
      streakState: streakResult || {
        streak_state: 'new_user',
        current_streak: 0,
        longest_streak: 0,
        freezes_available: 1,
        previous_streak_lost: 0,
      },
    });
  } catch (error) {
    console.error('Error in user stats API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
