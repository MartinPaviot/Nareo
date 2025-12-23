import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    // Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    // Get course with note and config
    const { data: course, error } = await supabase
      .from('courses')
      .select('id, aplus_note, note_config')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

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

    // Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Verify course belongs to user
    const { data: course, error: fetchError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching course:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Update the note
    const { error: updateError } = await supabase
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
