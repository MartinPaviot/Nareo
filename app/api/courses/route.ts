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

    // Fetch courses
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (coursesError) throw coursesError;

    // For each course, get chapter count and progress
    const coursesWithProgress = await Promise.all(
      (courses || []).map(async (course) => {
        // Get chapters count
        const { count: chapterCount } = await supabase
          .from('chapters')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        // Get quiz attempts for this course
        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('chapter_id, completed_at, score')
          .eq('course_id', course.id)
          .eq('user_id', userId);

        const completedChapters = new Set(
          (attempts || [])
            .filter((a) => a.completed_at)
            .map((a) => a.chapter_id)
        ).size;

        const inProgressChapters = new Set(
          (attempts || [])
            .filter((a) => !a.completed_at)
            .map((a) => a.chapter_id)
        ).size;

        const totalScore = (attempts || []).reduce(
          (sum, a) => sum + (a.score || 0),
          0
        );

        // Get access tier
        const { data: accessData } = await supabase
          .from('user_course_access')
          .select('access_tier')
          .eq('user_id', userId)
          .eq('course_id', course.id)
          .single();

        return {
          id: course.id,
          title: course.title || 'Untitled Course',
          status: course.status,
          content_language: course.content_language || course.language || 'en',
          chapter_count: chapterCount || 0,
          completed_chapters: completedChapters,
          in_progress_chapters: inProgressChapters,
          user_score: totalScore,
          created_at: course.created_at,
          has_access: !!accessData,
          access_tier: accessData?.access_tier || null,
        };
      })
    );

    // Calculate global stats
    const totalChapters = coursesWithProgress.reduce(
      (sum, c) => sum + c.chapter_count,
      0
    );
    const completedChapters = coursesWithProgress.reduce(
      (sum, c) => sum + c.completed_chapters,
      0
    );
    const inProgressChapters = coursesWithProgress.reduce(
      (sum, c) => sum + c.in_progress_chapters,
      0
    );
    const totalScore = coursesWithProgress.reduce(
      (sum, c) => sum + c.user_score,
      0
    );

    return NextResponse.json({
      success: true,
      courses: coursesWithProgress,
      stats: {
        totalChapters,
        completedChapters,
        inProgressChapters,
        totalScore: Math.round(totalScore),
      },
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}
