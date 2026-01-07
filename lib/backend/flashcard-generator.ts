import OpenAI from 'openai';
import { getServiceSupabase } from '@/lib/supabase';
import { logEvent } from './analytics';
import {
  FlashcardConfig,
  FlashcardNiveau,
  Flashcard,
  BasicCard,
  ClozeCard,
  ReversedCard,
  FormulaCard,
  FLASHCARD_COUNT_BY_NIVEAU,
  DEFAULT_FLASHCARD_CONFIG,
} from '@/types/flashcard-config';
import {
  FLASHCARD_SYSTEM_PROMPT,
  getFlashcardUserPrompt,
} from '@/lib/prompts/flashcard-prompt';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Données de flashcard normalisées pour insertion en base
 */
interface FlashcardDBData {
  type: string;
  front: string;
  back: string;
  cloze_text?: string;
  cloze_answer?: string;
  reversed_term?: string;
  reversed_def?: string;
  formula_name?: string;
  formula_expression?: string;
  formula_context?: string;
}

/**
 * Convertit une flashcard LLM en format base de données
 * Gère les 4 types: basic, cloze, reversed, formula
 */
function convertToDBFormat(card: Flashcard): FlashcardDBData {
  switch (card.type) {
    case 'basic':
      return {
        type: 'basic',
        front: card.front,
        back: card.back,
      };

    case 'cloze':
      // Pour une carte cloze, on génère front/back à partir du texte à trous
      // Front: texte avec [...] à la place du mot caché
      // Back: le mot caché
      const frontText = card.text.replace(/\{\{c1::([^}]+)\}\}/, '[...]');
      return {
        type: 'cloze',
        front: frontText,
        back: card.answer,
        cloze_text: card.text,
        cloze_answer: card.answer,
      };

    case 'reversed':
      // Pour une carte reversed, on stocke uniquement le terme
      // L'UI ajoute dynamiquement "means?/signifie?/bedeutet?" selon la langue
      return {
        type: 'reversed',
        front: card.term,
        back: card.definition,
        reversed_term: card.term,
        reversed_def: card.definition,
      };

    case 'formula':
      // Pour une carte formula, on affiche le nom de la formule en front
      // et la formule elle-même en back
      const contextSuffix = card.context ? ` (${card.context})` : '';
      return {
        type: 'formula',
        front: `${card.name}${contextSuffix}`,
        back: card.formula,
        formula_name: card.name,
        formula_expression: card.formula,
        formula_context: card.context,
      };

    default:
      // Fallback pour anciens types ou types inconnus
      return {
        type: 'basic',
        front: (card as any).front || '',
        back: (card as any).back || '',
      };
  }
}

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
    } else if (type === 'formula') {
      if (card.name && card.formula) {
        validCards.push({
          type: 'formula',
          name: String(card.name).trim(),
          formula: String(card.formula).trim(),
          context: card.context ? String(card.context).trim() : undefined,
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
 * Generate course-level flashcards from source text (Anki quality)
 * This is called in parallel with chapter processing
 */
export async function generateCourseFlashcards(
  courseId: string,
  sourceText: string,
  courseTitle: string,
  contentLanguage: string,
  userId: string | null,
  config: FlashcardConfig = DEFAULT_FLASHCARD_CONFIG
): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getServiceSupabase();

  try {
    // Mark flashcards as generating
    await admin
      .from('courses')
      .update({ flashcards_status: 'generating' })
      .eq('id', courseId);

    console.log(`[flashcard-generator] Starting Anki-quality generation for course ${courseId} (niveau: ${config.niveau})`);

    const language = (contentLanguage?.toUpperCase() || 'EN') as 'EN' | 'FR' | 'DE';
    const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';
    const languageInstruction = `Generate all flashcards in ${languageName}. All content (front, back, text, term, definition) must be in ${languageName}.`;

    // Tronquer le texte source (max 12000 caractères)
    const truncatedText = sourceText.substring(0, 12000);

    // Générer le prompt utilisateur selon le niveau
    const userPrompt = getFlashcardUserPrompt(config.niveau, courseTitle, truncatedText);

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
      max_tokens: 6000, // Augmenté pour supporter plus de cartes
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    let flashcards: Flashcard[] = [];

    try {
      const parsed = JSON.parse(content || '{}');
      const rawFlashcards = Array.isArray(parsed) ? parsed : parsed.flashcards || [];

      // Valider et nettoyer les flashcards
      flashcards = validateAndCleanFlashcards(rawFlashcards);
    } catch (parseError) {
      console.error('[flashcard-generator] Error parsing flashcards:', parseError);
      throw new Error('Failed to parse generated flashcards');
    }

    if (flashcards.length === 0) {
      throw new Error('No valid flashcards generated');
    }

    // Log distribution des types
    const typeCount = flashcards.reduce((acc, fc) => {
      acc[fc.type] = (acc[fc.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[flashcard-generator] Card distribution:`, typeCount);

    // Convertir en format DB et insérer
    const flashcardRows = flashcards.map((fc) => {
      const dbData = convertToDBFormat(fc);
      return {
        course_id: courseId,
        chapter_id: null, // Course-level flashcards
        type: dbData.type,
        front: dbData.front,
        back: dbData.back,
        // Note: les champs cloze_text, cloze_answer, reversed_term, reversed_def
        // ne sont pas dans le schéma actuel - ils peuvent être ajoutés ultérieurement
      };
    });

    const { error: insertError } = await admin
      .from('flashcards')
      .insert(flashcardRows);

    if (insertError) {
      console.error('[flashcard-generator] Insert error:', insertError);
      throw insertError;
    }

    // Mark flashcards as ready
    await admin
      .from('courses')
      .update({ flashcards_status: 'ready' })
      .eq('id', courseId);

    console.log(`[flashcard-generator] Generated ${flashcards.length} Anki-quality flashcards for course ${courseId}`);

    await logEvent('flashcards_generated', {
      userId: userId ?? undefined,
      courseId,
      payload: {
        count: flashcards.length,
        type: 'course_level',
        niveau: config.niveau,
        distribution: typeCount,
      },
    });

    return { success: true, count: flashcards.length };
  } catch (error: any) {
    console.error('[flashcard-generator] Error:', error);

    // Mark flashcards as failed
    await admin
      .from('courses')
      .update({ flashcards_status: 'failed' })
      .eq('id', courseId);

    await logEvent('flashcards_generation_failed', {
      userId: userId ?? undefined,
      courseId,
      payload: { error: error?.message },
    });

    return { success: false, count: 0, error: error?.message };
  }
}

/**
 * Prompt simplifié pour les flashcards de chapitre (5-8 cartes)
 */
const CHAPTER_FLASHCARD_PROMPT = `You are an expert flashcard creator following Anki best practices.

RULES:
1. ONE fact per card (atomicity)
2. Answers: MAX 15 words
3. Use type "basic" for simple facts, "cloze" for context-dependent knowledge, "reversed" for acronyms, "formula" for mathematical equations
4. For cloze: format is {{c1::answer}} with ONE cloze per card
5. For reversed: term and definition that work both directions
6. For formula: name, formula (the equation), and optional context
7. NO lists, NO multiple answers, NO administrative content
8. ALWAYS create formula cards when the content contains mathematical equations or scientific formulas

OUTPUT FORMAT (JSON only):
{
  "flashcards": [
    {"type": "basic", "front": "...", "back": "..."},
    {"type": "cloze", "text": "The {{c1::term}} is...", "cloze_id": "c1", "answer": "term"},
    {"type": "reversed", "term": "ABC", "definition": "Full Name"},
    {"type": "formula", "name": "Energy formula", "formula": "E = mc²", "context": "Physics"}
  ]
}`;

/**
 * Generate chapter-level flashcards from chapter text (Anki quality)
 * Called after each chapter is processed
 */
export async function generateChapterFlashcards(
  courseId: string,
  chapterId: string,
  chapterText: string,
  chapterTitle: string,
  contentLanguage: string
): Promise<{ success: boolean; count: number }> {
  const admin = getServiceSupabase();

  try {
    console.log(`[flashcard-generator] Generating Anki-quality flashcards for chapter ${chapterId}`);

    const language = (contentLanguage?.toUpperCase() || 'EN') as 'EN' | 'FR' | 'DE';
    const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use faster model for chapter-level
      messages: [
        {
          role: 'system',
          content: `${CHAPTER_FLASHCARD_PROMPT}\n\nGenerate 5-8 flashcards in ${languageName}. All content must be in ${languageName}.`,
        },
        {
          role: 'user',
          content: `Create 5-8 atomic flashcards for this chapter. Mix types (basic, cloze, reversed, formula) based on content. If the content contains formulas or equations, ALWAYS include formula cards.

Chapter: ${chapterTitle}

Content:
${chapterText.substring(0, 6000)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');
    const rawFlashcards = Array.isArray(parsed) ? parsed : parsed.flashcards || [];

    // Valider et nettoyer les flashcards
    const flashcards = validateAndCleanFlashcards(rawFlashcards);

    if (flashcards.length > 0) {
      const flashcardRows = flashcards.map((fc) => {
        const dbData = convertToDBFormat(fc);
        return {
          course_id: courseId,
          chapter_id: chapterId,
          type: dbData.type,
          front: dbData.front,
          back: dbData.back,
        };
      });

      await admin.from('flashcards').insert(flashcardRows);
    }

    console.log(`[flashcard-generator] Generated ${flashcards.length} Anki-quality flashcards for chapter ${chapterId}`);

    return { success: true, count: flashcards.length };
  } catch (error) {
    console.error(`[flashcard-generator] Chapter flashcard error for ${chapterId}:`, error);
    // Don't fail the pipeline for chapter flashcards - just log and continue
    return { success: false, count: 0 };
  }
}
