import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/stats/streak/use-freeze
 * Manually use a streak freeze
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

    // Check if user has freezes available
    const { data: stats, error: statsError } = await supabase
      .from('user_gamification')
      .select('streak_freezes_available')
      .eq('user_id', user.id)
      .single();

    if (statsError || !stats) {
      return NextResponse.json({ error: 'Failed to get user stats' }, { status: 500 });
    }

    if (stats.streak_freezes_available <= 0) {
      return NextResponse.json(
        { success: false, error: 'No streak freezes available' },
        { status: 400 }
      );
    }

    // Decrement freezes
    const { error: updateError } = await supabase
      .from('user_gamification')
      .update({
        streak_freezes_available: stats.streak_freezes_available - 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error using streak freeze:', updateError);
      return NextResponse.json({ error: 'Failed to use streak freeze' }, { status: 500 });
    }

    // Mark today as freeze used
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('daily_activity')
      .upsert({
        user_id: user.id,
        activity_date: today,
        streak_freeze_used: true,
        streak_freeze_used_at: new Date().toISOString(),
        daily_goal_target: 0,
      }, {
        onConflict: 'user_id,activity_date',
      });

    return NextResponse.json({
      success: true,
      freezes_remaining: stats.streak_freezes_available - 1,
    });
  } catch (error) {
    console.error('Error in use freeze API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
