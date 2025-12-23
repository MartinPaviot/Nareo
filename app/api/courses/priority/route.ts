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

    // Calculate priority items
    await supabase.rpc('calculate_priority_items', { p_user_id: user.id });

    // Fetch priority items with course and chapter info
    const { data: items, error } = await supabase
      .from('priority_items')
      .select(`
        *,
        course:courses(title, editable_title),
        chapter:chapters(name)
      `)
      .eq('user_id', user.id)
      .order('priority_score', { ascending: false })
      .limit(5);

    if (error) {
      // If table doesn't exist yet, return empty
      if (error.code === '42P01') {
        return NextResponse.json({ items: [] });
      }
      console.error('Error fetching priority items:', error);
      return NextResponse.json({ error: 'Failed to fetch priority items' }, { status: 500 });
    }

    // Format items
    const formattedItems = (items || []).map(item => ({
      id: item.id,
      item_type: item.item_type,
      item_id: item.item_id,
      course_id: item.course_id,
      priority_score: item.priority_score,
      reason: item.reason,
      days_since_review: item.days_since_review,
      mastery_level: item.mastery_level,
      course_name: item.course?.editable_title || item.course?.title,
      chapter_name: item.chapter?.name,
    }));

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    console.error('Error in priority items API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
