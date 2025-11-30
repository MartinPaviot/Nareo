import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// POST: Create or update quiz attempt
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = auth.user.id;

    const body = await request.json();
    const { chapterId, courseId, score, answers, completed } = body;

    console.log('[quiz-attempts POST] Received:', {
      userId,
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

    // Check if there's an existing incomplete attempt
    const { data: existingAttempt } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('user_id', userId)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

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

      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from('quiz_attempts')
        .insert({
          user_id: userId,
          course_id: courseId,
          chapter_id: chapterId,
          score: score ?? 0,
          answers: answers || {},
          completed_at: completed ? new Date().toISOString() : null,
        })
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
