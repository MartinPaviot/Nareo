import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/stats/daily-activity
 * Get today's activity and recent 7 days
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

    const today = new Date().toISOString().split('T')[0];

    // Get today's activity
    let { data: todayActivity, error: todayError } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', user.id)
      .eq('activity_date', today)
      .single();

    if (todayError && todayError.code !== 'PGRST116') {
      console.error('Error fetching today activity:', todayError);
    }

    // If no activity today, calculate the daily goal
    if (!todayActivity) {
      const { data: goalResult } = await supabase.rpc('calculate_daily_goal', {
        p_user_id: user.id,
      });

      todayActivity = {
        id: null,
        user_id: user.id,
        activity_date: today,
        questions_answered: 0,
        questions_correct: 0,
        time_spent_minutes: 0,
        quizzes_completed: 0,
        perfect_quizzes: 0,
        points_earned: 0,
        longest_correct_streak: 0,
        daily_goal_target: goalResult || 35,
        daily_goal_completed: false,
        goal_completed_at: null,
        xp_earned: 0,
        xp_multiplier_active: false,
        streak_freeze_used: false,
        streak_freeze_used_at: null,
        // Unified activity tracking (quiz + flashcards)
        flashcards_reviewed: 0,
        flashcards_hard: 0,
        flashcards_good: 0,
        flashcards_easy: 0,
        activity_units: 0,
        created_at: null,
        updated_at: null,
      };
    }

    // Get last 7 days activity
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentActivity, error: recentError } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', user.id)
      .gte('activity_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('activity_date', { ascending: false });

    if (recentError) {
      console.error('Error fetching recent activity:', recentError);
    }

    return NextResponse.json({
      success: true,
      today: todayActivity,
      recent: recentActivity || [],
    });
  } catch (error) {
    console.error('Error in daily activity API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
