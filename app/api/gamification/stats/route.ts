import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/gamification/stats
 * Get user gamification stats including streak, badges, and daily activity
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
    let { data: gamification, error: gamificationError } = await supabase
      .from('user_gamification')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (gamificationError && gamificationError.code === 'PGRST116') {
      // Record doesn't exist, create it
      const { data: newGamification, error: insertError } = await supabase
        .from('user_gamification')
        .insert({
          user_id: user.id,
          current_streak: 0,
          longest_streak: 0,
          total_points: 0,
          total_quizzes_completed: 0,
          total_chapters_completed: 0,
          total_questions_answered: 0,
          total_questions_correct: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating gamification record:', insertError);
        return NextResponse.json({ error: 'Failed to create gamification record' }, { status: 500 });
      }

      gamification = newGamification;
    } else if (gamificationError) {
      console.error('Error fetching gamification stats:', gamificationError);
      return NextResponse.json({ error: 'Failed to fetch gamification stats' }, { status: 500 });
    }

    // Get user badges
    const { data: userBadges, error: badgesError } = await supabase
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
      .order('earned_at', { ascending: false });

    if (badgesError) {
      console.error('Error fetching badges:', badgesError);
    }

    // Get today's activity
    const today = new Date().toISOString().split('T')[0];
    const { data: todayActivity } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', user.id)
      .eq('activity_date', today)
      .single();

    // Get today's challenge stats
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Get challenges completed today
    const { data: todayChallenges } = await supabase
      .from('challenge_players')
      .select('id, score, challenge:challenges!inner(created_at, status)')
      .eq('user_id', user.id)
      .eq('challenge.status', 'finished')
      .gte('challenge.created_at', todayStart.toISOString())
      .lt('challenge.created_at', todayEnd.toISOString());

    const todayChallengePoints = todayChallenges?.reduce((sum, cp: any) => sum + (cp.score || 0), 0) || 0;
    const todayChallengesCount = todayChallenges?.length || 0;

    // Get challenge answers for today's challenges to count questions
    const todayPlayerIds = todayChallenges?.map((cp: any) => cp.id) || [];
    let todayChallengeQuestions = 0;
    let todayChallengeCorrect = 0;

    if (todayPlayerIds.length > 0) {
      const { data: todayAnswers } = await supabase
        .from('challenge_answers')
        .select('is_correct')
        .in('player_id', todayPlayerIds);

      todayChallengeQuestions = todayAnswers?.length || 0;
      todayChallengeCorrect = todayAnswers?.filter((a: any) => a.is_correct).length || 0;
    }

    // Get last 7 days activity for chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentActivity } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', user.id)
      .gte('activity_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('activity_date', { ascending: true });

    // Combine quiz and challenge stats for today's activity
    const quizActivity = todayActivity || {
      quizzes_completed: 0,
      questions_answered: 0,
      questions_correct: 0,
      points_earned: 0,
      time_spent_minutes: 0,
    };

    const hasChallengeActivity = todayChallengesCount > 0;
    const hasQuizActivity = todayActivity !== null;

    const combinedTodayActivity = (hasQuizActivity || hasChallengeActivity)
      ? {
          activity_date: today,
          // Combine quiz + challenge counts
          quizzes_completed: (quizActivity.quizzes_completed || 0) + todayChallengesCount,
          questions_answered: (quizActivity.questions_answered || 0) + todayChallengeQuestions,
          questions_correct: (quizActivity.questions_correct || 0) + todayChallengeCorrect,
          points_earned: (quizActivity.points_earned || 0) + todayChallengePoints,
          time_spent_minutes: quizActivity.time_spent_minutes || 0,
          // Extra fields for debugging/display
          challenge_points: todayChallengePoints,
          challenges_completed: todayChallengesCount,
        }
      : null;

    return NextResponse.json({
      success: true,
      gamification: {
        current_streak: gamification?.current_streak || 0,
        longest_streak: gamification?.longest_streak || 0,
        last_activity_date: gamification?.last_activity_date,
        total_points: gamification?.total_points || 0,
        total_quizzes_completed: gamification?.total_quizzes_completed || 0,
        total_chapters_completed: gamification?.total_chapters_completed || 0,
        total_questions_answered: gamification?.total_questions_answered || 0,
        total_questions_correct: gamification?.total_questions_correct || 0,
      },
      badges: userBadges || [],
      today_activity: combinedTodayActivity,
      recent_activity: recentActivity || [],
    });
  } catch (error) {
    console.error('Error in gamification stats API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
