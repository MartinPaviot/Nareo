import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/flashcards/reviews/counts
 * Get counts of cards due for review today, grouped by course
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

    const now = new Date().toISOString();

    // Get all cards due for review with their course info
    const { data: progressData, error: progressError } = await supabase
      .from('flashcard_progress')
      .select(`
        flashcard:flashcards(
          course_id,
          course:courses(id, title)
        )
      `)
      .eq('user_id', user.id)
      .lte('next_review_at', now);

    if (progressError) {
      console.error('Error fetching review counts:', progressError);
      return NextResponse.json({ error: 'Failed to fetch review counts' }, { status: 500 });
    }

    // Group by course
    const countsByCourse: Record<string, { course_id: string; course_title: string; count: number }> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    progressData?.forEach((item: any) => {
      const courseId = item.flashcard?.course_id;
      const courseTitle = item.flashcard?.course?.title || 'Sans titre';

      if (courseId) {
        if (!countsByCourse[courseId]) {
          countsByCourse[courseId] = {
            course_id: courseId,
            course_title: courseTitle,
            count: 0,
          };
        }
        countsByCourse[courseId].count++;
      }
    });

    const counts = Object.values(countsByCourse).sort((a, b) => b.count - a.count);
    const totalCount = counts.reduce((sum, c) => sum + c.count, 0);

    return NextResponse.json({
      success: true,
      counts,
      totalCount,
    });
  } catch (error) {
    console.error('Error in review counts API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
