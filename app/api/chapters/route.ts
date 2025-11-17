import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      console.warn('⚠️ Unauthorized access attempt to /api/chapters');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;
    console.log('📊 Fetching chapters for user:', userId);

    // Get Supabase SSR client (NOT service role - respects RLS)
    const supabase = await createSupabaseServerClient();

    // Query chapters directly from Supabase with explicit user_id filter
    const { data: chapterRows, error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (chaptersError) {
      console.error('❌ Error fetching chapters from Supabase:', chaptersError);
      return NextResponse.json(
        { error: 'Failed to fetch chapters' },
        { status: 500 }
      );
    }

    // Query chapter progress directly from Supabase with explicit user_id filter
    const { data: progressRows, error: progressError } = await supabase
      .from('chapter_progress')
      .select('*')
      .eq('user_id', userId);

    if (progressError) {
      console.error('⚠️ Error fetching chapter progress:', progressError);
      // Don't fail the request if progress fetch fails
    }

    // Transform chapters data
    const chapters = (chapterRows || []).map(ch => ({
      id: ch.id,
      title: ch.title,
      summary: ch.summary,
      difficulty: ch.difficulty || 'medium',
      orderIndex: ch.order_index || 0,
      questions: ch.questions || [],
      sourceText: ch.source_text,
      englishTitle: ch.english_title || ch.title,
      englishDescription: ch.english_description || ch.summary,
      frenchTitle: ch.french_title || ch.title,
      frenchDescription: ch.french_description || ch.summary,
    }));

    // Transform progress data
    const progress = (progressRows || []).map(p => ({
      chapterId: p.chapter_id,
      currentQuestion: p.current_question,
      questionsAnswered: p.questions_answered,
      score: p.score,
      completed: p.completed,
      answers: p.answers || [],
    }));

    console.log(`✅ Returning ${chapters.length} chapters and ${progress.length} progress records for user ${userId}`);

    return NextResponse.json({
      chapters,
      progress,
    });
  } catch (error) {
    console.error('❌ Unexpected error in GET /api/chapters:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
