import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';

interface Flashcard {
  id: string;
  type: string;
  front: string;
  back: string;
  mastery: 'new' | 'learning' | 'mastered';
  correctCount: number;
  incorrectCount: number;
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

    // Get current flashcards
    const { data: course, error } = await supabase
      .from('courses')
      .select('flashcards')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching course:', error);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const flashcards = (course.flashcards || []) as Flashcard[];
    const cardIndex = flashcards.findIndex((fc) => fc.id === flashcardId);

    if (cardIndex === -1) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    // Update the flashcard
    const card = flashcards[cardIndex];
    const updatedCard: Flashcard = {
      ...card,
      correctCount: correct ? card.correctCount + 1 : card.correctCount,
      incorrectCount: correct ? card.incorrectCount : card.incorrectCount + 1,
      mastery: correct && card.correctCount >= 2 ? 'mastered' : 'learning',
    };

    flashcards[cardIndex] = updatedCard;

    // Save updated flashcards
    const { error: updateError } = await supabase
      .from('courses')
      .update({ flashcards })
      .eq('id', courseId);

    if (updateError) {
      console.error('Error updating flashcards:', updateError);
      return NextResponse.json({ error: 'Failed to update flashcard' }, { status: 500 });
    }

    return NextResponse.json({ success: true, flashcard: updatedCard });
  } catch (error) {
    console.error('Error processing feedback:', error);
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
}
