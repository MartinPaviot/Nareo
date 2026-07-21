import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auditCourse, type CourseAudit } from '@/lib/llm/quality-audit';
import { requireAdmin, isAdminErrorResponse } from '@/lib/admin-auth';

// Create admin Supabase client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    // Enforce admin server-side: the caller must be an authenticated user whose
    // email is in the admin allowlist. The sessionStorage flag set at
    // /admin/login is UX only and is not trusted here.
    const admin = await requireAdmin(request);
    if (isAdminErrorResponse(admin)) return admin;

    console.log('Quality audit: Request from admin:', admin.email);

    // If courseId provided, return detailed audit for that course
    if (courseId) {
      return await getDetailedCourseAudit(courseId);
    }

    // Otherwise, return summary of all courses
    return await getAllCoursesAuditSummary();
  } catch (error) {
    console.error('Quality audit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function getAllCoursesAuditSummary() {
  // Get all courses with their chapters and full question data for proper audit
  // Note: source_text column may not exist on older databases
  // Only include courses that are ready or failed (not pending/processing)
  const { data: courses, error: coursesError } = await supabaseAdmin
    .from('courses')
    .select(`
      id,
      title,
      created_at,
      user_id,
      status,
      chapters:chapters(
        id,
        title,
        short_summary,
        questions:questions(
          id,
          question_text,
          options,
          correct_option_index,
          source_reference,
          cognitive_level
        )
      )
    `)
    .in('status', ['ready', 'failed'])
    .order('created_at', { ascending: false })
    .limit(100);

  if (coursesError) {
    console.error('Error fetching courses:', coursesError);
    return NextResponse.json({ error: `Failed to fetch courses: ${coursesError.message}` }, { status: 500 });
  }

  // Try to get source_text separately (in case column doesn't exist)
  const courseSourceTexts: Record<string, string> = {};
  try {
    const { data: sourceData } = await supabaseAdmin
      .from('courses')
      .select('id, source_text')
      .in('id', (courses || []).map(c => c.id));

    if (sourceData) {
      sourceData.forEach((c: any) => {
        if (c.source_text) {
          courseSourceTexts[c.id] = c.source_text;
        }
      });
    }
  } catch {
    // source_text column might not exist yet - that's OK
    console.log('Note: source_text column not available');
  }

  // Calculate full audit stats for each course using the SAME auditCourse function as detailed view
  const courseSummaries = (courses || []).map(course => {
    const chapters = course.chapters || [];
    const sourceText = courseSourceTexts[course.id] || '';

    const totalQuestions = chapters.reduce(
      (sum: number, ch: any) => sum + (ch.questions?.length || 0),
      0
    );

    // Use the EXACT same auditCourse function as the detailed view
    // This ensures the relevance score is identical
    const audit = auditCourse({
      id: course.id,
      title: course.title,
      source_text: sourceText,
      chapters: chapters.map((ch: any) => ({
        id: ch.id,
        title: ch.title,
        short_summary: ch.short_summary || '',
        questions: (ch.questions || []).map((q: any) => ({
          id: q.id,
          prompt: q.question_text,
          options: q.options || [],
          correct_option_index: q.correct_option_index,
          source_reference: q.source_reference || undefined,
          cognitive_level: q.cognitive_level || undefined,
        })),
      })),
    });

    return {
      id: course.id,
      title: course.title,
      createdAt: course.created_at,
      userId: course.user_id,
      sourceTextLength: sourceText.length,
      chapterCount: chapters.length,
      totalQuestions,
      relevanceScore: audit.overallRelevanceScore, // Use the exact same score as detailed view
      hasSourceText: sourceText.length > 100,
    };
  });

  // Calculate overall stats
  const stats = {
    totalCourses: courseSummaries.length,
    coursesWithSource: courseSummaries.filter(c => c.hasSourceText).length,
    totalChapters: courseSummaries.reduce((sum, c) => sum + c.chapterCount, 0),
    totalQuestions: courseSummaries.reduce((sum, c) => sum + c.totalQuestions, 0),
    averageRelevance: courseSummaries.length > 0
      ? Math.round(
          courseSummaries.reduce((sum, c) => sum + c.relevanceScore, 0) / courseSummaries.length
        )
      : 0,
  };

  return NextResponse.json({
    stats,
    courses: courseSummaries,
  });
}

async function getDetailedCourseAudit(courseId: string) {
  try {
    // Get course with all chapters and questions
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select(`
        id,
        title,
        created_at,
        user_id,
        chapters:chapters(
          id,
          title,
          chapter_index,
          questions:questions(
            id,
            question_text,
            options,
            correct_option_index,
            explanation,
            source_reference,
            cognitive_level
          )
        )
      `)
      .eq('id', courseId)
      .single();

    if (courseError) {
      console.error('Error fetching course:', courseError);
      return NextResponse.json({ error: `Course not found: ${courseError.message}` }, { status: 404 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Try to get source_text separately (in case column doesn't exist)
    let sourceText = '';
    try {
      const { data: sourceData } = await supabaseAdmin
        .from('courses')
        .select('source_text')
        .eq('id', courseId)
        .single();

      if (sourceData?.source_text) {
        sourceText = sourceData.source_text;
      }
    } catch {
      // source_text column might not exist yet
      console.log('Note: source_text column not available for course', courseId);
    }

    // Sort chapters by index
    const sortedChapters = (course.chapters || []).sort(
      (a: any, b: any) => (a.chapter_index || 0) - (b.chapter_index || 0)
    );

    // Perform full audit
    const audit = auditCourse({
      id: course.id,
      title: course.title,
      source_text: sourceText,
      chapters: sortedChapters.map((ch: any) => ({
        id: ch.id,
        title: ch.title,
        short_summary: '',
        questions: (ch.questions || []).map((q: any) => ({
          id: q.id,
          prompt: q.question_text,
          options: q.options || [],
          correct_option_index: q.correct_option_index,
          explanation: q.explanation,
          source_reference: q.source_reference || undefined,
          cognitive_level: q.cognitive_level || undefined,
        })),
      })),
    });

    return NextResponse.json({ audit });
  } catch (error: any) {
    console.error('Error in getDetailedCourseAudit:', error);
    return NextResponse.json({ error: `Audit failed: ${error.message}` }, { status: 500 });
  }
}

/**
 * DELETE endpoint to remove a course and all its related data
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    // Enforce admin server-side (destructive, cross-user operation).
    const admin = await requireAdmin(request);
    if (isAdminErrorResponse(admin)) return admin;

    console.log('Delete course: Request from admin:', admin.email, 'for course:', courseId);

    // Get the course to confirm it exists
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, title')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      console.error('Delete course: Course not found:', courseError?.message);
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Delete in order: log_events -> questions -> chapters -> course
    // Due to foreign key constraints, we need to delete in this order

    // 1. Delete all log_events for this course
    const { error: logEventsError } = await supabaseAdmin
      .from('log_events')
      .delete()
      .eq('course_id', courseId);

    if (logEventsError) {
      console.error('Delete course: Error deleting log_events:', logEventsError.message);
      // Don't fail if log_events table doesn't exist or has no records
    } else {
      console.log('Deleted log_events for course');
    }

    // 2. Get all chapter IDs for this course
    const { data: chapters } = await supabaseAdmin
      .from('chapters')
      .select('id')
      .eq('course_id', courseId);

    const chapterIds = (chapters || []).map(ch => ch.id);

    // 3. Delete all questions for these chapters
    if (chapterIds.length > 0) {
      const { error: questionsError } = await supabaseAdmin
        .from('questions')
        .delete()
        .in('chapter_id', chapterIds);

      if (questionsError) {
        console.error('Delete course: Error deleting questions:', questionsError.message);
        return NextResponse.json({ error: `Failed to delete questions: ${questionsError.message}` }, { status: 500 });
      }
      console.log(`Deleted questions for ${chapterIds.length} chapters`);
    }

    // 4. Delete all chapters for this course
    const { error: chaptersError } = await supabaseAdmin
      .from('chapters')
      .delete()
      .eq('course_id', courseId);

    if (chaptersError) {
      console.error('Delete course: Error deleting chapters:', chaptersError.message);
      return NextResponse.json({ error: `Failed to delete chapters: ${chaptersError.message}` }, { status: 500 });
    }
    console.log(`Deleted ${chapterIds.length} chapters`);

    // 5. Delete the course itself
    const { error: deleteError } = await supabaseAdmin
      .from('courses')
      .delete()
      .eq('id', courseId);

    if (deleteError) {
      console.error('Delete course: Error deleting course:', deleteError.message);
      return NextResponse.json({ error: `Failed to delete course: ${deleteError.message}` }, { status: 500 });
    }

    console.log(`Successfully deleted course: ${course.title} (${courseId})`);

    return NextResponse.json({
      success: true,
      message: `Course "${course.title}" and all related data deleted successfully`,
      deletedCourse: {
        id: courseId,
        title: course.title,
        chaptersDeleted: chapterIds.length,
      },
    });
  } catch (error: any) {
    console.error('Delete course error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
