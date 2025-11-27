import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { chapterId: id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id,course_id')
      .eq('id', id)
      .maybeSingle();

    if (chapterError || !chapter) {
      return NextResponse.json({ error: 'Chapitre introuvable' }, { status: 404 });
    }

    const { data: attempt } = await supabase
      .from('quiz_attempts')
      .select('id,chapter_id,course_id,score,answers,completed_at')
      .eq('chapter_id', id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (attempt) {
      return NextResponse.json({
        chapterId: attempt.chapter_id,
        score: attempt.score ?? 0,
        currentQuestion: (attempt.answers || []).length,
        questionsAnswered: (attempt.answers || []).length,
        completed: Boolean(attempt.completed_at),
        answers: attempt.answers || [],
      });
    }

    const { data: newAttempt, error: insertError } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id: auth.user.id,
        course_id: chapter.course_id,
        chapter_id: chapter.id,
        answers: [],
        score: 0,
      })
      .select('id,chapter_id,course_id,score,answers,completed_at')
      .maybeSingle();

    if (insertError || !newAttempt) {
      throw insertError;
    }

    return NextResponse.json({
      chapterId: newAttempt.chapter_id,
      score: 0,
      currentQuestion: 0,
      questionsAnswered: 0,
      completed: false,
      answers: [],
    });
  } catch (error) {
    console.error('Error fetching chapter progress', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
