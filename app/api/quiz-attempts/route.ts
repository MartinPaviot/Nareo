import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

// POST: Create or update quiz attempt
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    const guestSessionId = getGuestSessionIdFromRequest(request);

    // Must have either authentication or guest session
    if (!auth && !guestSessionId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const admin = getServiceSupabase();
    const userId = auth?.user.id || null;

    const body = await request.json();
    const { chapterId, courseId, score, answers, completed } = body;

    console.log('[quiz-attempts POST] Received:', {
      userId,
      guestSessionId: guestSessionId ? 'present' : 'absent',
      chapterId,
      courseId,
      score,
      completed,
    });

    if (!chapterId || !courseId) {
      return NextResponse.json(
        { error: 'Chapter ID and Course ID are required' },
        { status: 400 }
      );
    }

    // Use admin client for guest users to bypass RLS
    const dbClient = auth ? supabase : admin;

    // Check if there's an existing incomplete attempt
    let existingAttemptQuery = dbClient
      .from('quiz_attempts')
      .select('*')
      .eq('chapter_id', chapterId)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1);

    // Filter by user_id or guest_session_id
    if (userId) {
      existingAttemptQuery = existingAttemptQuery.eq('user_id', userId);
    } else {
      existingAttemptQuery = existingAttemptQuery
        .is('user_id', null)
        .eq('guest_session_id', guestSessionId);
    }

    const { data: existingAttempt } = await existingAttemptQuery.single();

    if (existingAttempt) {
      // Update existing attempt
      console.log('[quiz-attempts POST] Found existing incomplete attempt:', existingAttempt.id);
      const updateData: any = {
        score: score ?? existingAttempt.score,
        answers: answers || existingAttempt.answers,
      };

      if (completed) {
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await dbClient
        .from('quiz_attempts')
        .update(updateData)
        .eq('id', existingAttempt.id)
        .select()
        .single();

      if (error) throw error;

      console.log('[quiz-attempts POST] Updated attempt:', data);
      return NextResponse.json({
        success: true,
        attempt: data,
      });
    } else {
      // Create new attempt
      console.log('[quiz-attempts POST] Creating new attempt');
      const insertData: any = {
        course_id: courseId,
        chapter_id: chapterId,
        score: score ?? 0,
        answers: answers || {},
        completed_at: completed ? new Date().toISOString() : null,
      };

      // Set user_id or guest_session_id
      if (userId) {
        insertData.user_id = userId;
      } else {
        insertData.guest_session_id = guestSessionId;
      }

      const { data, error } = await dbClient
        .from('quiz_attempts')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      console.log('[quiz-attempts POST] Created attempt:', data);
      return NextResponse.json({
        success: true,
        attempt: data,
      });
    }
  } catch (error) {
    console.error('Error saving quiz attempt:', error);
    return NextResponse.json(
      { error: 'Failed to save quiz attempt' },
      { status: 500 }
    );
  }
}
