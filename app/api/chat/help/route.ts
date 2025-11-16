import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai-vision';

export async function POST(request: NextRequest) {
  try {
    const { action, question, chapterTitle, language = 'EN' } = await request.json();

    if (!action || !question) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const languageInstruction = language === 'FR' 
      ? 'Respond in French (français).' 
      : 'Respond in English.';

    const prompts = {
      clarify: `The student doesn't understand this question. Explain it in a different, simpler way:\n\nQuestion: ${question}\n\nProvide a clear, friendly explanation that helps them understand what's being asked. ${languageInstruction}`,
      simplify: `Break down this question into simpler terms for the student:\n\nQuestion: ${question}\n\nSimplify the language and explain any complex concepts. ${languageInstruction}`,
      example: `Provide a helpful example to illustrate this question:\n\nQuestion: ${question}\n\nGive a concrete, relatable example that helps them understand the concept. ${languageInstruction}`,
    };

    const prompt = prompts[action as keyof typeof prompts];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Aristo, a friendly and helpful AI tutor. You're teaching about "${chapterTitle}". Be encouraging, clear, and concise. Use simple language and emojis occasionally to be friendly. ${languageInstruction}`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const helpText = response.choices[0].message.content || (language === 'FR' ? 'Laissez-moi vous aider !' : 'Let me help you with that!');

    return NextResponse.json({
      success: true,
      help: helpText,
    });
  } catch (error) {
    console.error('Error generating help:', error);
    return NextResponse.json(
      { error: 'Failed to generate help', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
