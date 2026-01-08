import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Admin emails that always have premium access
const ADMIN_EMAILS = ['contact@usenareo.com'];

// POST: Create a new quiz chapter manually
export async function POST(
  request: NextRequest,
  context: { params: { courseId: string } } | { params: Promise<{ courseId: string }> }
) {
  try {
    const resolvedParams = "then" in context.params ? await context.params : context.params;
    const auth = await authenticateRequest(request);

    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = auth.user.id;
    const courseId = resolvedParams.courseId;

    // Verify course ownership
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .eq('user_id', userId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found or access denied' }, { status: 404 });
    }

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Chapter title is required' }, { status: 400 });
    }

    // Get current max order_index for this course
    const { data: existingChapters } = await supabase
      .from('chapters')
      .select('order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: false })
      .limit(1);

    const maxOrderIndex = existingChapters?.[0]?.order_index ?? -1;
    const newOrderIndex = maxOrderIndex + 1;

    // Create the new chapter
    const { data: newChapter, error: insertError } = await supabase
      .from('chapters')
      .insert({
        course_id: courseId,
        title: title.trim(),
        order_index: newOrderIndex,
        status: 'ready', // Manual chapters start as ready (no content to process)
        summary: null,
        difficulty: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating chapter:', insertError);
      return NextResponse.json({ error: 'Failed to create chapter' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      chapter: {
        id: newChapter.id,
        title: newChapter.title,
        order_index: newChapter.order_index,
        question_count: 0,
        has_access: true,
        completed: false,
        in_progress: false,
        score: null,
        status: 'ready',
      },
    });
  } catch (error) {
    console.error('Error creating chapter:', error);
    return NextResponse.json(
      { error: 'Failed to create chapter' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: { courseId: string } } | { params: Promise<{ courseId: string }> }
) {
  try {
    const resolvedParams = "then" in context.params ? await context.params : context.params;
    const auth = await authenticateRequest(request); // optional auth

    const supabase = await createSupabaseServerClient();
    const userId = auth?.user.id || null;
    const courseId = resolvedParams.courseId;

    // Load course (public or owner)
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Access control: allow public ready courses or owner
    const isOwner = (!!userId && course.user_id === userId) || (!userId && !course.user_id);
    const isPublic = course.is_public === true && course.status === 'ready';
    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get chapters for this course
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    if (chaptersError) throw chaptersError;

    // Auto-fix chapters stuck in 'processing' state for more than 10 minutes
    const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const stuckChapters = (chapters || []).filter(
      ch => ch.status === 'processing' && ch.updated_at && ch.updated_at < TEN_MINUTES_AGO
    );
    if (stuckChapters.length > 0) {
      console.log(`[chapters] Found ${stuckChapters.length} stuck chapters, resetting to 'ready'`);
      for (const ch of stuckChapters) {
        await supabase
          .from('chapters')
          .update({ status: 'ready' })
          .eq('id', ch.id);
      }
    }

    // Get user's subscription tier from profile
    const { data: profileData } = userId
      ? await supabase
          .from('profiles')
          .select('subscription_tier, subscription_expires_at')
          .eq('user_id', userId)
          .single()
      : { data: null };

    // Check if user is admin (always premium)
    const userEmail = auth?.user?.email || null;
    const isAdmin = userEmail ? ADMIN_EMAILS.includes(userEmail) : false;

    // Check if user has active premium subscription (or is admin)
    const isPremium = isAdmin || (profileData?.subscription_tier === 'premium' &&
      (!profileData?.subscription_expires_at || new Date(profileData.subscription_expires_at) > new Date()));

    // Get user's course access (legacy, for backwards compatibility)
    const { data: accessData } = userId
      ? await supabase
          .from('user_course_access')
          .select('access_tier')
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .single()
      : { data: null };

    // Access rules:
    // - Guests (no account): Chapter 1 only (for demo/testing)
    // - Logged-in users viewing their OWN course: Full access to all chapters
    // - Premium users: Unlimited access
    // Note: There are no public courses - users only see their own courses

    // Check if user owns this course
    const isOwnerOfCourse = !!userId && course.user_id === userId;

    // Debug logging
    console.log('[chapters] Access check:', {
      userId,
      courseUserId: course.user_id,
      isOwnerOfCourse,
      isPremium,
      isAdmin,
    });

    // For logged-in users who own the course, they get full access
    // The monthly limit (3 courses/month) is enforced at UPLOAD time, not at viewing time
    // Once a course is uploaded, the owner always has full access to it
    const isFreeMonthlyCourse = isOwnerOfCourse;

    // User has full access if premium OR has paid access OR it's their free monthly course
    const accessTier = (isPremium || isFreeMonthlyCourse) ? 'paid' : (accessData?.access_tier || null);

    // For each chapter, determine access and get progress
    const chaptersWithAccess = await Promise.all(
      (chapters || []).map(async (chapter, index) => {
        // Access logic:
        // Chapter 1 (index 0): always accessible (even for guests)
        // All chapters: accessible if user has full access (premium OR free monthly course)
        // Otherwise: only chapter 1 is accessible
        let hasAccess = false;
        if (index === 0) {
          // Chapter 1 is always accessible
          hasAccess = true;
        } else if (isPremium || isFreeMonthlyCourse) {
          // Premium users and free monthly course owners have full access
          hasAccess = true;
        } else if (accessTier === 'paid') {
          // Users who paid for this specific course have full access
          hasAccess = true;
        }

        // Get quiz attempts for this chapter
        const { data: attempt } = userId
          ? await supabase
              .from('quiz_attempts')
              .select('*')
              .eq('chapter_id', chapter.id)
              .eq('user_id', userId)
              .order('started_at', { ascending: false })
              .limit(1)
              .single()
          : { data: null };

        // Get question count
        const { count: questionCount } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('chapter_id', chapter.id);

        return {
          id: chapter.id,
          title: chapter.title || `Chapter ${index + 1}`,
          summary: chapter.summary,
          difficulty: chapter.difficulty,
          order_index: chapter.order_index || index,
          question_count: questionCount || 0,
          has_access: hasAccess,
          completed: !!attempt?.completed_at,
          in_progress: !!attempt && !attempt.completed_at,
          score: attempt?.score ?? null,
          content_language: course.content_language || course.language || 'en',
          // Include source_text length info for quiz generation filtering
          // (we don't send the full text to save bandwidth, just its existence/length)
          source_text: chapter.source_text || null,
          // Map status for frontend display:
          // - 'pending_quiz' -> 'ready' (chapter content is ready, quiz just hasn't been generated yet)
          // - 'processing' -> 'ready' if chapter has questions (generation completed but status wasn't updated)
          // - 'processing' without questions -> keep as 'processing' (still generating)
          status: chapter.status === 'pending_quiz'
            ? 'ready'
            : (chapter.status === 'processing' && (questionCount || 0) > 0)
              ? 'ready'
              : (chapter.status || 'ready'),
        };
      })
    );

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        status: course.status,
        quiz_status: course.quiz_status || 'pending', // Quiz generation status
        quiz_config: course.quiz_config || null, // Saved quiz config for regeneration
        content_language: course.content_language || course.language || 'en',
      },
      chapters: chaptersWithAccess,
      access_tier: accessTier,
      is_premium: isPremium,
      is_free_monthly_course: isFreeMonthlyCourse,
    });
  } catch (error) {
    console.error('Error fetching course chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course chapters' },
      { status: 500 }
    );
  }
}
