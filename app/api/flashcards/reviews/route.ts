import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/flashcards/reviews
 * Get flashcards due for review today
 * Optional: ?courseId=xxx to filter by course
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

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    const now = new Date().toISOString();

    // Step 1: Get flashcard progress for this user that are due
    const { data: progressData, error: progressError } = await supabase
      .from('flashcard_progress')
      .select('*')
      .eq('user_id', user.id)
      .lte('next_review_at', now)
      .order('next_review_at', { ascending: true });

    if (progressError) {
      console.error('Error fetching progress:', progressError);
      return NextResponse.json({
        error: 'Failed to fetch review cards',
        details: progressError.message || progressError.code || 'Unknown error'
      }, { status: 500 });
    }

    if (!progressData || progressData.length === 0) {
      return NextResponse.json({
        success: true,
        cards: [],
        count: 0,
      });
    }

    // Step 2: Get the flashcard IDs and fetch flashcards separately
    const flashcardIds = progressData.map(p => p.flashcard_id);

    const { data: flashcardsData, error: flashcardsError } = await supabase
      .from('flashcards')
      .select(`
        id,
        front,
        back,
        type,
        course_id,
        chapter_id,
        course:courses(id, title)
      `)
      .in('id', flashcardIds);

    if (flashcardsError) {
      console.error('Error fetching flashcards:', flashcardsError);
      return NextResponse.json({
        error: 'Failed to fetch flashcards',
        details: flashcardsError.message || flashcardsError.code || 'Unknown error'
      }, { status: 500 });
    }

    // Create a map of flashcards by ID
    const flashcardsMap = new Map(flashcardsData?.map(f => [f.id, f]) || []);

    // Combine progress with flashcard data
    let cards = progressData
      .map(p => {
        const flashcard = flashcardsMap.get(p.flashcard_id);
        if (!flashcard) return null;
        return {
          ...flashcard,
          progress: {
            ease_factor: p.ease_factor,
            interval_days: p.interval_days,
            next_review_at: p.next_review_at,
            review_count: p.review_count,
            correct_count: p.correct_count,
            incorrect_count: p.incorrect_count,
            last_rating: p.last_rating,
            mastery: p.mastery,
          }
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (courseId) {
      cards = cards.filter(c => c.course_id === courseId);
    }

    return NextResponse.json({
      success: true,
      cards,
      count: cards.length,
    });
  } catch (error) {
    console.error('Error in reviews API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
