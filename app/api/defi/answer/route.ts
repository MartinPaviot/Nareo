import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';
import {
  checkAnswer,
  calculatePointsForAnswer,
  QuestionData,
} from '@/types/defi';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const { challengeCode, questionId, answer, responseTimeMs, playerId } = body;

    if (!challengeCode || !questionId || answer === undefined) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    // Check authentication (optional for guests)
    const auth = await authenticateRequest(request);

    // Find the challenge
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, status, current_question_index')
      .eq('code', challengeCode.toUpperCase())
      .maybeSingle();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });
    }

    // Verify challenge is in playing status
    if (challenge.status !== 'playing' && challenge.status !== 'starting') {
      return NextResponse.json(
        { error: 'Ce défi n\'est pas en cours' },
        { status: 400 }
      );
    }

    // Get the question
    const { data: question, error: questionError } = await supabase
      .from('challenge_questions')
      .select('*')
      .eq('id', questionId)
      .eq('challenge_id', challenge.id)
      .maybeSingle();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question introuvable' }, { status: 404 });
    }

    // Find the player
    let playerQuery = supabase
      .from('challenge_players')
      .select('*')
      .eq('challenge_id', challenge.id);

    if (auth?.user.id) {
      playerQuery = playerQuery.eq('user_id', auth.user.id);
    } else if (playerId) {
      playerQuery = playerQuery.eq('id', playerId);
    } else {
      return NextResponse.json(
        { error: 'Joueur non identifié' },
        { status: 400 }
      );
    }

    const { data: player, error: playerError } = await playerQuery.maybeSingle();

    if (playerError || !player) {
      return NextResponse.json(
        { error: 'Vous n\'êtes pas dans ce défi' },
        { status: 403 }
      );
    }

    // Check if player already answered this question
    const { data: existingAnswer } = await supabase
      .from('challenge_answers')
      .select('id')
      .eq('question_id', questionId)
      .eq('player_id', player.id)
      .maybeSingle();

    if (existingAnswer) {
      return NextResponse.json(
        { error: 'Vous avez déjà répondu à cette question' },
        { status: 400 }
      );
    }

    // Check answer correctness
    const questionData = question.question_data as QuestionData;
    const isCorrect = checkAnswer(questionData, String(answer));

    // Calculate streak
    const newStreak = isCorrect ? player.current_streak + 1 : 0;
    const bestStreak = Math.max(player.best_streak, newStreak);

    // Calculate points
    const pointsEarned = calculatePointsForAnswer(
      isCorrect,
      responseTimeMs || 0,
      newStreak
    );

    // Save the answer
    const { data: savedAnswer, error: answerError } = await supabase
      .from('challenge_answers')
      .insert({
        challenge_id: challenge.id,
        question_id: questionId,
        player_id: player.id,
        answer: String(answer),
        is_correct: isCorrect,
        response_time_ms: responseTimeMs || 0,
        points_earned: pointsEarned,
        streak_at_answer: newStreak,
      })
      .select()
      .single();

    if (answerError) {
      console.error('Error saving answer:', answerError);
      return NextResponse.json(
        { error: 'Impossible d\'enregistrer la réponse' },
        { status: 500 }
      );
    }

    // Update player stats
    const { error: updateError } = await supabase
      .from('challenge_players')
      .update({
        score: player.score + pointsEarned,
        correct_answers: player.correct_answers + (isCorrect ? 1 : 0),
        total_answers: player.total_answers + 1,
        current_streak: newStreak,
        best_streak: bestStreak,
        average_response_time_ms: Math.round(
          ((player.average_response_time_ms || 0) * player.total_answers +
            (responseTimeMs || 0)) /
            (player.total_answers + 1)
        ),
      })
      .eq('id', player.id);

    if (updateError) {
      console.error('Error updating player stats:', updateError);
    }

    // Get updated scores for all players
    const { data: allPlayers } = await supabase
      .from('challenge_players')
      .select('id, display_name, score, current_streak')
      .eq('challenge_id', challenge.id)
      .order('score', { ascending: false });

    return NextResponse.json({
      success: true,
      isCorrect,
      pointsEarned,
      newScore: player.score + pointsEarned,
      streak: newStreak,
      correctAnswer: question.correct_answer,
      explanation: questionData.explanation || '',
      leaderboard: allPlayers?.map((p, index) => ({
        rank: index + 1,
        playerId: p.id,
        displayName: p.display_name,
        score: p.score,
        streak: p.current_streak,
      })),
    });
  } catch (error) {
    console.error('Error in challenge answer:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
