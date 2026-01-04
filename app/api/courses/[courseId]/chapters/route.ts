import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// Admin emails that always have premium access
const ADMIN_EMAILS = ['contact@usenareo.com'];

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
          // Map 'pending_quiz' to 'ready' for frontend display since chapter content is ready
          // The quiz just hasn't been generated yet
          status: chapter.status === 'pending_quiz' ? 'ready' : (chapter.status || 'ready'),
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
