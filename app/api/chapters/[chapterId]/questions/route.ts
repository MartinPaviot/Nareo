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

    // Get chapter and verify access (owner, guest-owned, or public ready course)
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('*, courses!inner(*)')
      .eq('id', chapterId)
      .single();

    if (chapterError || !chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const isOwner = (!!userId && chapter.user_id === userId) || (!userId && !chapter.user_id);
    const isPublic = chapter.courses?.is_public === true && chapter.courses?.status === 'ready';
    const isGuestReady = chapter.user_id === null && chapter.courses?.status === 'ready';
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
