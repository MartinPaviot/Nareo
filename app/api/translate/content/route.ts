import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai-vision';

export async function POST(request: NextRequest) {
  // ✅ Déclarer les variables en dehors du try-catch pour accès dans le catch
  let content: string | undefined;
  let targetLanguage: string | undefined;
  let contentType: string | undefined;

  try {
    const body = await request.json();
    content = body.content;
    targetLanguage = body.targetLanguage;
    contentType = body.contentType;

    if (!content || !targetLanguage) {
      return NextResponse.json(
        { error: 'Missing required fields: content and targetLanguage are required' },
        { status: 400 }
      );
    }

    const languageInstruction = targetLanguage === 'FR'
      ? 'Translate to French (français). Maintain the same tone, style, and formatting.'
      : 'Translate to English. Maintain the same tone, style, and formatting.';

    const contentTypeInstructions = {
      question: 'This is an educational question. Translate it accurately while preserving its pedagogical intent.',
      option: 'This is a multiple-choice option. Translate it concisely and clearly.',
      feedback: 'This is feedback for a student. Translate it while maintaining an encouraging and supportive tone.',
      instruction: 'This is an instruction or explanation. Translate it clearly and precisely.',
      message: 'This is a chat message from an AI tutor. Translate it while keeping the friendly, helpful tone.',
    };

    const typeInstruction = contentTypeInstructions[contentType as keyof typeof contentTypeInstructions] || '';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in educational content. ${languageInstruction} ${typeInstruction} Return ONLY the translated text, no explanations or additional commentary.`,
        },
        {
          role: 'user',
          content: content,
        },
      ],
      temperature: 0.3, // Lower temperature for more accurate translation
      max_tokens: 500,
    });

    const translatedContent = response.choices[0].message.content || content;

    // ✅ Renvoyer avec le champ 'translatedText' attendu par le client
    return NextResponse.json({
      success: true,
      translatedText: translatedContent,
      translated: translatedContent, // Garder aussi pour rétrocompatibilité
      originalLanguage: targetLanguage === 'FR' ? 'EN' : 'FR',
      targetLanguage,
    });
  } catch (error) {
    // ✅ Log détaillé pour diagnostiquer les problèmes (clé API manquante, mauvais modèle, etc.)
    console.error('❌ Translation API Error - Full details:');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Full error object:', error);

    // Log request context for debugging
    console.error('Request context:', {
      hasContent: !!content,
      contentLength: content?.length,
      targetLanguage,
      contentType,
    });

    return NextResponse.json(
      {
        error: 'Failed to translate content',
        details: error instanceof Error ? error.message : 'Unknown error',
        // Include additional context in development
        ...(process.env.NODE_ENV === 'development' && {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined,
        })
      },
      { status: 500 }
    );
  }
}
