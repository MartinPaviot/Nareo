import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';
import { MAX_PLAYERS_PER_CHALLENGE } from '@/types/defi';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const { code, displayName } = body;

    if (!code) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    if (!displayName || displayName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Pseudo requis (minimum 2 caractères)' },
        { status: 400 }
      );
    }

    // Check if user is authenticated (optional for guests)
    const auth = await authenticateRequest(request);
    const userId = auth?.user.id || null;
    const isGuest = !userId;

    // Find the challenge by code
    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select(`
        *,
        course:courses(id, title),
        chapter:chapters(id, title),
        players:challenge_players(id, user_id, display_name)
      `)
      .eq('code', code.toUpperCase().trim())
      .maybeSingle();

    if (challengeError) {
      console.error('Error finding challenge:', challengeError);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    if (!challenge) {
      return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });
    }

    // Check challenge status
    if (challenge.status !== 'lobby') {
      const statusMessages: Record<string, string> = {
        starting: 'Ce défi est en train de démarrer',
        playing: 'Ce défi a déjà commencé',
        finished: 'Ce défi est terminé',
        cancelled: 'Ce défi a été annulé',
      };
      return NextResponse.json(
        { error: statusMessages[challenge.status] || 'Ce défi n\'est plus disponible' },
        { status: 400 }
      );
    }

    // Check player count
    const currentPlayerCount = challenge.players?.length || 0;
    if (currentPlayerCount >= MAX_PLAYERS_PER_CHALLENGE) {
      return NextResponse.json(
        { error: 'Ce défi est complet (maximum 10 joueurs)' },
        { status: 400 }
      );
    }

    // Check if user is already in the challenge (for authenticated users)
    if (userId) {
      const existingPlayer = challenge.players?.find(
        (p: any) => p.user_id === userId
      );
      if (existingPlayer) {
        // User already in challenge, return existing player
        return NextResponse.json({
          challenge: {
            ...challenge,
            players: challenge.players,
          },
          player: existingPlayer,
          alreadyJoined: true,
        });
      }
    }

    // Check for duplicate display name
    const displayNameExists = challenge.players?.some(
      (p: any) => p.display_name.toLowerCase() === displayName.trim().toLowerCase()
    );
    if (displayNameExists) {
      return NextResponse.json(
        { error: 'Ce pseudo est déjà utilisé dans ce défi' },
        { status: 400 }
      );
    }

    // Create the player
    const { data: player, error: playerError } = await supabase
      .from('challenge_players')
      .insert({
        challenge_id: challenge.id,
        user_id: userId,
        display_name: displayName.trim(),
        is_guest: isGuest,
        is_ready: false,
        is_connected: true,
      })
      .select()
      .single();

    if (playerError) {
      console.error('Error creating player:', playerError);
      return NextResponse.json(
        { error: 'Impossible de rejoindre le défi' },
        { status: 500 }
      );
    }

    // Fetch updated challenge with all players
    const { data: updatedChallenge } = await supabase
      .from('challenges')
      .select(`
        *,
        course:courses(id, title),
        chapter:chapters(id, title),
        players:challenge_players(*)
      `)
      .eq('id', challenge.id)
      .single();

    return NextResponse.json({
      challenge: updatedChallenge,
      player,
      alreadyJoined: false,
    });
  } catch (error) {
    console.error('Error in challenge join:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

// GET - Get challenge info by code (for preview before joining)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'Code requis' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data: challenge, error } = await supabase
      .from('challenges')
      .select(`
        id,
        code,
        question_count,
        time_per_question,
        status,
        created_at,
        host_id,
        course:courses(id, title),
        chapter:chapters(id, title),
        players:challenge_players(id, display_name, is_ready)
      `)
      .eq('code', code.toUpperCase().trim())
      .maybeSingle();

    // Fetch host info separately if challenge found
    let hostInfo = null;
    if (challenge?.host_id) {
      const { data: host } = await supabase
        .from('user_profiles')
        .select('display_name, avatar_url')
        .eq('id', challenge.host_id)
        .maybeSingle();
      hostInfo = host;
    }

    if (error) {
      console.error('Error fetching challenge:', error);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    if (!challenge) {
      return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });
    }

    return NextResponse.json({
      challenge: {
        ...challenge,
        host: hostInfo || { display_name: 'Inconnu', avatar_url: null }
      }
    });
  } catch (error) {
    console.error('Error in challenge GET:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
