import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/stats/streak/milestones
 * Check and award streak milestones
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

    // Call the RPC function to check milestones
    const { data: result, error: rpcError } = await supabase.rpc('check_streak_milestones', {
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error('Error checking milestones:', rpcError);
      return NextResponse.json({ error: 'Failed to check milestones' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rewards: result || [],
    });
  } catch (error) {
    console.error('Error in milestones API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
