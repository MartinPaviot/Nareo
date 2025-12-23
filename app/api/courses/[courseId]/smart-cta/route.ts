import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try RPC function
    const { data: cta, error: rpcError } = await supabase
      .rpc('get_smart_cta', {
        p_course_id: courseId,
        p_user_id: user.id,
      });

    if (!rpcError && cta) {
      return NextResponse.json({ cta });
    }

    // Fallback: simple logic
    // Get chapters for this course
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id, name, chapter_number')
      .eq('course_id', courseId)
      .order('chapter_number', { ascending: true });

    // Get mastery for chapters
    const { data: mastery } = await supabase
      .from('chapter_mastery')
      .select('chapter_id, mastery_level')
      .eq('user_id', user.id)
      .in('chapter_id', (chapters || []).map(c => c.id));

    const masteryMap = new Map((mastery || []).map(m => [m.chapter_id, m.mastery_level]));

    // Find first incomplete chapter
    const incompleteChapter = (chapters || []).find(ch => {
      const level = masteryMap.get(ch.id);
      return !level || !['mastered', 'acquired'].includes(level);
    });

    let ctaResult;
    if (incompleteChapter) {
      const level = masteryMap.get(incompleteChapter.id);
      ctaResult = {
        type: !level || level === 'not_started' ? 'start_chapter' : 'continue_chapter',
        label: !level || level === 'not_started'
          ? `Commencer Ch.${incompleteChapter.chapter_number}`
          : `Continuer Ch.${incompleteChapter.chapter_number}`,
        target_id: incompleteChapter.id,
        target_type: 'chapter',
        cards_to_review: 0,
      };
    } else {
      ctaResult = {
        type: 'review',
        label: 'Reviser le cours',
        target_id: courseId,
        target_type: 'course',
        cards_to_review: 0,
      };
    }

    return NextResponse.json({ cta: ctaResult });
  } catch (error) {
    console.error('Error in smart CTA API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
