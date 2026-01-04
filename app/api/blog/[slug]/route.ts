import { NextRequest, NextResponse } from 'next/server';
import { getArticleBySlug } from '@/lib/blog-data';

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

    const article = getArticleBySlug(slug);

    if (!article || !article.published) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      article,
    });
  } catch (error) {
    console.error('Error fetching blog article:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
