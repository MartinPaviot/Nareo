import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memory-store';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    // Get concept from memory store
    const concept = await memoryStore.getConcept(id);
    
    if (!concept) {
      return NextResponse.json(
        { error: 'Concept not found' },
        { status: 404 }
      );
    }

    // Get progress for this concept
    const progress = await memoryStore.getProgress(id);

    // Get chat history
    const chatHistory = await memoryStore.getChatHistory(id);

    return NextResponse.json({
      id: concept.id,
      chapterId: concept.chapterId,
      title: concept.title,
      description: concept.description,
      difficulty: concept.difficulty,
      orderIndex: concept.orderIndex,
      progress: progress || {
        conceptId: id,
        phase1Score: 0,
        phase2Score: 0,
        phase3Score: 0,
        totalScore: 0,
        badge: null,
        completed: false,
      },
      chatHistory: chatHistory?.messages || [],
    });
  } catch (error) {
    console.error('Error fetching concept:', error);
    return NextResponse.json(
      { error: 'Failed to fetch concept' },
      { status: 500 }
    );
  }
}
