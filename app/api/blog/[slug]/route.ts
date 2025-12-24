import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { BlogArticle } from '@/types/blog';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: article, error } = await supabase
      .from('blog_articles')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error || !article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      article: article as BlogArticle,
    });
  } catch (error) {
    console.error('Error fetching blog article:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
