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

    // Check if this is the user's free monthly course (owner + first course created this month)
    let isFreeMonthlyCourse = false;
    if (userId && course.user_id === userId && !isPremium) {
      const courseCreatedAt = new Date(course.created_at);
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Check if course was created this month
      if (courseCreatedAt >= firstDayOfMonth) {
        // Count how many courses user uploaded this month before this one
        const { count: coursesBeforeThis } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', firstDayOfMonth.toISOString())
          .lt('created_at', course.created_at);

        // First course of the month gets full access (0 courses before this one)
        isFreeMonthlyCourse = (coursesBeforeThis || 0) === 0;
      }
    }

    // User has full access if premium OR has paid access OR it's their free monthly course
    const accessTier = (isPremium || isFreeMonthlyCourse) ? 'paid' : (accessData?.access_tier || null);

    // For each chapter, determine access and get progress
    const chaptersWithAccess = await Promise.all(
      (chapters || []).map(async (chapter, index) => {
        // Access logic:
        // Chapter 1 (index 0): always accessible (even for guests)
        // Chapter 2-3 (index 1-2): requires auth (signup) or access tier free/paid
        // Chapter 4+ (index 3+): requires paid/premium
        let hasAccess = false;
        if (index === 0) {
          hasAccess = true;
        } else if (index === 1 || index === 2) {
          // Chapters 2 and 3 are free for logged-in users
          hasAccess = !!userId || accessTier === 'paid' || accessTier === 'free';
        } else {
          hasAccess = accessTier === 'paid';
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
        };
      })
    );

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        status: course.status,
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
