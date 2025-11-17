import { NextRequest, NextResponse } from 'next/server';
import { generateQuizQuestion } from '@/lib/openai-vision';
import { memoryStore } from '@/lib/memory-store';

export async function POST(request: NextRequest) {
  try {
    const { conceptId, phase } = await request.json();

    if (!conceptId || !phase) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get concept details
    const concept = await memoryStore.getConcept(conceptId);
    
    if (!concept) {
      return NextResponse.json(
        { error: 'Concept not found' },
        { status: 404 }
      );
    }

    // Get chat history for context
    const chatHistory = await memoryStore.getChatHistory(conceptId);
    const previousMessages = chatHistory?.messages || [];
    
    // Extract previous questions to avoid duplication
    const previousQuestions = previousMessages
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.content)
      .slice(-3); // Last 3 questions

    // Generate question based on phase, including source text if available
    const questionData = await generateQuizQuestion(
      `${concept.title}: ${concept.description}`,
      phase as 1 | 2 | 3,
      previousQuestions,
      concept.sourceText // Pass the source text from the original image/PDF
    );

    // Store the question in chat history
    const questionText = phase === 1 
      ? `${questionData.question}\n\nOptions:\nA) ${questionData.options[0]}\nB) ${questionData.options[1]}\nC) ${questionData.options[2]}\nD) ${questionData.options[3]}`
      : questionData.question;
    
    await memoryStore.addChatMessage(conceptId, 'assistant', questionText);

    return NextResponse.json({
      success: true,
      question: questionData.question,
      options: questionData.options,
      correctAnswer: questionData.correctAnswer,
      phase,
    });
  } catch (error) {
    console.error('Error generating question:', error);
    return NextResponse.json(
      { error: 'Failed to generate question', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
