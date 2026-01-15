/**
 * API endpoint to fetch all quiz questions for a course
 * Used by the progressive quiz view to load questions when quiz is ready
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

export async function GET(
  request: NextRequest,
  context: { params: { courseId: string } } | { params: Promise<{ courseId: string }> }
) {
  const auth = await authenticateRequest(request);
  const admin = getServiceSupabase();
  const userId = auth?.user.id || null;
  const guestSessionId = getGuestSessionIdFromRequest(request);
  const resolvedParams = "then" in context.params ? await context.params : context.params;
  const courseId = resolvedParams.courseId;

  try {
    // Get course to verify access
    const { data: course, error: courseError } = await admin
      .from('courses')
      .select('id, title, user_id, quiz_status')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check access
    const isOwner = !!userId && course.user_id === userId;
    const isGuestCourse = !course.user_id;
    if (!isOwner && !isGuestCourse) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all chapters for this course
    const { data: chapters, error: chaptersError } = await admin
      .from('chapters')
      .select('id')
      .eq('course_id', courseId);

    if (chaptersError) {
      console.error('[questions] Error fetching chapters:', chaptersError);
      return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
    }

    if (!chapters || chapters.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    const chapterIds = chapters.map(ch => ch.id);

    // Fetch all questions for these chapters
    const { data: questions, error: questionsError } = await admin
      .from('questions')
      .select('id, chapter_id, question_text, options, type, correct_option_index, explanation, points, phase, question_number')
      .in('chapter_id', chapterIds)
      .order('question_number');

    if (questionsError) {
      console.error('[questions] Error fetching questions:', questionsError);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    console.log(`[questions] Fetched ${questions?.length || 0} questions for course ${courseId}`);

    return NextResponse.json({
      questions: questions || [],
      total: questions?.length || 0,
    });

  } catch (error) {
    console.error('[questions] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
