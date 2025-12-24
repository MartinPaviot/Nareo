import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { BlogArticle } from '@/types/blog';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: articles, error } = await supabase
      .from('blog_articles')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blog articles:', error);
      return NextResponse.json(
        { error: 'Failed to fetch articles' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      articles: articles as BlogArticle[],
    });
  } catch (error) {
    console.error('Error in blog API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
