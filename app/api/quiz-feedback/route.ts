import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

interface ReviewItem {
  index: number;
  question: string;
  student_answer: string;
  is_correct: boolean;
  correct_answer: string;
  explanation?: string;
}

interface ConceptFeedback {
  concept: string;
  explication: string;
}

interface FeedbackResponse {
  feedback_intro: string;
  points_maitrises: ConceptFeedback[];
  points_a_revoir: ConceptFeedback[];
  mascotte_humeur: 'happy' | 'neutral' | 'disappointed';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewItems, percentage, chapterTitle, language = 'fr' } = body as {
      reviewItems: ReviewItem[];
      percentage: number;
      chapterTitle?: string;
      language?: 'fr' | 'en' | 'de';
    };

    if (!reviewItems || reviewItems.length === 0) {
      return NextResponse.json(
        { error: 'No review items provided' },
        { status: 400 }
      );
    }

    // Determine mascot mood based on score tiers
    let mascotMood: 'happy' | 'neutral' | 'disappointed';
    if (percentage <= 33) {
      mascotMood = 'disappointed';
    } else if (percentage <= 66) {
      mascotMood = 'neutral';
    } else {
      mascotMood = 'happy';
    }

    // Prepare the questions for the AI
    const correctQuestions = reviewItems
      .filter(item => item.is_correct)
      .map(item => `- ${item.question}`)
      .join('\n');

    const incorrectQuestions = reviewItems
      .filter(item => !item.is_correct)
      .map(item => `- Question: ${item.question}\n  Réponse de l'élève: ${item.student_answer}\n  Bonne réponse: ${item.correct_answer}`)
      .join('\n\n');

    const languageInstructions = {
      fr: 'Réponds en français avec un ton bienveillant et encourageant. TUTOIE TOUJOURS l\'utilisateur (utilise "tu", "te", "tes", jamais "vous").',
      en: 'Respond in English with a kind and encouraging tone. Use informal "you" (as if talking to a friend).',
      de: 'Antworte auf Deutsch mit einem freundlichen und ermutigenden Ton. DUZE den Benutzer IMMER (verwende "du", "dich", "dein", niemals "Sie").',
    };

    const prompt = `Tu es un assistant pédagogique pour une application d'apprentissage. L'utilisateur vient de terminer un quiz.

Score: ${percentage}%
${chapterTitle ? `Thème du chapitre: ${chapterTitle}` : ''}

Questions réussies:
${correctQuestions || 'Aucune'}

Questions ratées:
${incorrectQuestions || 'Aucune'}

${languageInstructions[language]}

IMPORTANT - Contraintes strictes:
- Ne JAMAIS afficher les numéros de questions
- Ne JAMAIS recopier l'intitulé exact d'une question
- Regrouper les questions par concepts clés (max 3-4 concepts par section)
- Transformer ces concepts en explications pédagogiques concises
- Le ton doit être clair, bienveillant, utile et adapté à un étudiant

Génère un feedback au format JSON suivant:
{
  "feedback_intro": "Phrase courte personnalisée selon le score (encourageante si bas, félicitations si haut)",
  "points_maitrises": [
    {
      "concept": "Nom court du concept maîtrisé",
      "explication": "Ce que l'utilisateur a compris (1-2 phrases)"
    }
  ],
  "points_a_revoir": [
    {
      "concept": "Nom court du concept à revoir",
      "explication": "Ce que l'utilisateur doit retravailler (1-2 phrases)"
    }
  ]
}

Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use mini for faster/cheaper feedback generation
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant pédagogique expert. Tu analyses les résultats de quiz et génères du feedback constructif basé sur les concepts, pas sur les numéros de questions. Réponds toujours en JSON valide.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content || '{}') as Omit<FeedbackResponse, 'mascotte_humeur'>;

      // Add the mascot mood based on score tier
      const feedbackResponse: FeedbackResponse = {
        ...parsed,
        mascotte_humeur: mascotMood,
      };

      return NextResponse.json(feedbackResponse);
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);

      // Fallback response if API fails
      const fallbackResponse: FeedbackResponse = generateFallbackFeedback(reviewItems, percentage, mascotMood, language);
      return NextResponse.json(fallbackResponse);
    }
  } catch (error) {
    console.error('Error generating quiz feedback:', error);
    return NextResponse.json(
      { error: 'Failed to generate feedback' },
      { status: 500 }
    );
  }
}

// Fallback function when API is unavailable
function generateFallbackFeedback(
  reviewItems: ReviewItem[],
  percentage: number,
  mascotMood: 'happy' | 'neutral' | 'disappointed',
  language: 'fr' | 'en' | 'de'
): FeedbackResponse {
  const correctItems = reviewItems.filter(item => item.is_correct);
  const incorrectItems = reviewItems.filter(item => !item.is_correct);

  const intros = {
    fr: {
      low: 'Ne te décourage pas ! Chaque erreur est une opportunité d\'apprendre.',
      medium: 'Bien joué ! Tu progresses, continue comme ça.',
      high: 'Excellent travail ! Tu maîtrises bien ce chapitre.',
    },
    en: {
      low: 'Don\'t give up! Every mistake is a learning opportunity.',
      medium: 'Well done! You\'re making progress, keep it up.',
      high: 'Excellent work! You\'ve mastered this chapter well.',
    },
    de: {
      low: 'Gib nicht auf! Jeder Fehler ist eine Lernmöglichkeit.',
      medium: 'Gut gemacht! Du machst Fortschritte, weiter so.',
      high: 'Ausgezeichnete Arbeit! Du hast dieses Kapitel gut gemeistert.',
    },
  };

  const tier = percentage <= 33 ? 'low' : percentage <= 66 ? 'medium' : 'high';

  // Extract first few words as "concept" from questions
  const extractConcept = (question: string): string => {
    const words = question.split(' ').slice(0, 5).join(' ');
    return words.length > 40 ? words.substring(0, 40) + '...' : words;
  };

  const messages = {
    fr: {
      mastered: 'Tu as bien compris ce point.',
      toReview: 'Revois ce concept pour le renforcer.',
    },
    en: {
      mastered: 'You understood this point well.',
      toReview: 'Review this concept to strengthen it.',
    },
    de: {
      mastered: 'Du hast diesen Punkt gut verstanden.',
      toReview: 'Überprüfe dieses Konzept, um es zu festigen.',
    },
  };

  return {
    feedback_intro: intros[language][tier],
    points_maitrises: correctItems.slice(0, 4).map(item => ({
      concept: extractConcept(item.question),
      explication: messages[language].mastered,
    })),
    points_a_revoir: incorrectItems.slice(0, 4).map(item => ({
      concept: extractConcept(item.question),
      explication: messages[language].toReview,
    })),
    mascotte_humeur: mascotMood,
  };
}
