import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';

export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('id');

    if (!challengeId) {
      return NextResponse.json({ error: 'ID du défi manquant' }, { status: 400 });
    }

    // Verify the challenge exists and user is the host
    const { data: challenge, error: fetchError } = await supabase
      .from('challenges')
      .select('id, host_id, status, started_at, created_at')
      .eq('id', challengeId)
      .single();

    if (fetchError || !challenge) {
      return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });
    }

    // Only the host can delete the challenge
    if (challenge.host_id !== auth.user.id) {
      return NextResponse.json(
        { error: "Seul l'hôte peut supprimer ce défi" },
        { status: 403 }
      );
    }

    // Can only delete challenges that are not currently playing
    // Exception: allow deletion if playing for more than 30 minutes (stuck/abandoned)
    if (challenge.status === 'playing') {
      const startedAt = challenge.started_at ? new Date(challenge.started_at) : new Date(challenge.created_at);
      const minutesSinceStart = (Date.now() - startedAt.getTime()) / (1000 * 60);

      if (minutesSinceStart < 30) {
        return NextResponse.json(
          { error: 'Impossible de supprimer un défi en cours' },
          { status: 400 }
        );
      }
      // If playing for more than 30 minutes, allow deletion (stuck game)
      console.log(`[defi/delete] Allowing deletion of stuck challenge (playing for ${Math.round(minutesSinceStart)} minutes)`);
    }

    // Delete related data first (cascade might not be enabled)
    await supabase
      .from('challenge_answers')
      .delete()
      .eq('challenge_id', challengeId);

    await supabase
      .from('challenge_questions')
      .delete()
      .eq('challenge_id', challengeId);

    await supabase
      .from('challenge_players')
      .delete()
      .eq('challenge_id', challengeId);

    // Delete the challenge
    const { error: deleteError, count } = await supabase
      .from('challenges')
      .delete()
      .eq('id', challengeId)
      .select();

    console.log('[defi/delete] Delete result:', { deleteError, count, challengeId });

    if (deleteError) {
      console.error('Error deleting challenge:', deleteError);
      return NextResponse.json(
        { error: 'Impossible de supprimer le défi' },
        { status: 500 }
      );
    }

    // Verify the challenge was actually deleted
    const { data: checkChallenge } = await supabase
      .from('challenges')
      .select('id')
      .eq('id', challengeId)
      .single();

    if (checkChallenge) {
      console.error('[defi/delete] Challenge still exists after delete - RLS policy may be blocking');
      return NextResponse.json(
        { error: 'La suppression a échoué (vérifiez les permissions)' },
        { status: 500 }
      );
    }

    console.log('[defi/delete] Challenge successfully deleted:', challengeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in challenge delete:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
