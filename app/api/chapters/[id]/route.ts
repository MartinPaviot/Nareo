import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user.id;
    const { id: chapterId } = await context.params;

    console.log('🔍 Fetching chapter from Supabase:', chapterId, 'for user:', userId);

    const supabase = await createSupabaseServerClient();

    // Fetch chapter directly from Supabase
    const { data: chapter, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', chapterId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching chapter from Supabase:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chapter' },
        { status: 500 }
      );
    }

    if (!chapter) {
      console.error('❌ Chapter not found in Supabase:', chapterId);
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    console.log('✅ Chapter found in Supabase:', chapter.title);
    console.log('📝 Chapter has', chapter.questions?.length || 0, 'questions');

    // Return chapter with all fields
    return NextResponse.json({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      englishTitle: chapter.english_title || chapter.title,
      englishDescription: chapter.english_description || chapter.summary,
      frenchTitle: chapter.french_title || chapter.title,
      frenchDescription: chapter.french_description || chapter.summary,
      difficulty: chapter.difficulty || 'medium',
      orderIndex: chapter.order_index || 0,
      questions: chapter.questions || [],
      sourceText: chapter.source_text,
      concepts: [], // Empty for now, concepts are deprecated
    });
  } catch (error) {
    console.error('❌ Unexpected error in GET /api/chapters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user.id;
    const { id: chapterId } = await context.params;
    
    console.log('🗑️ Attempting to delete chapter from Supabase:', chapterId);

    const supabase = await createSupabaseServerClient();
    
    // Delete chapter from Supabase (RLS will ensure user can only delete their own)
    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', chapterId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('❌ Error deleting chapter from Supabase:', error);
      return NextResponse.json(
        { error: 'Failed to delete chapter' },
        { status: 500 }
      );
    }
    
    console.log('✅ Chapter deleted successfully from Supabase:', chapterId);
    return NextResponse.json({
      success: true,
      message: 'Chapter deleted successfully',
    });
  } catch (error) {
    console.error('❌ Unexpected error in DELETE /api/chapters/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
