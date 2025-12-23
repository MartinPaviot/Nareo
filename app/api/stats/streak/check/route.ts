import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/stats/streak/check
 * Check and update streak status
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

    // Call the RPC function to check streak
    const { data: result, error: rpcError } = await supabase.rpc('check_and_update_streak', {
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error('Error checking streak:', rpcError);
      return NextResponse.json({ error: 'Failed to check streak' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      result: result || {
        streak_state: 'new_user',
        current_streak: 0,
        longest_streak: 0,
        freezes_available: 1,
        previous_streak_lost: 0,
      },
    });
  } catch (error) {
    console.error('Error in streak check API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
