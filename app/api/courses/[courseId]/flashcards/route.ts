import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';

export async function GET(
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

    const supabase = await createSupabaseServerClient();

    // Check course exists and belongs to user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, flashcards_status')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (courseError) {
      console.error('Error fetching course:', courseError);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Fetch flashcards from dedicated table
    const { data: flashcards, error: flashcardsError } = await supabase
      .from('flashcards')
      .select('id, type, front, back, chapter_id, created_at')
      .eq('course_id', courseId)
      .order('created_at', { ascending: true });

    if (flashcardsError) {
      console.error('Error fetching flashcards:', flashcardsError);
      return NextResponse.json({ error: 'Failed to fetch flashcards' }, { status: 500 });
    }

    // Fetch user progress for these flashcards
    const flashcardIds = flashcards?.map(f => f.id) || [];
    let progressMap: Record<string, { mastery: string; correctCount: number; incorrectCount: number }> = {};

    if (flashcardIds.length > 0) {
      const { data: progress } = await supabase
        .from('flashcard_progress')
        .select('flashcard_id, mastery, correct_count, incorrect_count')
        .eq('user_id', auth.user.id)
        .in('flashcard_id', flashcardIds);

      if (progress) {
        progressMap = progress.reduce((acc, p) => {
          acc[p.flashcard_id] = {
            mastery: p.mastery || 'new',
            correctCount: p.correct_count || 0,
            incorrectCount: p.incorrect_count || 0,
          };
          return acc;
        }, {} as Record<string, { mastery: string; correctCount: number; incorrectCount: number }>);
      }
    }

    // Merge flashcards with progress
    const flashcardsWithProgress = (flashcards || []).map(fc => ({
      id: fc.id,
      type: fc.type,
      front: fc.front,
      back: fc.back,
      chapterId: fc.chapter_id,
      mastery: progressMap[fc.id]?.mastery || 'new',
      correctCount: progressMap[fc.id]?.correctCount || 0,
      incorrectCount: progressMap[fc.id]?.incorrectCount || 0,
    }));

    return NextResponse.json({
      flashcards: flashcardsWithProgress,
      status: course.flashcards_status || 'pending',
      count: flashcardsWithProgress.length,
    });
  } catch (error) {
    console.error('Error in flashcards route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
