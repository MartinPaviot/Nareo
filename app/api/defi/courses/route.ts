import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all ready courses with their chapters
    // We use user.id explicitly to avoid any RLS issues
    // Use explicit relationship name to avoid ambiguity (chapters_course_id_fkey)
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        quiz_status,
        chapters!chapters_course_id_fkey(id, title, order_index)
      `)
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .order('created_at', { ascending: false });

    if (coursesError) {
      console.error('Error fetching courses:', coursesError);
      return NextResponse.json({ error: 'Error fetching courses' }, { status: 500 });
    }

    return NextResponse.json(courses || []);
  } catch (error) {
    console.error('Error in /api/defi/courses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
