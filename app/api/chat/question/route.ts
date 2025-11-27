import { NextRequest, NextResponse } from 'next/server';

// Legacy endpoint no longer used now that quizzes are pre-generated during the pipeline.
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Dynamic question generation is disabled. Use pre-generated quiz data.' },
    { status: 501 }
  );
}
