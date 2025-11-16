import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memory-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get progress for this chapter
    const progress = memoryStore.getChapterProgress(id);
    
    if (!progress) {
      // Initialize if doesn't exist
      memoryStore.initializeChapterProgress(id);
      const newProgress = memoryStore.getChapterProgress(id);
      return NextResponse.json(newProgress);
    }
    
    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error fetching chapter progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
