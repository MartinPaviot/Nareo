import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

type Mastery = 'new' | 'learning' | 'reviewing' | 'mastered';

// Calculate next mastery level based on correct/incorrect counts
function calculateMastery(correctCount: number, incorrectCount: number, wasCorrect: boolean): Mastery {
  const newCorrect = wasCorrect ? correctCount + 1 : correctCount;
  const newIncorrect = wasCorrect ? incorrectCount : incorrectCount + 1;

  // Simple spaced repetition logic
  if (newCorrect >= 5 && newCorrect > newIncorrect * 2) {
    return 'mastered';
  } else if (newCorrect >= 3 && newCorrect > newIncorrect) {
    return 'reviewing';
  } else if (newCorrect >= 1) {
    return 'learning';
  }
  return 'new';
}

// Calculate next review time based on mastery
function calculateNextReview(mastery: Mastery): Date {
  const now = new Date();
  switch (mastery) {
    case 'mastered':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    case 'reviewing':
      return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
    case 'learning':
      return new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 1 day
    default:
      return new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    // Try to authenticate user (optional for guest users)
    const auth = await authenticateRequest(request);
    const guestSessionId = getGuestSessionIdFromRequest(request);

    // Must have either authentication or guest session
    if (!auth && !guestSessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { flashcardId, correct } = body;

    if (!flashcardId || typeof correct !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const admin = getServiceSupabase();
    const userId = auth?.user.id || null;

    // Use admin client for guest users to bypass RLS
    const dbClient = auth ? supabase : admin;

    // Check if flashcard exists
    const { data: flashcard, error: flashcardError } = await dbClient
      .from('flashcards')
      .select('id, course_id')
      .eq('id', flashcardId)
      .maybeSingle();

    if (flashcardError || !flashcard) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    // Verify user/guest owns the course
    let course;
    let courseError;

    if (auth) {
      const result = await supabase
        .from('courses')
        .select('id')
        .eq('id', flashcard.course_id)
        .eq('user_id', userId)
        .maybeSingle();
      course = result.data;
      courseError = result.error;
    } else {
      const result = await admin
        .from('courses')
        .select('id')
        .eq('id', flashcard.course_id)
        .is('user_id', null)
        .eq('guest_session_id', guestSessionId)
        .maybeSingle();
      course = result.data;
      courseError = result.error;
    }

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get or create progress record
    let existingProgressQuery = dbClient
      .from('flashcard_progress')
      .select('correct_count, incorrect_count, mastery')
      .eq('flashcard_id', flashcardId);

    if (userId) {
      existingProgressQuery = existingProgressQuery.eq('user_id', userId);
    } else {
      existingProgressQuery = existingProgressQuery
        .is('user_id', null)
        .eq('guest_session_id', guestSessionId);
    }

    const { data: existingProgress } = await existingProgressQuery.maybeSingle();

    const currentCorrect = existingProgress?.correct_count || 0;
    const currentIncorrect = existingProgress?.incorrect_count || 0;

    const newMastery = calculateMastery(currentCorrect, currentIncorrect, correct);
    const nextReview = calculateNextReview(newMastery);

    // Build upsert data
    const progressData: any = {
      flashcard_id: flashcardId,
      correct_count: correct ? currentCorrect + 1 : currentCorrect,
      incorrect_count: correct ? currentIncorrect : currentIncorrect + 1,
      mastery: newMastery,
      next_review_at: nextReview.toISOString(),
      last_reviewed_at: new Date().toISOString(),
    };

    // Set user_id or guest_session_id
    if (userId) {
      progressData.user_id = userId;
    } else {
      progressData.guest_session_id = guestSessionId;
    }

    // Upsert progress - need different conflict handling for guest vs user
    const conflictColumn = userId ? 'user_id,flashcard_id' : 'guest_session_id,flashcard_id';

    // For guests, we need to handle this differently since there might not be a unique constraint
    // First try to find existing, then insert or update
    if (existingProgress) {
      // Update existing
      let updateQuery = dbClient
        .from('flashcard_progress')
        .update({
          correct_count: progressData.correct_count,
          incorrect_count: progressData.incorrect_count,
          mastery: progressData.mastery,
          next_review_at: progressData.next_review_at,
          last_reviewed_at: progressData.last_reviewed_at,
        })
        .eq('flashcard_id', flashcardId);

      if (userId) {
        updateQuery = updateQuery.eq('user_id', userId);
      } else {
        updateQuery = updateQuery.is('user_id', null).eq('guest_session_id', guestSessionId);
      }

      const { error: updateError } = await updateQuery;
      if (updateError) {
        console.error('Error updating progress:', updateError);
        return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
      }
    } else {
      // Insert new
      const { error: insertError } = await dbClient
        .from('flashcard_progress')
        .insert(progressData);

      if (insertError) {
        console.error('Error inserting progress:', insertError);
        return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      progress: {
        mastery: newMastery,
        correctCount: correct ? currentCorrect + 1 : currentCorrect,
        incorrectCount: correct ? currentIncorrect : currentIncorrect + 1,
        nextReviewAt: nextReview.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
}
