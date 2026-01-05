import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    // Try to authenticate user (optional for guest users)
    const auth = await authenticateRequest(request);
    const guestSessionId = getGuestSessionIdFromRequest(request);

    // Must have either authentication or guest session
    if (!auth && !guestSessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const admin = getServiceSupabase();

    let course;
    let error;

    if (auth) {
      // Authenticated user: must own the course
      const result = await supabase
        .from('courses')
        .select('id, aplus_note, note_config')
        .eq('id', courseId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      course = result.data;
      error = result.error;
    } else {
      // Guest user: course must have no user_id and matching guest_session_id
      const result = await admin
        .from('courses')
        .select('id, aplus_note, note_config')
        .eq('id', courseId)
        .is('user_id', null)
        .eq('guest_session_id', guestSessionId)
        .maybeSingle();
      course = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error fetching course:', error);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({
      content: course.aplus_note || null,
      config: course.note_config || null,
    });
  } catch (error) {
    console.error('Error in note route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    // Try to authenticate user (optional for guest users)
    const auth = await authenticateRequest(request);
    const guestSessionId = getGuestSessionIdFromRequest(request);

    // Must have either authentication or guest session
    if (!auth && !guestSessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const admin = getServiceSupabase();

    let course;
    let fetchError;

    if (auth) {
      // Authenticated user: must own the course
      const result = await supabase
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      course = result.data;
      fetchError = result.error;
    } else {
      // Guest user: course must have no user_id and matching guest_session_id
      const result = await admin
        .from('courses')
        .select('id')
        .eq('id', courseId)
        .is('user_id', null)
        .eq('guest_session_id', guestSessionId)
        .maybeSingle();
      course = result.data;
      fetchError = result.error;
    }

    if (fetchError) {
      console.error('Error fetching course:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Update the note (use admin client to bypass RLS for guest users)
    const { error: updateError } = await admin
      .from('courses')
      .update({ aplus_note: content })
      .eq('id', courseId);

    if (updateError) {
      console.error('Error updating note:', updateError);
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in note PUT route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
