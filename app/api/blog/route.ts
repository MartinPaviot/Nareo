import { NextResponse } from 'next/server';
import { getPublishedArticles } from '@/lib/blog-data';

export async function GET() {
  try {
    const articles = getPublishedArticles();

    return NextResponse.json({
      success: true,
      articles,
    });
  } catch (error) {
    console.error('Error in blog API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
