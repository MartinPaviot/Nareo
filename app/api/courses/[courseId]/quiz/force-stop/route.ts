import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';

/**
 * Force stop a stuck quiz generation
 * This endpoint allows users to stop a quiz generation that has been running too long
 * It will mark the quiz as 'partial' if some questions exist, or 'failed' if none
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getServiceSupabase();

  try {
    // Verify the course belongs to the user and is in 'generating' status
    const { data: course, error: courseError } = await admin
      .from('courses')
      .select('id, quiz_status, user_id, quiz_started_at')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Only owner can force stop
    if (course.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Only stop if actually generating
    if (course.quiz_status !== 'generating') {
      return NextResponse.json({
        message: 'Quiz is not currently generating',
        status: course.quiz_status,
      });
    }

    // Count how many questions were generated
    const { data: chapters } = await admin
      .from('chapters')
      .select('id')
      .eq('course_id', courseId);

    const chapterIds = chapters?.map(ch => ch.id) || [];

    const { count: questionCount } = await admin
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .in('chapter_id', chapterIds);

    // Determine final status based on what was generated
    const hasQuestions = (questionCount || 0) > 0;
    const finalStatus = hasQuestions ? 'partial' : 'failed';

    // Update course status
    await admin
      .from('courses')
      .update({
        quiz_status: finalStatus,
        quiz_progress: 100,
        quiz_current_step: 'stopped',
        quiz_completed_at: new Date().toISOString(),
        quiz_error_message: hasQuestions
          ? 'Génération interrompue - quiz partiel disponible'
          : 'Génération interrompue - aucune question générée',
      })
      .eq('id', courseId);

    // Mark any 'processing' chapters as failed
    if (chapterIds.length > 0) {
      await admin
        .from('chapters')
        .update({ status: 'failed' })
        .eq('course_id', courseId)
        .eq('status', 'processing');
    }

    console.log(`[quiz-force-stop] Course ${courseId} generation stopped. Status: ${finalStatus}, Questions: ${questionCount || 0}`);

    return NextResponse.json({
      success: true,
      message: hasQuestions
        ? 'Génération arrêtée. Quiz partiel disponible.'
        : 'Génération arrêtée. Vous pouvez relancer la génération.',
      status: finalStatus,
      questionsGenerated: questionCount || 0,
    });

  } catch (error: any) {
    console.error('[quiz-force-stop] Error:', error);
    return NextResponse.json(
      { error: 'Failed to stop quiz generation' },
      { status: 500 }
    );
  }
}
