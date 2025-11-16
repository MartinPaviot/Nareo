import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memory-store';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    console.log('🔍 Looking for chapter:', id);
    const allData = memoryStore.getAllData();
    console.log('📊 Available chapters:', allData.chapters.map((c: any) => c[0]));
    console.log('📊 Total chapters in store:', allData.chapters.length);
    
    // Get chapter from memory store
    const chapter = memoryStore.getChapter(id);
    
    if (!chapter) {
      console.error('❌ Chapter not found:', id);
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }
    
    console.log('✅ Chapter found:', chapter.title);
    console.log('📝 Chapter has', chapter.questions?.length || 0, 'pre-generated questions');

    // Get concepts for this chapter (for backward compatibility)
    const concepts = memoryStore.getConceptsByChapter(id);

    // Get progress for each concept
    const conceptsWithProgress = concepts.map(concept => {
      const progress = memoryStore.getProgress(concept.id);
      return {
        id: concept.id,
        title: concept.title,
        description: concept.description,
        difficulty: concept.difficulty,
        orderIndex: concept.orderIndex,
        progress: progress ? {
          totalScore: progress.totalScore,
          badge: progress.badge,
          completed: progress.completed,
        } : null,
      };
    });

    return NextResponse.json({
      id: chapter.id,
      title: chapter.title,
      summary: chapter.summary,
      englishTitle: chapter.englishTitle || chapter.title,
      englishDescription: chapter.englishDescription || chapter.summary,
      frenchTitle: chapter.frenchTitle || chapter.title,
      frenchDescription: chapter.frenchDescription || chapter.summary,
      difficulty: chapter.difficulty || 'medium',
      orderIndex: chapter.orderIndex || 0,
      questions: chapter.questions || [],
      sourceText: chapter.sourceText,
      concepts: conceptsWithProgress,
    });
  } catch (error) {
    console.error('Error fetching chapter:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chapter' },
      { status: 500 }
    );
  }
}
