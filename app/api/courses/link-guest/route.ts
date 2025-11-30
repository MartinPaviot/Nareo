import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';
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

    const supabase = await createSupabaseServerClient();
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
