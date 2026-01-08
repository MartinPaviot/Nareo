import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

/**
 * GET /api/courses/[courseId]/note/status
 * Get current note generation status and progress
 * Used for polling during note generation
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
    // Get course with note progress fields
    const { data: course, error: courseError } = await admin
      .from('courses')
      .select(`
        id,
        title,
        note_status,
        note_progress,
        note_current_step,
        note_section_index,
        note_total_sections,
        note_error_message,
        note_started_at,
        note_completed_at,
        note_partial_content,
        aplus_note,
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
    if (course.note_status === 'generating' && course.note_started_at) {
      const startedAt = new Date(course.note_started_at);
      elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    }

    // Check if note content exists
    const hasContent = !!course.aplus_note && course.aplus_note.trim().length > 0;

    return NextResponse.json({
      status: course.note_status || 'pending',
      progress: course.note_progress || 0,
      currentStep: course.note_current_step || null,
      sectionIndex: course.note_section_index || null,
      totalSections: course.note_total_sections || null,
      errorMessage: course.note_error_message || null,
      startedAt: course.note_started_at || null,
      completedAt: course.note_completed_at || null,
      elapsedSeconds,
      hasContent,
      // Include content when ready so client can display it
      content: course.note_status === 'ready' ? course.aplus_note : null,
      // Include partial content during generation for live streaming display
      partialContent: course.note_status === 'generating' ? course.note_partial_content : null,
    });

  } catch (error: any) {
    console.error('Error fetching note status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch note status' },
      { status: 500 }
    );
  }
}
