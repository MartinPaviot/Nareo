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

    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();

    const { data: concept, error } = await supabase
      .from('concepts')
      .select('id,chapter_id,course_id,title,description,importance,source_text')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!concept) {
      return NextResponse.json({ error: 'Concept not found' }, { status: 404 });
    }

    const { data: courseMeta } = await supabase
      .from('courses')
      .select('id,content_language,language')
      .eq('id', concept.course_id)
      .maybeSingle();

    return NextResponse.json({
      id: concept.id,
      chapterId: concept.chapter_id,
      courseId: concept.course_id,
      title: concept.title,
      description: concept.description,
      difficulty: concept.importance >= 3 ? 'hard' : concept.importance === 2 ? 'medium' : 'easy',
      orderIndex: 0,
      progress: {
        conceptId: concept.id,
        phase1Score: 0,
        phase2Score: 0,
        phase3Score: 0,
        totalScore: 0,
        badge: null,
        completed: false,
      },
      chatHistory: [],
      content_language: courseMeta?.content_language || courseMeta?.language || 'en',
    });
  } catch (error) {
    console.error('Error fetching concept:', error);
    return NextResponse.json(
      { error: 'Failed to fetch concept' },
      { status: 500 }
    );
  }
}
