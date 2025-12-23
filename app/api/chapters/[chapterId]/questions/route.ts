import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: { chapterId: string } } | { params: Promise<{ chapterId: string }> }
) {
  try {
    const auth = await authenticateRequest(request); // optional auth
    const supabase = await createSupabaseServerClient();
    const userId = auth?.user.id || null;
    const resolvedParams = "then" in context.params ? await context.params : context.params;
    const chapterId = resolvedParams.chapterId;

    // Get chapter first (without join to diagnose issues)
    const { data: chapterOnly, error: chapterOnlyError } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', chapterId)
      .single();

    if (chapterOnlyError || !chapterOnly) {
      console.error('Chapter not found (no join):', { chapterId, error: chapterOnlyError });
      return NextResponse.json({ error: 'Chapter not found', chapterId, details: chapterOnlyError?.message }, { status: 404 });
    }

    // Get course info separately to avoid ambiguous relationship error
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', chapterOnly.course_id)
      .single();

    if (courseError || !course) {
      console.error('Course not found for chapter:', { chapterId, courseId: chapterOnly.course_id, error: courseError });
      return NextResponse.json({ error: 'Course not found for chapter', chapterId, courseId: chapterOnly.course_id, details: courseError?.message }, { status: 404 });
    }

    // Combine chapter and course data
    const chapter = { ...chapterOnly, courses: course };

    // Check access - user_id is on courses, not chapters
    const courseUserId = chapter.courses?.user_id;
    const isOwner = (!!userId && courseUserId === userId) || (!userId && !courseUserId);
    const isPublic = chapter.courses?.is_public === true && chapter.courses?.status === 'ready';
    const isGuestReady = courseUserId === null && chapter.courses?.status === 'ready';
    if (!isOwner && !isPublic && !isGuestReady) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get questions for this chapter
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('question_number', { ascending: true });

    if (questionsError) throw questionsError;

    // Get existing quiz attempt if any
    const { data: attempt } = userId
      ? await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('chapter_id', chapterId)
          .eq('user_id', userId)
          .order('started_at', { ascending: false })
          .limit(1)
          .single()
      : { data: null };

    return NextResponse.json({
      success: true,
      chapter: {
        id: chapter.id,
        title: chapter.title,
        course_id: chapter.course_id,
      },
      course: {
        id: chapter.courses?.id,
        title: chapter.courses?.title,
      },
      questions: questions || [],
      attempt: attempt || null,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}
