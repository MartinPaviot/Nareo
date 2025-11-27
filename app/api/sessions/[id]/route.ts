import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: chapterId } = await context.params;
    const supabase = await createSupabaseServerClient();

    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id,course_id,title')
      .eq('id', chapterId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (chapterError || !chapter) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data: attempt } = await supabase
      .from('quiz_attempts')
      .select('id,score,answers,completed_at')
      .eq('chapter_id', chapterId)
      .eq('user_id', auth.user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const totalScore = attempt?.score ?? 0;
    const answers = attempt?.answers || [];

    return NextResponse.json({
      id: attempt?.id ?? chapterId,
      chapterId,
      totalScore,
      conceptsCompleted: answers.length > 0 ? 1 : 0,
      totalConcepts: 1,
      timeSpent: 0,
      voiceUsed: false,
      concepts: [
        {
          id: chapterId,
          title: chapter.title,
          score: totalScore,
          badge: null,
          difficulty: 'medium',
        },
      ],
      masteryPercentage: answers.length > 0 ? Math.min(100, totalScore) : 0,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
