import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * PATCH /api/stats/user/goal-level
 * Update user's daily goal level preference
 */
export async function PATCH(request: NextRequest) {
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
    const { level } = body;

    if (!level || !['tranquille', 'standard', 'intensif'].includes(level)) {
      return NextResponse.json(
        { error: 'Invalid goal level. Must be one of: tranquille, standard, intensif' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('user_gamification')
      .update({
        daily_goal_level: level,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating goal level:', updateError);
      return NextResponse.json({ error: 'Failed to update goal level' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      level,
    });
  } catch (error) {
    console.error('Error in goal level API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
