import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/flashcards/reviews/update
 * Update a flashcard's progress after a review
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
      flashcardId,
      rating,
      easeFactor,
      intervalDays,
      nextReviewAt,
      mastery,
      reviewCount,
      correctCount,
      incorrectCount,
    } = body;

    if (!flashcardId || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate rating
    if (!['again', 'hard', 'good', 'easy'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    // Upsert the progress record
    const { data, error } = await supabase
      .from('flashcard_progress')
      .upsert({
        user_id: user.id,
        flashcard_id: flashcardId,
        ease_factor: easeFactor,
        interval_days: intervalDays,
        next_review_at: nextReviewAt,
        mastery: mastery,
        review_count: reviewCount,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        last_rating: rating,
        last_reviewed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,flashcard_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating card progress:', error);
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      progress: data,
    });
  } catch (error) {
    console.error('Error in update progress API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
