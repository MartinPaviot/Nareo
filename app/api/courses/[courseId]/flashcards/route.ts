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

// POST - Create a new flashcard manually
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

    const supabase = await createSupabaseServerClient();

    // Check course exists and belongs to user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
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

    // Parse request body
    const body = await request.json();
    const { front, back, type = 'definition' } = body;

    if (!front || !back) {
      return NextResponse.json({ error: 'Front and back are required' }, { status: 400 });
    }

    // Validate type against allowed values in database
    const validTypes = ['definition', 'formula', 'condition', 'intuition', 'link'];
    const flashcardType = validTypes.includes(type) ? type : 'definition';

    // Create the flashcard
    const flashcardId = crypto.randomUUID();
    const { data: flashcard, error: insertError } = await supabase
      .from('flashcards')
      .insert({
        id: flashcardId,
        course_id: courseId,
        type: flashcardType,
        front: front.trim(),
        back: back.trim(),
        chapter_id: null, // Manual flashcards are not linked to a chapter
      })
      .select('id, type, front, back, chapter_id, created_at')
      .single();

    if (insertError) {
      console.error('Error creating flashcard:', insertError);
      return NextResponse.json({ error: 'Failed to create flashcard' }, { status: 500 });
    }

    return NextResponse.json({
      flashcard: {
        id: flashcard.id,
        type: flashcard.type,
        front: flashcard.front,
        back: flashcard.back,
        chapterId: flashcard.chapter_id,
        mastery: 'new',
        correctCount: 0,
        incorrectCount: 0,
      },
    });
  } catch (error) {
    console.error('Error in flashcards POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a flashcard
export async function PUT(
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
      .select('id')
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

    // Parse request body
    const body = await request.json();
    const { flashcardId, front, back } = body;

    if (!flashcardId) {
      return NextResponse.json({ error: 'Flashcard ID is required' }, { status: 400 });
    }

    if (!front || !back) {
      return NextResponse.json({ error: 'Front and back are required' }, { status: 400 });
    }

    // Update the flashcard
    const { data: flashcard, error: updateError } = await supabase
      .from('flashcards')
      .update({
        front: front.trim(),
        back: back.trim(),
      })
      .eq('id', flashcardId)
      .eq('course_id', courseId)
      .select('id, type, front, back, chapter_id, created_at')
      .single();

    if (updateError) {
      console.error('Error updating flashcard:', updateError);
      return NextResponse.json({ error: 'Failed to update flashcard' }, { status: 500 });
    }

    if (!flashcard) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    return NextResponse.json({
      flashcard: {
        id: flashcard.id,
        type: flashcard.type,
        front: flashcard.front,
        back: flashcard.back,
        chapterId: flashcard.chapter_id,
      },
    });
  } catch (error) {
    console.error('Error in flashcards PUT route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a flashcard
export async function DELETE(
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

    // Get flashcard ID from query params
    const { searchParams } = new URL(request.url);
    const flashcardId = searchParams.get('flashcardId');

    if (!flashcardId) {
      return NextResponse.json({ error: 'Flashcard ID is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Check course exists and belongs to user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
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

    // Delete flashcard progress first (foreign key constraint)
    await supabase
      .from('flashcard_progress')
      .delete()
      .eq('flashcard_id', flashcardId);

    // Delete the flashcard
    const { error: deleteError } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', flashcardId)
      .eq('course_id', courseId);

    if (deleteError) {
      console.error('Error deleting flashcard:', deleteError);
      return NextResponse.json({ error: 'Failed to delete flashcard' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in flashcards DELETE route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
