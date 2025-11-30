import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: { courseId: string } } | { params: Promise<{ courseId: string }> }
) {
  try {
    const resolvedParams = "then" in context.params ? await context.params : context.params;
    const auth = await authenticateRequest(request); // optional auth

    const supabase = await createSupabaseServerClient();
    const userId = auth?.user.id || null;
    const courseId = resolvedParams.courseId;

    // Load course (public or owner)
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Access control: allow public ready courses or owner
    const isOwner = (!!userId && course.user_id === userId) || (!userId && !course.user_id);
    const isPublic = course.is_public === true && course.status === 'ready';
    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get chapters for this course
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    if (chaptersError) throw chaptersError;

    // Get user's course access
    const { data: accessData } = userId
      ? await supabase
          .from('user_course_access')
          .select('access_tier')
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .single()
      : { data: null };

    const accessTier = accessData?.access_tier || null;

    // For each chapter, determine access and get progress
    const chaptersWithAccess = await Promise.all(
      (chapters || []).map(async (chapter, index) => {
        // Access logic (guest allowed for chapter 1):
        // Chapter 1 (index 0): always accessible
        // Chapter 2 (index 1): requires auth (signup) or access tier free/paid
        // Chapter 3+ (index 2+): requires paid
        let hasAccess = false;
        if (index === 0) {
          hasAccess = true;
        } else if (index === 1) {
          hasAccess = !!userId || accessTier === 'paid' || accessTier === 'free';
        } else {
          hasAccess = accessTier === 'paid';
        }

        // Get quiz attempts for this chapter
        const { data: attempt } = userId
          ? await supabase
              .from('quiz_attempts')
              .select('*')
              .eq('chapter_id', chapter.id)
              .eq('user_id', userId)
              .order('started_at', { ascending: false })
              .limit(1)
              .single()
          : { data: null };

        // Get question count
        const { count: questionCount } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('chapter_id', chapter.id);

        return {
          id: chapter.id,
          title: chapter.title || `Chapter ${index + 1}`,
          summary: chapter.summary,
          difficulty: chapter.difficulty,
          order_index: chapter.order_index || index,
          question_count: questionCount || 0,
          has_access: hasAccess,
          completed: !!attempt?.completed_at,
          in_progress: !!attempt && !attempt.completed_at,
          score: attempt?.score ?? null,
          content_language: course.content_language || course.language || 'en',
        };
      })
    );

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        status: course.status,
        content_language: course.content_language || course.language || 'en',
      },
      chapters: chaptersWithAccess,
      access_tier: accessTier,
    });
  } catch (error) {
    console.error('Error fetching course chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course chapters' },
      { status: 500 }
    );
  }
}
