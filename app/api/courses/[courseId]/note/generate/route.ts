import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const APLUS_NOTE_PROMPT = `Tu es un transcripteur expert. Ta tâche est de RETRANSCRIRE intégralement le contenu d'un cours dans un format Markdown structuré et lisible.

RÈGLE ABSOLUE : Tu ne résumes PAS. Tu RETRANSCRIS. Chaque information du cours doit apparaître dans ta note.

=== CE QUE TU FAIS ===

1. Tu lis le cours du début à la fin
2. Tu retranscris TOUT le contenu pédagogique dans un format structuré
3. Tu organises par thèmes/sections logiques
4. Tu conserves chaque définition, chaque formule, chaque exemple, chaque liste

=== CE QUE TU NE FAIS PAS ===

- Tu ne résumes pas
- Tu n'omets rien
- Tu n'inventes rien
- Tu ne traduis pas les termes techniques

=== ÉLÉMENTS À RETRANSCRIRE ===

- Toutes les définitions (complètes, pas abrégées)
- Toutes les formules et équations
- Tous les exemples chiffrés (exactement comme dans le cours)
- Toutes les listes et énumérations
- Tous les cas particuliers et conditions
- Tous les acronymes avec leur signification

=== FORMULES (CRITIQUE) ===

TOUTES les formules doivent utiliser les délimiteurs LaTeX :
- Formule en ligne : $formule$
- Formule centrée : $$formule$$

JAMAIS de parenthèses simples pour les formules. Toujours $$ ou $.

Exemple CORRECT :
$$
EV_0 = \sum_{i=1}^{n} \frac{FCFF_i}{(1+k_{wacc})^i} + \frac{TV_n}{(1+k_{wacc})^n}
$$

Exemple INCORRECT (ne fais pas ça) :
( EV_0 = \sum_{i=1}^{n} ... )

Les formules importantes peuvent être mises en valeur :

> **Formule : [Nom]**
> $$
> formule
> $$
> *où $variable$ = définition*

=== FORMAT ===

# [Titre]

## [Section 1]

[Contenu retranscrit de la section]

### [Sous-section si nécessaire]

[Contenu]

**Formule :** (si présente dans le cours)
$$
formule exacte du cours
$$
*où chaque variable = sa définition*

## [Section 2]

[etc.]

---

## Glossaire

| Terme | Définition |
|-------|------------|
| ... | ... |`;

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
    const languageInstruction = `Retranscris en ${languageName}.`;

    // Generate A+ Note using GPT-4o
    // GPT-4o supports 128k context - use up to 100k chars for course content
    const maxSourceLength = 100000;
    const sourceText = course.source_text.length > maxSourceLength
      ? course.source_text.substring(0, maxSourceLength) + '\n\n[... document tronqué pour longueur ...]'
      : course.source_text;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `${APLUS_NOTE_PROMPT}\n\n${languageInstruction}`,
        },
        {
          role: 'user',
          content: `Retranscris ce cours intégralement dans un format structuré :

${sourceText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 16000,
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
