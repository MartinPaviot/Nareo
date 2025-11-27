import { NextRequest, NextResponse } from 'next/server';

// Placeholder: translation is now handled client-side or via dedicated content translator routes.
export async function POST() {
  return NextResponse.json(
    { error: 'Translation endpoint not available for chapters' },
    { status: 501 }
  );
}
