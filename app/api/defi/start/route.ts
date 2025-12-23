import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';
import { MIN_PLAYERS_TO_START } from '@/types/defi';

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

    // Find the challenge and verify host
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select(`
        *,
        players:challenge_players(*)
      `)
      .eq('code', challengeCode.toUpperCase())
      .maybeSingle();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });
    }

    // Verify user is the host
    if (challenge.host_id !== auth.user.id) {
      return NextResponse.json(
        { error: "Seul l'hôte peut démarrer le défi" },
        { status: 403 }
      );
    }

    // Verify challenge is in lobby status
    if (challenge.status !== 'lobby') {
      return NextResponse.json(
        { error: 'Ce défi a déjà démarré ou est terminé' },
        { status: 400 }
      );
    }

    // Verify minimum players
    const playerCount = challenge.players?.length || 0;
    if (playerCount < MIN_PLAYERS_TO_START) {
      return NextResponse.json(
        { error: `Il faut au moins ${MIN_PLAYERS_TO_START} joueurs pour démarrer` },
        { status: 400 }
      );
    }

    // Verify all players are ready (except counting host who is always ready)
    const unreadyPlayers = challenge.players?.filter(
      (p: any) => !p.is_ready && p.user_id !== auth.user.id
    );
    if (unreadyPlayers && unreadyPlayers.length > 0) {
      return NextResponse.json(
        { error: 'Tous les joueurs doivent être prêts' },
        { status: 400 }
      );
    }

    // Verify there are questions
    const { count: questionCount } = await supabase
      .from('challenge_questions')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_id', challenge.id);

    if (!questionCount || questionCount === 0) {
      return NextResponse.json(
        { error: 'Aucune question disponible pour ce défi' },
        { status: 400 }
      );
    }

    // Update challenge status to 'starting'
    const { error: updateError } = await supabase
      .from('challenges')
      .update({
        status: 'starting',
        started_at: new Date().toISOString(),
      })
      .eq('id', challenge.id);

    if (updateError) {
      console.error('Error updating challenge status:', updateError);
      return NextResponse.json(
        { error: 'Impossible de démarrer le défi' },
        { status: 500 }
      );
    }

    // Get first question to include in response
    const { data: firstQuestion } = await supabase
      .from('challenge_questions')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('question_index', 0)
      .single();

    return NextResponse.json({
      success: true,
      challengeId: challenge.id,
      questionCount,
      timePerQuestion: challenge.time_per_question,
      firstQuestion,
    });
  } catch (error) {
    console.error('Error in challenge start:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
