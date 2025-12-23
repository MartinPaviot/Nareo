import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { courseId, folderId } = await request.json();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify course belongs to user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('user_id', user.id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Remove from all folders first
    await supabase
      .from('folder_courses')
      .delete()
      .eq('course_id', courseId);

    // If folderId is provided, add to that folder
    if (folderId) {
      // Verify folder belongs to user
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('id')
        .eq('id', folderId)
        .eq('user_id', user.id)
        .single();

      if (folderError || !folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }

      const { error: insertError } = await supabase
        .from('folder_courses')
        .insert({
          folder_id: folderId,
          course_id: courseId,
        });

      if (insertError) {
        console.error('Error adding course to folder:', insertError);
        return NextResponse.json({ error: 'Failed to move course' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in move course API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
