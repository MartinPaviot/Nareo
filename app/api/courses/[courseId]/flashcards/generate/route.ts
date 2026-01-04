import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';
import OpenAI from 'openai';
import {
  FlashcardConfig,
  FlashcardNiveau,
  Flashcard,
  FLASHCARD_COUNT_BY_NIVEAU,
  DEFAULT_FLASHCARD_CONFIG,
} from '@/types/flashcard-config';
import {
  FLASHCARD_SYSTEM_PROMPT,
  getFlashcardUserPrompt,
} from '@/lib/prompts/flashcard-prompt';

// Create SSE stream for progress updates and flashcard streaming
function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const sendProgress = (data: {
    type: string;
    message?: string;
    progress?: number;
    cardsGenerated?: number;
    totalCards?: number;
  }) => {
    if (controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    }
  };

  const sendFlashcard = (data: {
    id: string;
    type: string;
    front: string;
    back: string;
    cardsGenerated: number;
    totalCards: number;
    progress: number;
  }) => {
    if (controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'flashcard',
        data: {
          id: data.id,
          type: data.type,
          front: data.front,
          back: data.back,
        },
        cardsGenerated: data.cardsGenerated,
        totalCards: data.totalCards,
        progress: data.progress,
      })}\n\n`));
    }
  };

  const close = () => {
    if (controller) {
      controller.close();
    }
  };

  return { stream, sendProgress, sendFlashcard, close };
}

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Valide et nettoie les flashcards générées par le LLM
 */
function validateAndCleanFlashcards(rawCards: any[]): Flashcard[] {
  const validCards: Flashcard[] = [];

  for (const card of rawCards) {
    if (!card || typeof card !== 'object') continue;

    const type = card.type;

    if (type === 'basic') {
      if (card.front && card.back) {
        validCards.push({
          type: 'basic',
          front: String(card.front).trim(),
          back: String(card.back).trim(),
        });
      }
    } else if (type === 'cloze') {
      if (card.text && card.answer) {
        validCards.push({
          type: 'cloze',
          text: String(card.text).trim(),
          cloze_id: card.cloze_id || 'c1',
          answer: String(card.answer).trim(),
        });
      }
    } else if (type === 'reversed') {
      if (card.term && card.definition) {
        validCards.push({
          type: 'reversed',
          term: String(card.term).trim(),
          definition: String(card.definition).trim(),
        });
      }
    } else {
      // Fallback: traiter comme basic si front/back présents
      if (card.front && card.back) {
        validCards.push({
          type: 'basic',
          front: String(card.front).trim(),
          back: String(card.back).trim(),
        });
      }
    }
  }

  return validCards;
}

/**
 * Convertit une flashcard LLM en format base de données
 */
function convertToDBFormat(card: Flashcard): { type: string; front: string; back: string } {
  switch (card.type) {
    case 'basic':
      return {
        type: 'basic',
        front: card.front,
        back: card.back,
      };

    case 'cloze':
      // Front: texte avec [...] à la place du mot caché
      const frontText = card.text.replace(/\{\{c1::([^}]+)\}\}/, '[...]');
      return {
        type: 'cloze',
        front: frontText,
        back: card.answer,
      };

    case 'reversed':
      return {
        type: 'reversed',
        front: `${card.term} signifie ?`,
        back: card.definition,
      };

    default:
      return {
        type: 'basic',
        front: (card as any).front || '',
        back: (card as any).back || '',
      };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    // Try to authenticate user (optional for guest users)
    const auth = await authenticateRequest(request);
    const guestSessionId = getGuestSessionIdFromRequest(request);

    // Must have either authentication or guest session
    if (!auth && !guestSessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body for config
    let config: FlashcardConfig = DEFAULT_FLASHCARD_CONFIG;
    try {
      const body = await request.json();
      if (body.niveau && ['essentiel', 'complet', 'exhaustif'].includes(body.niveau)) {
        config = { niveau: body.niveau as FlashcardNiveau };
      }
    } catch {
      // If no body or parse error, use defaults
    }

    const supabase = await createSupabaseServerClient();
    const admin = getServiceSupabase();

    // Get course with source text
    // For authenticated users: check user_id match
    // For guest users: check guest_session_id match and user_id is null
    let course;
    let error;

    if (auth) {
      // Authenticated user: must own the course
      const result = await supabase
        .from('courses')
        .select('id, title, source_text, content_language')
        .eq('id', courseId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      course = result.data;
      error = result.error;
    } else {
      // Guest user: course must have no user_id and matching guest_session_id
      const result = await admin
        .from('courses')
        .select('id, title, source_text, content_language, user_id, guest_session_id')
        .eq('id', courseId)
        .is('user_id', null)
        .eq('guest_session_id', guestSessionId)
        .maybeSingle();
      course = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error fetching course:', error);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    if (!course.source_text) {
      return NextResponse.json({ error: 'Course has no source text' }, { status: 400 });
    }

    // Determine language for generation
    const language = (course.content_language?.toUpperCase() || 'EN') as 'EN' | 'FR' | 'DE';
    const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';
    const languageInstruction = `Generate all flashcards in ${languageName}. All content (front, back, text, term, definition) must be in ${languageName}.`;

    // Tronquer le texte source
    const truncatedText = course.source_text.substring(0, 12000);

    // Générer le prompt utilisateur selon le niveau
    const userPrompt = getFlashcardUserPrompt(config.niveau, course.title, truncatedText);

    console.log(`[flashcards/generate] Generating Anki-quality flashcards with SSE streaming (niveau: ${config.niveau})`);

    // Create SSE stream
    const { stream, sendProgress, sendFlashcard, close } = createSSEStream();

    // Start async generation process
    (async () => {
      try {
        // Send initial progress
        sendProgress({
          type: 'progress',
          message: 'Analyzing document...',
          progress: 10,
        });

        // Generate flashcards using GPT-4o with new Anki prompt
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `${FLASHCARD_SYSTEM_PROMPT}\n\n${languageInstruction}`,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.4,
          max_tokens: 6000,
          response_format: { type: 'json_object' },
        });

        sendProgress({
          type: 'progress',
          message: 'Processing flashcards...',
          progress: 50,
        });

        const content = response.choices[0].message.content;
        let flashcards: Flashcard[] = [];

        try {
          const parsed = JSON.parse(content || '{}');
          const rawFlashcards = Array.isArray(parsed) ? parsed : parsed.flashcards || [];
          flashcards = validateAndCleanFlashcards(rawFlashcards);
        } catch (parseError) {
          console.error('Error parsing flashcards:', parseError);
          sendProgress({ type: 'error', message: 'Failed to parse generated flashcards' });
          close();
          return;
        }

        if (flashcards.length === 0) {
          sendProgress({ type: 'error', message: 'No valid flashcards generated' });
          close();
          return;
        }

        // Log distribution des types
        const typeCount = flashcards.reduce((acc, fc) => {
          acc[fc.type] = (acc[fc.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`[flashcards/generate] Card distribution:`, typeCount);

        // Delete existing flashcards for this course (regeneration)
        await admin
          .from('flashcards')
          .delete()
          .eq('course_id', courseId);

        sendProgress({
          type: 'progress',
          message: 'Saving flashcards...',
          progress: 60,
        });

        // Insert flashcards one by one and stream each to the client
        const totalCards = flashcards.length;
        let cardsInserted = 0;

        for (const fc of flashcards) {
          const dbData = convertToDBFormat(fc);
          const flashcardRow = {
            course_id: courseId,
            chapter_id: null,
            type: dbData.type,
            front: dbData.front,
            back: dbData.back,
          };

          const { data: insertedCard, error: insertError } = await admin
            .from('flashcards')
            .insert(flashcardRow)
            .select('id, type, front, back')
            .single();

          if (!insertError && insertedCard) {
            cardsInserted++;
            const cardProgress = 60 + Math.floor((cardsInserted / totalCards) * 35);

            // Send the flashcard to the client
            sendFlashcard({
              id: insertedCard.id,
              type: insertedCard.type,
              front: insertedCard.front,
              back: insertedCard.back,
              cardsGenerated: cardsInserted,
              totalCards: totalCards,
              progress: cardProgress,
            });
          }
        }

        // Update course flashcards_status
        await admin
          .from('courses')
          .update({ flashcards_status: 'ready' })
          .eq('id', courseId);

        console.log(`[flashcards/generate] Generated ${cardsInserted} Anki-quality flashcards with streaming`);

        // Send completion
        sendProgress({
          type: 'complete',
          message: 'Flashcards generated successfully',
          progress: 100,
          cardsGenerated: cardsInserted,
          totalCards: totalCards,
        });
        close();

      } catch (error) {
        console.error('Error generating flashcards:', error);
        sendProgress({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to generate flashcards',
        });
        close();
      }
    })();

    // Return streaming response immediately
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error generating flashcards:', error);
    return NextResponse.json(
      { error: 'Failed to generate flashcards' },
      { status: 500 }
    );
  }
}
