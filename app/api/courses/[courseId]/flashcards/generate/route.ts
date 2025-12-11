import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';
import OpenAI from 'openai';

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

Retourne un JSON avec exactement 20 flashcards variées :
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;

    // Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    // Get course with source text
    const { data: course, error } = await supabase
      .from('courses')
      .select('id, title, source_text, content_language')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

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
    const language = course.content_language?.toUpperCase() || 'EN';
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

Title: ${course.title}

Content:
${course.source_text.substring(0, 12000)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    let flashcards: Array<{
      id?: string;
      type: string;
      front: string;
      back: string;
      mastery: string;
      correctCount: number;
      incorrectCount: number;
    }> = [];

    try {
      const parsed = JSON.parse(content || '{}');
      const rawFlashcards = Array.isArray(parsed) ? parsed : parsed.flashcards || [];

      // Validate and filter flashcards
      flashcards = rawFlashcards
        .map((fc: { type?: string; front?: string; back?: string; concept?: string; definition?: string }) => ({
          type: fc.type || 'definition',
          front: fc.front || fc.concept || '',
          back: fc.back || fc.definition || '',
          mastery: 'new',
          correctCount: 0,
          incorrectCount: 0,
        }))
        .filter((fc: { front: string; back: string }) => fc.front && fc.back);
    } catch (parseError) {
      console.error('Error parsing flashcards:', parseError);
      return NextResponse.json({ error: 'Failed to parse generated flashcards' }, { status: 500 });
    }

    if (flashcards.length === 0) {
      return NextResponse.json({ error: 'No valid flashcards generated' }, { status: 500 });
    }

    // Delete existing flashcards for this course (regeneration)
    await supabase
      .from('flashcards')
      .delete()
      .eq('course_id', courseId);

    // Insert flashcards into dedicated table
    const flashcardRows = flashcards.map((fc: { type: string; front: string; back: string }) => ({
      course_id: courseId,
      chapter_id: null, // Course-level flashcards
      type: ['definition', 'formula', 'condition', 'intuition', 'link'].includes(fc.type)
        ? fc.type
        : 'definition',
      front: fc.front,
      back: fc.back,
    }));

    const { data: insertedFlashcards, error: insertError } = await supabase
      .from('flashcards')
      .insert(flashcardRows)
      .select('id, type, front, back');

    if (insertError) {
      console.error('Error saving flashcards:', insertError);
      return NextResponse.json({ error: 'Failed to save flashcards' }, { status: 500 });
    }

    // Update course flashcards_status
    await supabase
      .from('courses')
      .update({ flashcards_status: 'ready' })
      .eq('id', courseId);

    // Return flashcards with IDs and default progress
    const flashcardsWithProgress = (insertedFlashcards || []).map(fc => ({
      id: fc.id,
      type: fc.type,
      front: fc.front,
      back: fc.back,
      mastery: 'new',
      correctCount: 0,
      incorrectCount: 0,
    }));

    return NextResponse.json({ flashcards: flashcardsWithProgress });
  } catch (error) {
    console.error('Error generating flashcards:', error);
    return NextResponse.json(
      { error: 'Failed to generate flashcards' },
      { status: 500 }
    );
  }
}
