import OpenAI from 'openai';
import { getServiceSupabase } from '@/lib/supabase';
import { logEvent } from './analytics';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FLASHCARDS_PROMPT = `Tu es un expert pédagogique. Génère des flashcards VARIÉES et COMPLÈTES pour réviser efficacement.

=== INSTRUCTIONS ===

EXCLURE du contenu :
- Noms d'auteurs, professeurs
- Informations administratives (dates, structure du cours)
- Références aux TD, TP, exercices

TYPES DE FLASHCARDS À GÉNÉRER (varier les types) :

1. **Définition** : Terme → Définition complète
   Exemple: {"type": "definition", "front": "Élasticité-prix de la demande", "back": "Mesure de la sensibilité de la quantité demandée aux variations de prix. Une élasticité élevée signifie que la demande réagit fortement aux changements de prix."}

2. **Formule** : Nom → Formule + explication des variables
   Exemple: {"type": "formula", "front": "Formule de l'élasticité-prix", "back": "εD = (ΔD/D) / (ΔP/P) où εD = élasticité, ΔD = variation de demande, D = demande initiale, ΔP = variation de prix, P = prix initial"}

3. **Condition/Seuil** : Question sur un cas → Réponse avec le seuil
   Exemple: {"type": "condition", "front": "Quand un bien est-il considéré comme inférieur ?", "back": "Quand l'élasticité-revenu est négative (εR < 0). La demande diminue quand le revenu augmente."}

4. **Intuition** : Question "Que signifie..." → Explication concrète
   Exemple: {"type": "intuition", "front": "Que signifie une élasticité-prix élevée ?", "back": "Une petite variation de prix entraîne une grande variation de la demande. Les consommateurs sont très sensibles au prix."}

5. **Lien entre concepts** : Question sur la relation → Explication du lien
   Exemple: {"type": "link", "front": "Relation entre prix d'équilibre et surplus total ?", "back": "Au prix d'équilibre (où offre = demande), le surplus total (consommateur + producteur) est maximisé."}

=== FORMAT DE SORTIE ===

Retourne un JSON avec les flashcards variées :
{
  "flashcards": [
    {"type": "definition", "front": "...", "back": "..."},
    {"type": "formula", "front": "...", "back": "..."},
    ...
  ]
}

Assure-toi de :
- Couvrir TOUS les concepts importants du cours
- Varier les types de flashcards
- Rendre les réponses (back) complètes mais concises
- Inclure les formules importantes avec leurs variables expliquées`;

interface FlashcardData {
  type: string;
  front: string;
  back: string;
}

/**
 * Generate course-level flashcards from source text
 * This is called in parallel with chapter processing
 */
export async function generateCourseFlashcards(
  courseId: string,
  sourceText: string,
  courseTitle: string,
  contentLanguage: string,
  userId: string | null
): Promise<{ success: boolean; count: number; error?: string }> {
  const admin = getServiceSupabase();

  try {
    // Mark flashcards as generating
    await admin
      .from('courses')
      .update({ flashcards_status: 'generating' })
      .eq('id', courseId);

    console.log(`[flashcard-generator] Starting generation for course ${courseId}`);

    const language = contentLanguage?.toUpperCase() || 'EN';
    const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';
    const languageInstruction = `Generate all flashcards in ${languageName}. All content must be in ${languageName}.`;

    // Generate flashcards using GPT-4o
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${FLASHCARDS_PROMPT}\n\n${languageInstruction}`,
        },
        {
          role: 'user',
          content: `Create 20 flashcards from this course material:

Title: ${courseTitle}

Content:
${sourceText.substring(0, 12000)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    let flashcards: FlashcardData[] = [];

    try {
      const parsed = JSON.parse(content || '{}');
      const rawFlashcards = Array.isArray(parsed) ? parsed : parsed.flashcards || [];

      flashcards = rawFlashcards.map((fc: any) => ({
        type: fc.type || 'definition',
        front: fc.front || fc.concept || '',
        back: fc.back || fc.definition || '',
      })).filter((fc: FlashcardData) => fc.front && fc.back);
    } catch (parseError) {
      console.error('[flashcard-generator] Error parsing flashcards:', parseError);
      throw new Error('Failed to parse generated flashcards');
    }

    if (flashcards.length === 0) {
      throw new Error('No valid flashcards generated');
    }

    // Insert flashcards into the dedicated table
    const flashcardRows = flashcards.map((fc) => ({
      course_id: courseId,
      chapter_id: null, // Course-level flashcards
      type: ['definition', 'formula', 'condition', 'intuition', 'link'].includes(fc.type)
        ? fc.type
        : 'definition',
      front: fc.front,
      back: fc.back,
    }));

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

    console.log(`[flashcard-generator] Generated ${flashcards.length} flashcards for course ${courseId}`);

    await logEvent('flashcards_generated', {
      userId: userId ?? undefined,
      courseId,
      payload: { count: flashcards.length, type: 'course_level' },
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
 * Generate chapter-level flashcards from chapter text
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
    console.log(`[flashcard-generator] Generating flashcards for chapter ${chapterId}`);

    const language = contentLanguage?.toUpperCase() || 'EN';
    const languageName = language === 'FR' ? 'French' : language === 'DE' ? 'German' : 'English';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use faster model for chapter-level
      messages: [
        {
          role: 'system',
          content: `${FLASHCARDS_PROMPT}\n\nGenerate 5-8 flashcards in ${languageName} for this specific chapter.`,
        },
        {
          role: 'user',
          content: `Create flashcards for this chapter:

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

    const flashcards = rawFlashcards
      .map((fc: any) => ({
        type: fc.type || 'definition',
        front: fc.front || '',
        back: fc.back || '',
      }))
      .filter((fc: FlashcardData) => fc.front && fc.back);

    if (flashcards.length > 0) {
      const flashcardRows = flashcards.map((fc: FlashcardData) => ({
        course_id: courseId,
        chapter_id: chapterId,
        type: ['definition', 'formula', 'condition', 'intuition', 'link'].includes(fc.type)
          ? fc.type
          : 'definition',
        front: fc.front,
        back: fc.back,
      }));

      await admin.from('flashcards').insert(flashcardRows);
    }

    console.log(`[flashcard-generator] Generated ${flashcards.length} flashcards for chapter ${chapterId}`);

    return { success: true, count: flashcards.length };
  } catch (error) {
    console.error(`[flashcard-generator] Chapter flashcard error for ${chapterId}:`, error);
    // Don't fail the pipeline for chapter flashcards - just log and continue
    return { success: false, count: 0 };
  }
}
