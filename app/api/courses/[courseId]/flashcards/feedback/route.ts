import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';

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

    // Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { flashcardId, correct } = body;

    if (!flashcardId || typeof correct !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = auth.user.id;

    // Check if flashcard exists and belongs to user's course
    const { data: flashcard, error: flashcardError } = await supabase
      .from('flashcards')
      .select('id, course_id')
      .eq('id', flashcardId)
      .maybeSingle();

    if (flashcardError || !flashcard) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    // Verify user owns the course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', flashcard.course_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get or create progress record
    const { data: existingProgress } = await supabase
      .from('flashcard_progress')
      .select('correct_count, incorrect_count, mastery')
      .eq('user_id', userId)
      .eq('flashcard_id', flashcardId)
      .maybeSingle();

    const currentCorrect = existingProgress?.correct_count || 0;
    const currentIncorrect = existingProgress?.incorrect_count || 0;

    const newMastery = calculateMastery(currentCorrect, currentIncorrect, correct);
    const nextReview = calculateNextReview(newMastery);

    // Upsert progress
    const { error: upsertError } = await supabase
      .from('flashcard_progress')
      .upsert({
        user_id: userId,
        flashcard_id: flashcardId,
        correct_count: correct ? currentCorrect + 1 : currentCorrect,
        incorrect_count: correct ? currentIncorrect : currentIncorrect + 1,
        mastery: newMastery,
        next_review_at: nextReview.toISOString(),
        last_reviewed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,flashcard_id',
      });

    if (upsertError) {
      console.error('Error updating progress:', upsertError);
      return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
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
