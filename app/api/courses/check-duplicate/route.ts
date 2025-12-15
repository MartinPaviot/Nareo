import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * Check if a course with the same filename already exists for the user
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    const userId = auth?.user.id || null;

    // Only check for authenticated users (guests can upload duplicates)
    if (!userId) {
      return NextResponse.json({ isDuplicate: false });
    }

    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Check if a course with the same original_filename exists in user's dashboard
    // Only check courses that are "ready" (visible in dashboard), not failed/pending ones
    const { data: existingCourse, error } = await supabase
      .from('courses')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .eq('original_filename', filename)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error)
      console.error('Error checking duplicate:', error);
      return NextResponse.json({ isDuplicate: false });
    }

    if (existingCourse) {
      return NextResponse.json({
        isDuplicate: true,
        existingCourse: {
          id: existingCourse.id,
          title: existingCourse.title,
          createdAt: existingCourse.created_at,
        },
      });
    }

    return NextResponse.json({ isDuplicate: false });
  } catch (error) {
    console.error('Error in check-duplicate:', error);
    return NextResponse.json({ isDuplicate: false });
  }
}
