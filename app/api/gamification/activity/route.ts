import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/gamification/activity
 * Record user activity (called after completing a quiz)
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
      quizzes_completed = 0,
      questions_answered = 0,
      questions_correct = 0,
      points_earned = 0,
      time_spent_minutes = 0,
    } = body;

    const today = new Date().toISOString().split('T')[0];

    // Upsert daily activity
    const { data: activity, error: activityError } = await supabase
      .from('daily_activity')
      .upsert(
        {
          user_id: user.id,
          activity_date: today,
          quizzes_completed: quizzes_completed,
          questions_answered: questions_answered,
          questions_correct: questions_correct,
          points_earned: points_earned,
          time_spent_minutes: time_spent_minutes,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,activity_date',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (activityError) {
      console.error('Error upserting daily activity:', activityError);
      return NextResponse.json({ error: 'Failed to record activity' }, { status: 500 });
    }

    // Update user gamification totals
    const { data: gamification, error: gamificationError } = await supabase
      .from('user_gamification')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (gamification) {
      const { error: updateError } = await supabase
        .from('user_gamification')
        .update({
          total_points: (gamification.total_points || 0) + points_earned,
          total_xp: (gamification.total_xp || 0) + points_earned, // Points also count as XP
          total_quizzes_completed: (gamification.total_quizzes_completed || 0) + quizzes_completed,
          total_questions_answered: (gamification.total_questions_answered || 0) + questions_answered,
          total_questions_correct: (gamification.total_questions_correct || 0) + questions_correct,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating gamification stats:', updateError);
      }
    }

    // Fetch newly earned badges (if any)
    const { data: newBadges } = await supabase
      .from('user_badges')
      .select(`
        id,
        earned_at,
        badge:badges (
          id,
          code,
          name_fr,
          name_en,
          name_de,
          description_fr,
          description_en,
          description_de,
          icon,
          rarity
        )
      `)
      .eq('user_id', user.id)
      .gte('earned_at', new Date(Date.now() - 5000).toISOString()) // Earned in last 5 seconds
      .order('earned_at', { ascending: false });

    return NextResponse.json({
      success: true,
      activity,
      new_badges: newBadges || [],
    });
  } catch (error) {
    console.error('Error in record activity API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
