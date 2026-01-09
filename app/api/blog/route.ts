import { NextResponse } from 'next/server';
import { getPublishedArticles } from '@/lib/blog-data';

export async function GET() {
  try {
    const articles = getPublishedArticles();

    // Sort articles by date (newest first)
    const sortedArticles = articles.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      success: true,
      articles: sortedArticles,
    });
  } catch (error) {
    console.error('Error in blog API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
