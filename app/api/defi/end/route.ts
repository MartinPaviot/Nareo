import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';
import { calculateRankBonus, FinalScore } from '@/types/defi';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user (must be host)
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const { challengeCode } = body;

    if (!challengeCode) {
      return NextResponse.json({ error: 'Code du défi requis' }, { status: 400 });
    }

    // Find the challenge
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .eq('code', challengeCode.toUpperCase())
      .maybeSingle();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });
    }

    // Verify user is the host
    if (challenge.host_id !== auth.user.id) {
      return NextResponse.json(
        { error: "Seul l'hôte peut terminer le défi" },
        { status: 403 }
      );
    }

    // Verify challenge is playing
    if (challenge.status !== 'playing' && challenge.status !== 'starting') {
      return NextResponse.json(
        { error: 'Ce défi n\'est pas en cours' },
        { status: 400 }
      );
    }

    // Get all players sorted by score
    const { data: players, error: playersError } = await supabase
      .from('challenge_players')
      .select('*')
      .eq('challenge_id', challenge.id)
      .order('score', { ascending: false });

    if (playersError) {
      console.error('Error fetching players:', playersError);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des joueurs' },
        { status: 500 }
      );
    }

    // Calculate final rankings and bonus points
    const finalScores: FinalScore[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < (players?.length || 0); i++) {
      const player = players![i];
      const rank = i + 1;
      const rankBonus = calculateRankBonus(rank);
      const totalPointsEarned = player.score + rankBonus;

      // Update player with final rank and points
      await supabase
        .from('challenge_players')
        .update({
          final_rank: rank,
          points_earned: totalPointsEarned,
          finished_at: now,
        })
        .eq('id', player.id);

      finalScores.push({
        rank,
        player_id: player.id,
        player_name: player.display_name,
        score: player.score,
        correct_answers: player.correct_answers,
        total_answers: player.total_answers,
        average_time_ms: player.average_response_time_ms || 0,
        points_earned: totalPointsEarned,
      });
    }

    // Update challenge status to finished
    const { error: updateError } = await supabase
      .from('challenges')
      .update({
        status: 'finished',
        finished_at: now,
      })
      .eq('id', challenge.id);

    if (updateError) {
      console.error('Error updating challenge status:', updateError);
    }

    // Get question count for stats
    const { count: questionCount } = await supabase
      .from('challenge_questions')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challenge.id);

    return NextResponse.json({
      success: true,
      challengeId: challenge.id,
      finalScores,
      stats: {
        totalQuestions: questionCount || 0,
        duration: challenge.started_at
          ? Math.round(
              (new Date().getTime() - new Date(challenge.started_at).getTime()) / 1000
            )
          : 0,
      },
    });
  } catch (error) {
    console.error('Error in challenge end:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// GET - Get challenge results
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Get challenge with players
    const { data: challenge, error } = await supabase
      .from('challenges')
      .select(`
        *,
        course:courses(id, title),
        chapter:chapters(id, title),
        players:challenge_players(
          id,
          user_id,
          display_name,
          score,
          correct_answers,
          total_answers,
          best_streak,
          average_response_time_ms,
          final_rank,
          points_earned
        )
      `)
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (error || !challenge) {
      return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });
    }

    // Sort players by final rank
    const sortedPlayers = [...(challenge.players || [])].sort(
      (a: any, b: any) => (a.final_rank || 999) - (b.final_rank || 999)
    );

    // Get question stats
    const { data: questions } = await supabase
      .from('challenge_questions')
      .select('id, question_type')
      .eq('challenge_id', challenge.id);

    const { data: answers } = await supabase
      .from('challenge_answers')
      .select('question_id, is_correct')
      .eq('challenge_id', challenge.id);

    // Calculate per-question stats
    const questionStats = questions?.map((q) => {
      const qAnswers = answers?.filter((a) => a.question_id === q.id) || [];
      const correctCount = qAnswers.filter((a) => a.is_correct).length;
      return {
        questionId: q.id,
        type: q.question_type,
        totalAnswers: qAnswers.length,
        correctAnswers: correctCount,
        successRate: qAnswers.length > 0
          ? Math.round((correctCount / qAnswers.length) * 100)
          : 0,
      };
    });

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        code: challenge.code,
        mode: challenge.mode,
        status: challenge.status,
        courseTitle: challenge.course?.title,
        chapterTitle: challenge.chapter?.title,
        startedAt: challenge.started_at,
        finishedAt: challenge.finished_at,
      },
      players: sortedPlayers,
      stats: {
        totalQuestions: questions?.length || 0,
        questionStats,
        duration: challenge.started_at && challenge.finished_at
          ? Math.round(
              (new Date(challenge.finished_at).getTime() -
                new Date(challenge.started_at).getTime()) /
                1000
            )
          : 0,
      },
    });
  } catch (error) {
    console.error('Error in challenge results GET:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
