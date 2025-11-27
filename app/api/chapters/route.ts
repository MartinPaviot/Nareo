import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = auth.user.id;

    const [{ data: chapterRows, error: chaptersError }, { data: attemptsRows }] = await Promise.all([
      supabase
        .from('chapters')
        .select('id,course_id,title,summary,difficulty,order_index,importance,source_text,extracted_text,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase.from('quiz_attempts').select('chapter_id,completed_at,score,answers').eq('user_id', userId),
    ]);

    if (chaptersError) {
      throw chaptersError;
    }

    const courseIds = Array.from(new Set((chapterRows || []).map(ch => ch.course_id).filter(Boolean)));
    let courseLanguageMap = new Map<string, string>();
    if (courseIds.length > 0) {
      const { data: courseRows, error: courseError } = await supabase
        .from('courses')
        .select('id,content_language,language')
        .in('id', courseIds);
      if (courseError) throw courseError;
      courseLanguageMap = new Map((courseRows || []).map(course => [course.id, course.content_language || course.language || 'en']));
    }

    const progressMap = new Map<string, any>();
    (attemptsRows || []).forEach(a => {
      progressMap.set(a.chapter_id, {
        chapterId: a.chapter_id,
        score: a.score ?? 0,
        currentQuestion: (a.answers || []).length,
        questionsAnswered: (a.answers || []).length,
        completed: Boolean(a.completed_at),
        answers: a.answers || [],
      });
    });

    const chapters = (chapterRows || []).map(ch => ({
      id: ch.id,
      courseId: ch.course_id,
      title: ch.title,
      summary: ch.summary,
      difficulty: ch.difficulty || 'medium',
      orderIndex: ch.order_index || 0,
      importance: ch.importance || 1,
      questions: [],
      sourceText: ch.source_text,
      englishTitle: ch.title,
      englishDescription: ch.summary,
      frenchTitle: ch.title,
      frenchDescription: ch.summary,
      extractedText: ch.extracted_text,
      content_language: courseLanguageMap.get(ch.course_id) || 'en',
    }));

    const progress = chapters.map(ch => progressMap.get(ch.id) || {
      chapterId: ch.id,
      score: 0,
      currentQuestion: 0,
      questionsAnswered: 0,
      completed: false,
      answers: [],
    });

    return NextResponse.json({ chapters, progress });
  } catch (error) {
    console.error('Error fetching chapters', error);
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
  }
}
