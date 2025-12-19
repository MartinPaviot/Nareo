import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/courses/[courseId]/status
 * Get detailed status of a course including pipeline job status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  // Authenticate user
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getServiceSupabase();

  try {
    // Get course
    const { data: course, error: courseError } = await admin
      .from('courses')
      .select('id, title, status, quiz_status, error_message, created_at, updated_at')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get pipeline job
    const { data: job, error: jobError } = await admin
      .from('pipeline_jobs')
      .select('id, status, stage, attempts, error_message, created_at, updated_at')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get chapters count
    const { count: chaptersCount } = await admin
      .from('chapters')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);

    // Calculate time since job started
    const jobCreatedAt = job?.created_at ? new Date(job.created_at) : null;
    const jobUpdatedAt = job?.updated_at ? new Date(job.updated_at) : null;
    const now = new Date();
    const elapsedSeconds = jobCreatedAt ? Math.floor((now.getTime() - jobCreatedAt.getTime()) / 1000) : null;
    const lastUpdateSeconds = jobUpdatedAt ? Math.floor((now.getTime() - jobUpdatedAt.getTime()) / 1000) : null;

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        status: course.status,
        quiz_status: course.quiz_status,
        error_message: course.error_message,
      },
      job: job ? {
        id: job.id,
        status: job.status,
        stage: job.stage || 'unknown',
        attempts: job.attempts,
        error_message: job.error_message,
        elapsed_seconds: elapsedSeconds,
        last_update_seconds: lastUpdateSeconds,
      } : null,
      chapters_count: chaptersCount || 0,
      debug: {
        course_created: course.created_at,
        course_updated: course.updated_at,
        job_created: job?.created_at,
        job_updated: job?.updated_at,
      }
    });

  } catch (error: any) {
    console.error('Error fetching course status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/courses/[courseId]/status
 * Fix stuck course status - checks if chapters exist and updates status accordingly
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  // Authenticate user
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getServiceSupabase();

  try {
    // Verify course ownership
    const { data: course, error: courseError } = await admin
      .from('courses')
      .select('id, status, user_id')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Count ready chapters
    const { data: chapters, error: chaptersError } = await admin
      .from('chapters')
      .select('id, status')
      .eq('course_id', courseId);

    if (chaptersError) {
      throw chaptersError;
    }

    const readyChapters = chapters?.filter(ch => ch.status === 'ready') || [];
    const hasChapters = readyChapters.length > 0;

    // If course is stuck at 'processing' but has chapters, mark as ready
    if (course.status === 'processing' && hasChapters) {
      const { error: updateError } = await admin
        .from('courses')
        .update({
          status: 'ready',
          chapter_count: readyChapters.length,
        })
        .eq('id', courseId);

      if (updateError) {
        throw updateError;
      }

      // Also update pipeline job if exists
      await admin
        .from('pipeline_jobs')
        .update({ status: 'succeeded', stage: 'done', updated_at: new Date().toISOString() })
        .eq('course_id', courseId)
        .eq('status', 'processing');

      return NextResponse.json({
        success: true,
        message: 'Course status fixed',
        previous_status: course.status,
        new_status: 'ready',
        chapters_count: readyChapters.length,
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Course does not need fixing',
      current_status: course.status,
      chapters_count: readyChapters.length,
    });

  } catch (error: any) {
    console.error('Error fixing course status:', error);
    return NextResponse.json(
      { error: 'Failed to fix course status' },
      { status: 500 }
    );
  }
}
