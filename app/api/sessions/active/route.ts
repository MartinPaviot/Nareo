import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
    }

    const userId = auth.user.id;
    const supabase = await createSupabaseServerClient();

    const { data: attempts, error } = await supabase
      .from('quiz_attempts')
      .select('id,chapter_id,course_id,answers,score,completed_at')
      .eq('user_id', userId)
      .is('completed_at', null)
      .order('started_at', { ascending: false });

    if (error) {
      throw error;
    }

    const chapterIds = (attempts || []).map(a => a.chapter_id);
    const { data: chapters } = chapterIds.length
      ? await supabase.from('chapters').select('id,title,summary,english_title,french_title').in('id', chapterIds)
      : { data: [] as any[] };

    const chapterMap = new Map((chapters || []).map(ch => [ch.id, ch]));

    const sessions = (attempts || []).map(attempt => ({
      id: attempt.id,
      chapter_id: attempt.chapter_id,
      current_question: (attempt.answers || []).length + 1,
      last_activity: new Date().toISOString(),
      chapter: chapterMap.get(attempt.chapter_id) || null,
      progress: {
        score: attempt.score ?? 0,
        currentQuestion: (attempt.answers || []).length + 1,
        questionsAnswered: (attempt.answers || []).length,
        completed: false,
      },
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error in active sessions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
