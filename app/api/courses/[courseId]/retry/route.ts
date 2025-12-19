import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { processCourseJob } from '@/lib/backend/course-pipeline';

/**
 * POST /api/courses/[courseId]/retry
 * Retry processing a stuck course
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
    // Get course and check ownership
    const { data: course, error: courseError } = await admin
      .from('courses')
      .select('id, status, user_id')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Only retry if course is stuck (pending or processing for too long)
    if (course.status === 'ready') {
      return NextResponse.json({
        message: 'Course already processed',
        status: course.status
      });
    }

    // Get the pipeline job for this course
    const { data: job, error: jobError } = await admin
      .from('pipeline_jobs')
      .select('id, status, attempts, updated_at')
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (jobError) {
      console.error('Error fetching pipeline job:', jobError);
    }

    // Check if job exists and is stuck
    const isStuck = !job ||
      job.status === 'failed' ||
      (job.status === 'processing' && new Date(job.updated_at).getTime() < Date.now() - 5 * 60 * 1000); // 5 min timeout

    if (!isStuck && job?.status === 'processing') {
      return NextResponse.json({
        message: 'Course is still processing',
        status: 'processing',
        jobId: job.id
      });
    }

    // Create new job or reset existing one
    let jobId = job?.id;

    if (!job) {
      // Create a new pipeline job
      const { data: newJob, error: newJobError } = await admin
        .from('pipeline_jobs')
        .insert({
          course_id: courseId,
          user_id: auth.user.id,
          status: 'pending',
          attempts: 0
        })
        .select('id')
        .single();

      if (newJobError) {
        console.error('Error creating pipeline job:', newJobError);
        return NextResponse.json({ error: 'Failed to create retry job' }, { status: 500 });
      }

      jobId = newJob.id;
    } else {
      // Reset existing job
      await admin
        .from('pipeline_jobs')
        .update({
          status: 'pending',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);
    }

    // Reset course status
    await admin
      .from('courses')
      .update({ status: 'pending', error_message: null })
      .eq('id', courseId);

    // Process in background
    if (jobId) {
      after(async () => {
        try {
          console.log(`[retry] Starting retry processing for job ${jobId}`);
          await processCourseJob(jobId);
          console.log(`[retry] Retry processing completed for job ${jobId}`);
        } catch (err) {
          console.error(`[retry] Retry processing failed for job ${jobId}:`, err);
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Course processing restarted',
      jobId
    });

  } catch (error: any) {
    console.error('Error retrying course:', error);
    return NextResponse.json(
      { error: 'Failed to retry course processing' },
      { status: 500 }
    );
  }
}
