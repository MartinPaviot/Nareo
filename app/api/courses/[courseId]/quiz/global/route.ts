import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * GET /api/courses/[courseId]/quiz/global
 *
 * Fetch questions from all chapters of a course, optionally excluding already-seen questions.
 *
 * Query params:
 * - limit: Max number of questions to return (default: 20)
 * - excludeSeen: If 'true', exclude questions the user has already answered correctly
 * - chapters: Comma-separated list of chapter IDs to include (optional, default: all)
 * - shuffle: If 'true', randomize question order (default: true)
 */
export async function GET(
  request: NextRequest,
  context: { params: { courseId: string } } | { params: Promise<{ courseId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    const supabase = await createSupabaseServerClient();
    const admin = getServiceSupabase();
    const userId = auth?.user.id || null;
    const guestSessionId = getGuestSessionIdFromRequest(request);
    const resolvedParams = "then" in context.params ? await context.params : context.params;
    const courseId = resolvedParams.courseId;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const excludeSeen = searchParams.get('excludeSeen') === 'true';
    const chaptersParam = searchParams.get('chapters');
    const shouldShuffle = searchParams.get('shuffle') !== 'false';

    // Verify course exists and user has access
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, user_id, is_public, status')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check access
    const isOwner = !!userId && course.user_id === userId;
    const isGuestCourse = !course.user_id;
    const isPublic = course.is_public === true && course.status === 'ready';
    if (!isOwner && !isGuestCourse && !isPublic) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get all chapters for this course
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, title, order_index')
      .eq('course_id', courseId)
      .order('order_index');

    if (chaptersError || !chapters || chapters.length === 0) {
      return NextResponse.json({ error: 'No chapters found for course' }, { status: 404 });
    }

    // Filter chapters if specific ones requested
    const chapterIds = chaptersParam
      ? chaptersParam.split(',').filter(id => chapters.some(ch => ch.id === id))
      : chapters.map(ch => ch.id);

    if (chapterIds.length === 0) {
      return NextResponse.json({ error: 'No valid chapters specified' }, { status: 400 });
    }

    // Get questions from selected chapters
    let questionsQuery = supabase
      .from('questions')
      .select(`
        id,
        chapter_id,
        question_text,
        question_number,
        answer_text,
        options,
        type,
        difficulty,
        explanation,
        correct_option_index,
        points,
        page_source,
        source_excerpt
      `)
      .in('chapter_id', chapterIds);

    const { data: allQuestions, error: questionsError } = await questionsQuery;

    if (questionsError) {
      console.error('[global-quiz] Error fetching questions:', questionsError);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    if (!allQuestions || allQuestions.length === 0) {
      return NextResponse.json({
        success: true,
        questions: [],
        totalAvailable: 0,
        mode: 'global',
        message: 'No questions found for this course',
      });
    }

    // Exclude seen questions if requested
    let filteredQuestions = allQuestions;
    if (excludeSeen && (userId || guestSessionId)) {
      const dbClient = userId ? supabase : admin;

      // Get questions the user has answered correctly
      let historyQuery = dbClient
        .from('user_question_history')
        .select('question_id')
        .eq('course_id', courseId)
        .eq('answered_correctly', true);

      if (userId) {
        historyQuery = historyQuery.eq('user_id', userId);
      } else if (guestSessionId) {
        historyQuery = historyQuery.eq('guest_session_id', guestSessionId);
      }

      const { data: seenHistory } = await historyQuery;
      const seenIds = new Set((seenHistory || []).map(h => h.question_id));

      // Filter out seen questions
      filteredQuestions = allQuestions.filter(q => !seenIds.has(q.id));

      console.log('[global-quiz] Excluded seen questions:', {
        total: allQuestions.length,
        seen: seenIds.size,
        remaining: filteredQuestions.length,
      });
    }

    // Shuffle if requested
    if (shouldShuffle) {
      filteredQuestions = shuffleArray(filteredQuestions);
    }

    // Limit results
    const limitedQuestions = filteredQuestions.slice(0, limit);

    // Create chapter lookup for enriching questions
    const chapterMap = new Map(chapters.map(ch => [ch.id, ch]));

    // Enrich questions with chapter info
    const enrichedQuestions = limitedQuestions.map(q => ({
      ...q,
      chapter_title: chapterMap.get(q.chapter_id)?.title || 'Unknown',
      chapter_order_index: chapterMap.get(q.chapter_id)?.order_index ?? 0,
    }));

    return NextResponse.json({
      success: true,
      questions: enrichedQuestions,
      totalAvailable: filteredQuestions.length,
      totalInCourse: allQuestions.length,
      mode: 'global',
      chapters: chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        order_index: ch.order_index,
        question_count: allQuestions.filter(q => q.chapter_id === ch.id).length,
      })),
    });
  } catch (error) {
    console.error('[global-quiz] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch global quiz' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/courses/[courseId]/quiz/global
 *
 * Create a new global quiz attempt
 */
export async function POST(
  request: NextRequest,
  context: { params: { courseId: string } } | { params: Promise<{ courseId: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    const supabase = await createSupabaseServerClient();
    const admin = getServiceSupabase();
    const userId = auth?.user.id || null;
    const guestSessionId = getGuestSessionIdFromRequest(request);
    const resolvedParams = "then" in context.params ? await context.params : context.params;
    const courseId = resolvedParams.courseId;

    if (!userId && !guestSessionId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { questionIds, score, answers, completed } = body;

    // Use admin client for guests
    const dbClient = userId ? supabase : admin;

    // Create global quiz attempt (no chapter_id for global mode)
    const insertData: Record<string, unknown> = {
      course_id: courseId,
      chapter_id: null, // Global quiz has no specific chapter
      quiz_mode: 'global',
      score: score ?? 0,
      answers: answers || {},
      completed_at: completed ? new Date().toISOString() : null,
    };

    if (userId) {
      insertData.user_id = userId;
    } else {
      insertData.guest_session_id = guestSessionId;
    }

    const { data: attempt, error: attemptError } = await dbClient
      .from('quiz_attempts')
      .insert(insertData)
      .select()
      .single();

    if (attemptError) {
      console.error('[global-quiz] Error creating attempt:', attemptError);
      return NextResponse.json({ error: 'Failed to create quiz attempt' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      attempt,
    });
  } catch (error) {
    console.error('[global-quiz] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create global quiz attempt' },
      { status: 500 }
    );
  }
}
