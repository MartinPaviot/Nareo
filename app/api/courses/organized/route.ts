import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to use RPC function if available
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_courses_by_folder', { p_user_id: user.id });

    if (!rpcError && rpcData) {
      return NextResponse.json(rpcData);
    }

    // Fallback: manual query if RPC not available
    // Get folders
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true });

    if (foldersError) {
      console.error('Error fetching folders:', foldersError);
    }

    // Get all courses
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .order('created_at', { ascending: false });

    if (coursesError) {
      console.error('Error fetching courses:', coursesError);
    }

    // Get folder-course associations
    const { data: folderCourses, error: fcError } = await supabase
      .from('folder_courses')
      .select('folder_id, course_id');

    if (fcError) {
      console.error('Error fetching folder courses:', fcError);
    }

    // Get chapter counts
    const { data: chapterCounts } = await supabase
      .from('chapters')
      .select('course_id');

    // Build course ID to folder ID map
    const courseToFolder = new Map<string, string>();
    (folderCourses || []).forEach(fc => {
      courseToFolder.set(fc.course_id, fc.folder_id);
    });

    // Count chapters per course
    const chapterCountMap = new Map<string, number>();
    (chapterCounts || []).forEach(ch => {
      chapterCountMap.set(ch.course_id, (chapterCountMap.get(ch.course_id) || 0) + 1);
    });

    // Format courses
    const formatCourse = (course: any) => ({
      id: course.id,
      name: course.editable_title || course.title,
      file_name: course.title,
      created_at: course.created_at,
      last_studied_at: course.last_studied_at || null,
      days_since_study: course.last_studied_at
        ? Math.floor((Date.now() - new Date(course.last_studied_at).getTime()) / (1000 * 60 * 60 * 24))
        : null,
      total_chapters: chapterCountMap.get(course.id) || 0,
      mastered_chapters: 0,
      mastery_percentage: course.overall_mastery_percentage || 0,
      current_chapter: null,
      cards_to_review: course.cards_to_review || 0,
      display_order: course.display_order || 0,
      status: course.status,
    });

    // Build folders with courses
    const foldersWithCourses = (folders || []).map(folder => {
      const folderCourseIds = (folderCourses || [])
        .filter(fc => fc.folder_id === folder.id)
        .map(fc => fc.course_id);

      const folderCoursesData = (courses || [])
        .filter(c => folderCourseIds.includes(c.id))
        .map(formatCourse);

      return {
        id: folder.id,
        name: folder.name,
        color: folder.color || '#F97316',
        icon: folder.icon || 'folder',
        is_collapsed: folder.is_collapsed || false,
        display_order: folder.display_order || folder.position || 0,
        created_at: folder.created_at,
        courses: folderCoursesData,
        course_count: folderCoursesData.length,
      };
    });

    // Get uncategorized courses
    const categorizedCourseIds = new Set((folderCourses || []).map(fc => fc.course_id));
    const uncategorizedCourses = (courses || [])
      .filter(c => !categorizedCourseIds.has(c.id))
      .map(formatCourse);

    return NextResponse.json({
      folders: foldersWithCourses,
      uncategorized: uncategorizedCourses,
    });
  } catch (error) {
    console.error('Error in courses organized API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
