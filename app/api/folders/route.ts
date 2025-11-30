import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/folders
 * Fetch all folders for the authenticated user with their courses
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch folders
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true });

    if (foldersError) {
      console.error('Error fetching folders:', foldersError);
      return NextResponse.json(
        { error: 'Failed to fetch folders' },
        { status: 500 }
      );
    }

    // For each folder, fetch its courses with stats
    const foldersWithCourses = await Promise.all(
      (folders || []).map(async (folder) => {
        // Get course IDs in this folder
        const { data: folderCourses } = await supabase
          .from('folder_courses')
          .select('course_id, position')
          .eq('folder_id', folder.id)
          .order('position', { ascending: true });

        if (!folderCourses || folderCourses.length === 0) {
          return {
            ...folder,
            courses: [],
            course_count: 0,
          };
        }

        const courseIds = folderCourses.map((fc) => fc.course_id);

        // Fetch course details
        const { data: coursesData } = await supabase
          .from('courses')
          .select('*')
          .in('id', courseIds);

        if (!coursesData || coursesData.length === 0) {
          return {
            ...folder,
            courses: [],
            course_count: 0,
          };
        }

        // Fetch stats for each course using quiz_attempts (same as /api/courses)
        const coursesWithStats = await Promise.all(
          coursesData.map(async (course: any) => {
            // Get chapter count
            const { count: chapterCount } = await supabase
              .from('chapters')
              .select('*', { count: 'exact', head: true })
              .eq('course_id', course.id);

            // Get quiz attempts for this course
            const { data: attempts, error: attemptsError } = await supabase
              .from('quiz_attempts')
              .select('chapter_id, completed_at, score')
              .eq('course_id', course.id)
              .eq('user_id', user.id);

            // Group attempts by chapter and keep only the latest (by completed_at) for each
            const latestAttemptsByChapter = new Map<string, { score: number; completed_at: string | null }>();
            (attempts || []).forEach((a) => {
              const existing = latestAttemptsByChapter.get(a.chapter_id);
              if (!existing || (a.completed_at && (!existing.completed_at || a.completed_at > existing.completed_at))) {
                latestAttemptsByChapter.set(a.chapter_id, { score: a.score, completed_at: a.completed_at });
              }
            });

            const completedChapters = Array.from(latestAttemptsByChapter.values())
              .filter((a) => a.completed_at)
              .length;

            const inProgressChapters = Array.from(latestAttemptsByChapter.values())
              .filter((a) => !a.completed_at)
              .length;

            // Sum only the latest score per chapter
            const totalScore = Array.from(latestAttemptsByChapter.values()).reduce(
              (sum, a) => sum + (a.score ?? 0),
              0
            );

            return {
              ...course,
              status: course.status,
              chapter_count: chapterCount || 0,
              completed_chapters: completedChapters,
              in_progress_chapters: inProgressChapters,
              user_score: totalScore,
            };
          })
        );

        return {
          ...folder,
          courses: coursesWithStats,
          course_count: coursesWithStats.length,
        };
      })
    );

    return NextResponse.json({ success: true, folders: foldersWithCourses });
  } catch (error) {
    console.error('Error in get folders API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/folders
 * Create a new folder
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
    const { name, color, icon } = body;

    // Validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Folder name cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedName.length > 50) {
      return NextResponse.json(
        { error: 'Folder name is too long (max 50 characters)' },
        { status: 400 }
      );
    }

    // Check for duplicate folder names
    const { data: existing } = await supabase
      .from('folders')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', trimmedName)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A folder with this name already exists' },
        { status: 409 }
      );
    }

    // Get the next position
    const { data: maxPosition } = await supabase
      .from('folders')
      .select('position')
      .eq('user_id', user.id)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = maxPosition ? maxPosition.position + 1 : 0;

    // Create the folder
    const { data: folder, error: createError } = await supabase
      .from('folders')
      .insert({
        user_id: user.id,
        name: trimmedName,
        color: color || '#6366f1',
        icon: icon || '📁',
        position: nextPosition,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating folder:', createError);
      return NextResponse.json(
        { error: 'Failed to create folder' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, folder });
  } catch (error) {
    console.error('Error in create folder API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
