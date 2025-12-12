import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { logEvent } from '@/lib/backend/analytics';

/**
 * POST /api/courses/link-guest
 *
 * Links guest courses to a newly authenticated user.
 * Called after signup/signin to transfer courses uploaded as guest.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const { guestSessionId } = await request.json();

    if (!guestSessionId) {
      return NextResponse.json({ error: 'guestSessionId requis' }, { status: 400 });
    }

    // Use service client to bypass RLS - we need admin rights to update courses where user_id = null
    const supabase = getServiceSupabase();
    const userId = auth.user.id;

    // Find all courses with this guest session ID
    const { data: guestCourses, error: fetchError } = await supabase
      .from('courses')
      .select('id, title')
      .eq('guest_session_id', guestSessionId)
      .is('user_id', null);

    if (fetchError) {
      console.error('Error fetching guest courses:', fetchError);
      throw fetchError;
    }

    if (!guestCourses || guestCourses.length === 0) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'Aucun cours guest à lier',
      });
    }

    // Update all guest courses to belong to the user
    const courseIds = guestCourses.map(c => c.id);

    const { error: updateError } = await supabase
      .from('courses')
      .update({
        user_id: userId,
        guest_session_id: null,
        is_public: false, // Make courses private now that they belong to a user
      })
      .eq('guest_session_id', guestSessionId)
      .is('user_id', null);

    if (updateError) {
      console.error('Error linking guest courses:', updateError);
      throw updateError;
    }

    // Also update chapters and concepts to belong to the user
    for (const courseId of courseIds) {
      await supabase
        .from('chapters')
        .update({ user_id: userId })
        .eq('course_id', courseId);

      await supabase
        .from('concepts')
        .update({ user_id: userId })
        .eq('course_id', courseId);
    }

    // Update monthly_upload_count for the user (count linked courses as uploads)
    const now = new Date();
    const { data: profile } = await supabase
      .from('profiles')
      .select('monthly_upload_count, monthly_upload_reset_at')
      .eq('user_id', userId)
      .single();

    const resetAt = profile?.monthly_upload_reset_at ? new Date(profile.monthly_upload_reset_at) : null;
    const needsReset = !resetAt || resetAt < new Date(now.getFullYear(), now.getMonth(), 1);
    const currentCount = needsReset ? 0 : (profile?.monthly_upload_count || 0);

    await supabase
      .from('profiles')
      .update({
        monthly_upload_count: currentCount + guestCourses.length,
        monthly_upload_reset_at: needsReset ? now.toISOString() : profile?.monthly_upload_reset_at,
      })
      .eq('user_id', userId);

    console.log(`✅ Linked ${guestCourses.length} guest course(s) to user ${userId}:`, courseIds);

    await logEvent('guest_courses_linked', {
      userId,
      payload: {
        guestSessionId,
        coursesLinked: guestCourses.length,
        courseIds: guestCourses.map(c => c.id),
      },
    });

    return NextResponse.json({
      success: true,
      linked: guestCourses.length,
      courses: guestCourses,
      message: `${guestCourses.length} cours lié(s) à votre compte`,
    });
  } catch (error: any) {
    console.error('Error in link-guest:', error);
    await logEvent('guest_courses_link_failed', {
      userId: auth.user.id,
      payload: { error: error?.message },
    });

    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la liaison des cours' },
      { status: 500 }
    );
  }
}
