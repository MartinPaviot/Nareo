import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/folders/courses
 * Add a course to a folder
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { folder_id, course_id } = body;

    // Validation
    if (!folder_id || !course_id) {
      return NextResponse.json(
        { error: 'folder_id and course_id are required' },
        { status: 400 }
      );
    }

    // Verify the folder belongs to the user
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id, user_id')
      .eq('id', folder_id)
      .single();

    if (folderError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    if (folder.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the course belongs to the user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, user_id')
      .eq('id', course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (course.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if the course is already in the folder
    const { data: existing } = await supabase
      .from('folder_courses')
      .select('id')
      .eq('folder_id', folder_id)
      .eq('course_id', course_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Course is already in this folder' },
        { status: 409 }
      );
    }

    // Get the next position in the folder
    const { data: maxPosition } = await supabase
      .from('folder_courses')
      .select('position')
      .eq('folder_id', folder_id)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = maxPosition ? maxPosition.position + 1 : 0;

    // Add the course to the folder
    const { data: folderCourse, error: insertError } = await supabase
      .from('folder_courses')
      .insert({
        folder_id,
        course_id,
        position: nextPosition,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding course to folder:', insertError);
      return NextResponse.json(
        { error: 'Failed to add course to folder' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, folder_course: folderCourse });
  } catch (error) {
    console.error('Error in add course to folder API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/courses
 * Remove a course from a folder
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { folder_id, course_id } = body;

    // Validation
    if (!folder_id || !course_id) {
      return NextResponse.json(
        { error: 'folder_id and course_id are required' },
        { status: 400 }
      );
    }

    // Verify the folder belongs to the user
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id, user_id')
      .eq('id', folder_id)
      .single();

    if (folderError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    if (folder.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Remove the course from the folder
    const { error: deleteError } = await supabase
      .from('folder_courses')
      .delete()
      .eq('folder_id', folder_id)
      .eq('course_id', course_id);

    if (deleteError) {
      console.error('Error removing course from folder:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove course from folder' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in remove course from folder API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
