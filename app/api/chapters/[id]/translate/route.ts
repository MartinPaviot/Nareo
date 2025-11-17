import { NextRequest, NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memory-store';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chapterId } = await params;
    const body = await request.json();
    const { targetLanguage } = body;

    if (!targetLanguage || (targetLanguage !== 'FR' && targetLanguage !== 'EN')) {
      return NextResponse.json(
        { error: 'Invalid target language. Must be FR or EN.' },
        { status: 400 }
      );
    }

    // Get chapter
    const chapter = await memoryStore.getChapter(chapterId);
    if (!chapter) {
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    // Check if translations already exist
    const translationKey = `${chapterId}_${targetLanguage}`;
    const cachedTranslation = await memoryStore.getTranslation(translationKey);
    
    if (cachedTranslation) {
      return NextResponse.json({
        success: true,
        questions: cachedTranslation,
        cached: true,
      });
    }

    // Translate questions using GPT-4
    const languageInstruction = targetLanguage === 'FR'
      ? 'Translate all questions and answer choices to natural, fluent French. Maintain the exact same structure and meaning.'
      : 'Translate all questions and answer choices to natural, fluent English. Maintain the exact same structure and meaning.';

    const questionsToTranslate = chapter.questions?.map(q => ({
      questionNumber: q.questionNumber,
      type: q.type,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
    })) || [];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. ${languageInstruction}
          
Return the translated questions in the exact same JSON format. Do not change question numbers, types, or correct answer letters (A, B, C, D).`,
        },
        {
          role: 'user',
          content: `Translate these questions:\n\n${JSON.stringify(questionsToTranslate, null, 2)}`,
        },
      ],
      temperature: 0.3,
    });

    const translatedQuestionsText = completion.choices[0]?.message?.content || '[]';
    const translatedQuestions = JSON.parse(translatedQuestionsText);

    // Merge translations with original question data
    const fullTranslatedQuestions = chapter.questions?.map((originalQ, index) => ({
      ...originalQ,
      question: translatedQuestions[index]?.question || originalQ.question,
      options: translatedQuestions[index]?.options || originalQ.options,
    })) || [];

    // Cache the translation
    await memoryStore.setTranslation(translationKey, fullTranslatedQuestions);

    return NextResponse.json({
      success: true,
      questions: fullTranslatedQuestions,
      cached: false,
    });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Failed to translate questions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
