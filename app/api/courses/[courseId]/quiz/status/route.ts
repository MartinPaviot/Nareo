import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

/**
 * GET /api/courses/[courseId]/quiz/status
 * Get current quiz generation status and progress
 * Used for polling during quiz generation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  // Auth is optional - guests can check status
  const auth = await authenticateRequest(request);
  const guestSessionId = getGuestSessionIdFromRequest(request);
  const admin = getServiceSupabase();

  try {
    // Get course with quiz progress fields
    const { data: course, error: courseError } = await admin
      .from('courses')
      .select(`
        id,
        title,
        quiz_status,
        quiz_progress,
        quiz_questions_generated,
        quiz_total_questions,
        quiz_current_step,
        quiz_error_message,
        quiz_started_at,
        quiz_completed_at,
        user_id,
        guest_session_id,
        is_public
      `)
      .eq('id', courseId)
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check access: user must own the course, be the guest, or course must be public
    const isOwner = auth && course.user_id === auth.user.id;
    const isGuest = !course.user_id && course.guest_session_id === guestSessionId;
    const isPublic = course.is_public;
    const hasAccess = isOwner || isGuest || isPublic;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Calculate elapsed time if generating
    let elapsedSeconds: number | null = null;
    if (course.quiz_status === 'generating' && course.quiz_started_at) {
      const startedAt = new Date(course.quiz_started_at);
      elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    }

    // Get question count if ready/partial
    let questionCount: number | null = null;
    if (course.quiz_status === 'ready' || course.quiz_status === 'partial') {
      const { count } = await admin
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .in('chapter_id', (
          await admin
            .from('chapters')
            .select('id')
            .eq('course_id', courseId)
        ).data?.map(ch => ch.id) || []);
      questionCount = count || 0;
    }

    return NextResponse.json({
      status: course.quiz_status || 'pending',
      progress: course.quiz_progress || 0,
      questionsGenerated: course.quiz_questions_generated || 0,
      totalQuestions: course.quiz_total_questions || 0,
      currentStep: course.quiz_current_step || null,
      errorMessage: course.quiz_error_message || null,
      startedAt: course.quiz_started_at || null,
      completedAt: course.quiz_completed_at || null,
      elapsedSeconds,
      questionCount,
    });

  } catch (error: any) {
    console.error('Error fetching quiz status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz status' },
      { status: 500 }
    );
  }
}
