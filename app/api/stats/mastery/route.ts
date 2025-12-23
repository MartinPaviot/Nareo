import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/stats/mastery
 * Get chapter mastery data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('course_id');

    // Build query
    let query = supabase
      .from('chapter_mastery')
      .select(`
        *,
        chapter:chapters(title),
        course:courses(title)
      `)
      .eq('user_id', user.id);

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data: mastery, error: masteryError } = await query
      .order('updated_at', { ascending: false });

    if (masteryError) {
      console.error('Error fetching mastery:', masteryError);
      return NextResponse.json({ error: 'Failed to fetch mastery data' }, { status: 500 });
    }

    // Transform data to include chapter/course titles
    const transformedMastery = (mastery || []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      chapter_id: m.chapter_id,
      course_id: m.course_id,
      mastery_level: m.mastery_level,
      total_questions_answered: m.total_questions_answered,
      correct_answers: m.correct_answers,
      last_reviewed_at: m.last_reviewed_at,
      next_review_due: m.next_review_due,
      days_until_degradation: m.days_until_degradation,
      degradation_warning_sent: m.degradation_warning_sent,
      created_at: m.created_at,
      updated_at: m.updated_at,
      chapter_title: m.chapter?.title || 'Unknown Chapter',
      course_title: m.course?.title || 'Unknown Course',
    }));

    return NextResponse.json({
      success: true,
      mastery: transformedMastery,
    });
  } catch (error) {
    console.error('Error in mastery API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
