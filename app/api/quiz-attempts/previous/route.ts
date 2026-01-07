import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    if (!auth) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get('chapterId');

    if (!chapterId) {
      return NextResponse.json({ error: 'Chapter ID is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const userId = auth.user.id;

    // Get the second most recent completed attempt (the previous one before current)
    const { data: attempts, error } = await supabase
      .from('quiz_attempts')
      .select('score, answers')
      .eq('chapter_id', chapterId)
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(2);

    if (error) {
      console.error('Error fetching previous attempt:', error);
      return NextResponse.json({ error: 'Failed to fetch previous attempt' }, { status: 500 });
    }

    // If there's only one attempt or none, no previous attempt exists
    if (!attempts || attempts.length < 2) {
      return NextResponse.json({ previousScore: null, previousTotal: null });
    }

    // The second item is the previous attempt
    const previousAttempt = attempts[1];

    // Calculate total from answers if available, otherwise use a default
    let previousTotal = 0;
    if (previousAttempt.answers && typeof previousAttempt.answers === 'object') {
      // Count the number of answers to estimate total questions
      previousTotal = Object.keys(previousAttempt.answers).length * 10; // Assuming 10 points per question
    }

    // If we can't determine total, use the score as an approximation
    if (previousTotal === 0) {
      previousTotal = previousAttempt.score || 100;
    }

    return NextResponse.json({
      previousScore: previousAttempt.score,
      previousTotal,
    });
  } catch (error) {
    console.error('Error in previous attempt API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
