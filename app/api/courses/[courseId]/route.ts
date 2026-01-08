import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * DELETE /api/courses/[courseId]
 * Delete a course and all related data (chapters, questions, progress)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId } = await params;

    // Verify the course belongs to the user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, user_id')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (course.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Call the cascade delete function
    const { error: deleteError } = await supabase.rpc('delete_course_cascade', {
      course_id_param: courseId,
    });

    if (deleteError) {
      console.error('Error deleting course:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete course' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete course API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/courses/[courseId]
 * Update course properties (editable_title, quiz_status, quiz_config)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId } = await params;
    const body = await request.json();
    const { editable_title, quiz_status, quiz_config } = body;

    // Validation for editable_title
    if (editable_title !== undefined) {
      if (typeof editable_title !== 'string') {
        return NextResponse.json(
          { error: 'Invalid title format' },
          { status: 400 }
        );
      }

      const trimmed = editable_title.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: 'Title cannot be empty' },
          { status: 400 }
        );
      }

      if (trimmed.length > 100) {
        return NextResponse.json(
          { error: 'Title is too long (max 100 characters)' },
          { status: 400 }
        );
      }
    }

    // Validation for quiz_status
    const validQuizStatuses = ['pending', 'generating', 'ready', 'partial', 'failed'];
    if (quiz_status !== undefined && !validQuizStatuses.includes(quiz_status)) {
      return NextResponse.json(
        { error: 'Invalid quiz_status' },
        { status: 400 }
      );
    }

    // Verify the course belongs to the user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, user_id')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (course.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};
    if (editable_title !== undefined) {
      updateData.editable_title = editable_title.trim();
    }
    if (quiz_status !== undefined) {
      updateData.quiz_status = quiz_status;
    }
    if (quiz_config !== undefined) {
      updateData.quiz_config = quiz_config;
    }

    // Update the course
    const { data: updatedCourse, error: updateError } = await supabase
      .from('courses')
      .update(updateData)
      .eq('id', courseId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating course:', updateError);
      return NextResponse.json(
        { error: 'Failed to update course' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, course: updatedCourse });
  } catch (error) {
    console.error('Error in update course API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
