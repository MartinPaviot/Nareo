import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memory-store';

export async function GET() {
  try {
    // Get all chapters
    const chapters = memoryStore.getAllChapters();
    
    // Get all chapter progress
    const progress = memoryStore.getAllChapterProgress();
    
    return NextResponse.json({
      success: true,
      chapters: chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        summary: ch.summary,
        difficulty: ch.difficulty || 'medium',
        orderIndex: ch.orderIndex || 0,
        questions: ch.questions || [],
        sourceText: ch.sourceText,
        // Bilingual fields
        englishTitle: ch.englishTitle || ch.title,
        englishDescription: ch.englishDescription || ch.summary,
        frenchTitle: ch.frenchTitle || ch.title,
        frenchDescription: ch.frenchDescription || ch.summary,
      })),
      progress: progress,
    });
  } catch (error) {
    console.error('Error fetching chapters:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    );
  }
}
