import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const APLUS_NOTE_PROMPT = `Tu es un assistant pédagogique expert. Génère une "A+ Note" EXHAUSTIVE en Markdown.

OBJECTIF : Créer une fiche de révision COMPLÈTE. Un étudiant doit pouvoir réviser et comprendre le cours uniquement avec cette note.

=== INSTRUCTIONS (NE PAS INCLURE DANS LA NOTE) ===

EXCLURE :
- Noms d'auteurs, professeurs
- Informations administratives
- Références aux TD, TP, exercices
- Phrases introductives ("Cette section...", "Nous allons voir...")

INCLURE POUR CHAQUE CONCEPT :
1. **Définition complète** - pas juste une phrase, mais une explication suffisante
2. **Hypothèses/conditions** - quand ce concept s'applique, les conditions requises
3. **Intuition** - ce que ça signifie concrètement, pourquoi c'est important
4. **Exemples** - UNIQUEMENT reprendre les exemples EXACTEMENT comme ils apparaissent dans le cours source, avec les mêmes chiffres et résultats. Ne JAMAIS inventer d'exemples chiffrés.
5. **Catégories/cas particuliers** - les différents cas avec leurs seuils (ex: >1, <0, etc.)
6. **Liens avec autres concepts** - comment ce concept se connecte aux autres

ATTENTION AUX EXEMPLES :
- Ne jamais inventer d'exemples chiffrés
- Reprendre UNIQUEMENT les exemples présents dans le cours source
- Conserver les valeurs exactes (noms, chiffres, résultats) du cours original
- Si le cours ne contient pas d'exemple pour un concept, ne pas en créer

FORMULES :
- Donner la formule en LaTeX bloc $$
- Expliquer CHAQUE variable avec symboles LaTeX inline ($\\varepsilon$, $\\Delta$, etc.)
- Interpréter : "Si élasticité élevée, alors... Si faible, alors..."

=== FORMAT DE LA NOTE ===

# ✦ A+ Note for [Titre du cours]

**Course:** [Titre] | **Topics:** \`concept1\` \`concept2\` \`concept3\`

## Overview

1. **[Thème 1]** — liste exhaustive des concepts de ce thème
2. **[Thème 2]** — liste exhaustive des concepts

## Topic Deep Dives

### 1. [Thème]

[Phrase de contexte expliquant l'idée centrale du thème.]

- **[Concept]** : Définition complète. Hypothèses/conditions d'application. Intuition : ce que ça signifie concrètement. [Si un exemple existe dans le cours, le reprendre EXACTEMENT]. Cas particuliers avec seuils si applicable.

$$
formule
$$

*où $X$ = signification, $Y$ = signification*

Interprétation : Si $X$ est élevé, cela signifie... Si $X$ est faible...

[Continuer pour TOUS les concepts du thème]

---

## Sources

- **[Document]** — description précise du contenu couvert`;

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
    const languageInstruction = `Generate the A+ Note in ${languageName}. All content must be in ${languageName}.`;

    // Generate A+ Note using GPT-4o
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${APLUS_NOTE_PROMPT}\n\n${languageInstruction}`,
        },
        {
          role: 'user',
          content: `Create an A+ Note for this course:

Title: ${course.title}

Content:
${course.source_text.substring(0, 15000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    });

    const noteContent = response.choices[0].message.content;

    if (!noteContent) {
      return NextResponse.json({ error: 'Failed to generate note content' }, { status: 500 });
    }

    // Save note to course
    const { error: updateError } = await supabase
      .from('courses')
      .update({ aplus_note: noteContent })
      .eq('id', courseId);

    if (updateError) {
      console.error('Error saving note:', updateError);
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
    }

    return NextResponse.json({ content: noteContent });
  } catch (error) {
    console.error('Error generating note:', error);
    return NextResponse.json(
      { error: 'Failed to generate note' },
      { status: 500 }
    );
  }
}
