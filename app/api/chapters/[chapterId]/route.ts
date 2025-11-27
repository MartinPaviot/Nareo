import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chapterId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user.id;
    const { chapterId } = await context.params;
    const supabase = await createSupabaseServerClient();

    const [{ data: chapter, error: chapterError }, { data: questionRows }] = await Promise.all([
      supabase
        .from('chapters')
        .select('id,course_id,title,summary,difficulty,order_index,importance,source_text,extracted_text')
        .eq('id', chapterId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase.from('questions').select('id,question_number,question_text,answer_text,options,type,phase,points').eq('chapter_id', chapterId),
    ]);

    if (chapterError) {
      throw chapterError;
    }

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    const { data: courseMeta } = await supabase
      .from('courses')
      .select('id,content_language,language')
      .eq('id', chapter.course_id)
      .maybeSingle();

    const questions = (questionRows || [])
      .sort((a, b) => (a.question_number || 0) - (b.question_number || 0))
      .map(q => ({
        id: q.id,
        chapterId,
        questionNumber: q.question_number || 1,
        type: q.type === 'mcq' ? 'mcq' : 'open',
        phase: (q.phase as any) || (q.type === 'mcq' ? 'mcq' : 'reflective'),
        question: q.question_text,
        options: q.options || [],
        correctAnswer: q.answer_text,
        points: q.points ?? (q.type === 'mcq' ? 10 : 35),
      }));

    return NextResponse.json({
      id: chapter.id,
      courseId: chapter.course_id,
      title: chapter.title,
      summary: chapter.summary,
      englishTitle: chapter.title,
      englishDescription: chapter.summary,
      frenchTitle: chapter.title,
      frenchDescription: chapter.summary,
      difficulty: chapter.difficulty || 'medium',
      orderIndex: chapter.order_index || 0,
      questions,
      sourceText: chapter.source_text,
      concepts: [],
      extractedText: chapter.extracted_text,
      content_language: courseMeta?.content_language || courseMeta?.language || 'en',
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/chapters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ chapterId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user.id;
    const { chapterId } = await context.params;

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', chapterId)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Chapter deleted successfully',
    });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/chapters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
