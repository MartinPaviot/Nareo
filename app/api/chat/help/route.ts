import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai-vision';

export async function POST(request: NextRequest) {
  try {
    const { action, question, chapterTitle, language = 'FR', correctAnswer, questionType } = await request.json();

    if (!action || !question) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Toujours forcer le français
    const prompts = {
      clarify: questionType === 'mcq' && correctAnswer
        ? `L'étudiant ne sait pas répondre à cette question QCM. Aide-le en expliquant la bonne réponse :\n\nQuestion : ${question}\n\nRéponse correcte : ${correctAnswer}\n\nExplique pourquoi c'est la bonne réponse de manière claire et pédagogique. Aide l'étudiant à comprendre le concept. Réponds en français.`
        : `L'étudiant ne sait pas répondre à cette question. Aide-le en expliquant ce qui est attendu et en donnant des pistes de réflexion :\n\nQuestion : ${question}\n\nFournis une explication claire et amicale qui l'aide à comprendre ce qui est demandé et comment y répondre. Réponds en français.`,
      simplify: `Décompose cette question en termes plus simples pour l'étudiant :\n\nQuestion : ${question}\n\nSimplifie le langage et explique tous les concepts complexes. Réponds en français.`,
      example: `Fournis un exemple utile pour illustrer cette question :\n\nQuestion : ${question}\n\nDonne un exemple concret et accessible qui aide à comprendre le concept. Réponds en français.`,
    };

    const prompt = prompts[action as keyof typeof prompts];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Tu es Nareo, un tuteur IA amical et pédagogue. Tu enseignes le chapitre "${chapterTitle}". 

RÈGLES IMPORTANTES :
• Sois encourageant, clair et concis
• Utilise un langage simple et des emojis de temps en temps pour être sympathique
• Tu dois TOUJOURS répondre en français dans un style clair et pédagogique adapté à un étudiant

RÈGLES DE FORMATAGE ET TYPOGRAPHIE :
• CONSERVE tous les traits d'union normaux du français : est-il, peut-être, aujourd'hui, lui-même, c'est-à-dire, demi-journée
• Pour faire des listes, utilise UNIQUEMENT des puces (•) ou une numérotation (1, 2, 3)
• N'utilise JAMAIS de tirets (-) comme décoration ou pour débuter une ligne de liste
• Ne commence JAMAIS une ligne par une virgule ou un signe de ponctuation bizarre
• Les listes doivent être claires et propres, sans symboles étranges

GESTION DU BOUTON "JE NE SAIS PAS" :
• Quand l'étudiant clique sur "Je ne sais pas", tu dois l'aider à comprendre
• Pour les QCM, explique la bonne réponse et pourquoi c'est correct
• Pour les questions ouvertes, donne des pistes de réflexion et des exemples
• Reste bienveillant et encourageant`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const helpText = response.choices[0].message.content || 'Laissez-moi vous aider !';

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
