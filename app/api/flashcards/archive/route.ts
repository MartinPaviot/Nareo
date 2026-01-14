import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/flashcards/archive
 * Archive or unarchive a flashcard (mark as acquired)
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
    const { flashcardId, archived } = body;

    if (!flashcardId || typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields: flashcardId and archived (boolean)' }, { status: 400 });
    }

    // Upsert the progress record with archive status
    const { data, error } = await supabase
      .from('flashcard_progress')
      .upsert({
        user_id: user.id,
        flashcard_id: flashcardId,
        is_archived: archived,
        archived_at: archived ? new Date().toISOString() : null,
      }, {
        onConflict: 'user_id,flashcard_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error archiving flashcard:', error);
      return NextResponse.json({ error: 'Failed to archive flashcard' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      archived: data.is_archived,
      progress: data,
    });
  } catch (error) {
    console.error('Error in archive API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
