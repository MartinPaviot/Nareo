import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memory-store';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    // Get chapter from memory store
    const chapter = await memoryStore.getChapter(id);
    
    if (!chapter) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get concepts for this chapter
    const concepts = await memoryStore.getConceptsByChapter(id);

    // Get progress for all concepts
    const allProgress = await memoryStore.getAllProgress();
    
    // Build concept results
    const conceptResults = concepts.map(concept => {
      const progress = allProgress.find(p => p.conceptId === concept.id);
      return {
        id: concept.id,
        title: concept.title,
        difficulty: concept.difficulty,
        score: progress?.totalScore || 0,
        badge: progress?.badge || null,
      };
    });

    // Calculate stats
    const totalScore = conceptResults.reduce((sum, c) => sum + c.score, 0);
    const conceptsCompleted = conceptResults.filter(c => c.score >= 60).length;
    const masteryPercentage = conceptResults.length > 0
      ? Math.round((conceptsCompleted / conceptResults.length) * 100)
      : 0;

    return NextResponse.json({
      id: chapter.id,
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      totalScore,
      conceptsCompleted,
      totalConcepts: conceptResults.length,
      timeSpent: 0, // Not tracked in memory version
      voiceUsed: false, // Not tracked in memory version
      concepts: conceptResults,
      masteryPercentage,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
