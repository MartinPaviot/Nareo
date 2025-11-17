import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user.id;

    const body = await request.json();
    const { chapterId, examDate, dailyTime, objective, language = 'EN' } = body;

    // Validate inputs
    if (!chapterId || !examDate || !dailyTime || !objective) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('📚 Generating study plan for chapter:', chapterId, 'user:', userId);

    const supabase = await createSupabaseServerClient();

    // Fetch chapter data from Supabase
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('*')
      .eq('id', chapterId)
      .eq('user_id', userId)
      .maybeSingle();

    if (chapterError) {
      console.error('❌ Error fetching chapter:', chapterError);
      return NextResponse.json(
        { error: 'Failed to fetch chapter' },
        { status: 500 }
      );
    }

    if (!chapter) {
      console.error('❌ Chapter not found:', chapterId);
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      );
    }

    console.log('✅ Chapter found:', chapter.title);

    // Fetch user progress from Supabase
    const { data: progress, error: progressError } = await supabase
      .from('chapter_progress')
      .select('*')
      .eq('chapter_id', chapterId)
      .eq('user_id', userId)
      .maybeSingle();

    if (progressError) {
      console.error('❌ Error fetching progress:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch progress' },
        { status: 500 }
      );
    }

    if (!progress || !progress.completed) {
      console.error('❌ Quiz not completed for chapter:', chapterId);
      return NextResponse.json(
        { error: 'Quiz must be completed before generating study plan' },
        { status: 400 }
      );
    }

    console.log('✅ Progress found - Score:', progress.score, 'Questions:', progress.questions_answered);

    // Calculate days until exam
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exam = new Date(examDate);
    exam.setHours(0, 0, 0, 0);
    let daysUntilExam = Math.ceil((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExam <= 0) {
      daysUntilExam = 1;
    }

    const examDateLabel = exam.toISOString().split('T')[0];
    
    console.log('📅 Days until exam:', daysUntilExam, 'Exam date:', examDateLabel);

    // Generate dates for each day
    const dailyDates = [];
    for (let i = 0; i < daysUntilExam; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dailyDates.push(date.toISOString().split('T')[0]);
    }

    // Prepare data for OpenAI
    const answers = progress.answers || [];
    const correctAnswers = answers.filter((a: any) => a.correct === true);
    const incorrectAnswers = answers.filter((a: any) => a.correct === false);
    const totalQuestions = answers.length;
    const accuracy = totalQuestions > 0 ? (correctAnswers.length / totalQuestions) * 100 : 0;

    // Build dates list for prompt
    const datesListText = dailyDates.map((date, i) => `Jour ${i + 1}: ${date}`).join('\n');

    // Build prompt parts
    const contextPart1 = `Tu es un tuteur prive expert pour un eleve francais preparant un examen.

CHAPITRE:
Titre: ${chapter.title}
Resume: ${chapter.description || chapter.summary || ''}
Contenu source: ${chapter.source_text?.substring(0, 3000) || chapter.description || chapter.summary || ''}

PERFORMANCE DE L ELEVE:
- Score total: ${progress.score}/100
- Questions repondues: ${progress.questions_answered}
- Reponses correctes: ${correctAnswers.length}
- Reponses incorrectes: ${incorrectAnswers.length}
- Precision: ${accuracy.toFixed(1)}%

PARAMETRES DE REVISION:
- Date de l examen: ${examDateLabel}
- Jours disponibles avant l examen: ${daysUntilExam}
- Temps disponible par jour: ${dailyTime} minutes
- Objectif d apprentissage: ${objective}`;

    const instructionPart = `En te basant sur ces informations, cree un plan de revision personnalise reparti sur TOUS les ${daysUntilExam} jours disponibles entre aujourd hui et la date de l examen.

CONTRAINTES CRITIQUES:
1. Tu DOIS creer exactement ${daysUntilExam} sessions dans le tableau dailySchedule
2. Chaque session doit avoir un day de 1 a ${daysUntilExam} (continu, sans sauter de jour)
3. NE concentre PAS toutes les revisions sur un seul jour
4. Utilise TOUS les jours disponibles de maniere equilibree
5. Les premiers jours: apprentissage et comprehension des concepts
6. Les jours intermediaires: pratique et exercices
7. Les derniers jours: revision rapide et consolidation
8. Adapte la charge de travail a un eleve de college ou lycee
9. Chaque jour doit avoir environ ${dailyTime} minutes d activites au total

DATES PRECISES A UTILISER:
${datesListText}

FORMAT JSON EXACT A RETOURNER (TOUT EN FRANCAIS):
{
  "summary": "Resume en 2-3 phrases du plan de revision",
  "diagnostic": {
    "strongAreas": ["Concepts maitrises par l eleve"],
    "weakAreas": ["Concepts a ameliorer"],
    "criticalGaps": ["Lacunes critiques a combler"]
  },
  "dailySchedule": [
    {
      "day": 1,
      "date": "${dailyDates[0]}",
      "focus": "Focus principal du jour 1",
      "activities": [
        {
          "time": "${dailyTime} minutes",
          "activity": "Activite specifique",
          "description": "Description detaillee",
          "documentReference": "Reference au document"
        }
      ],
      "goals": ["Objectif 1", "Objectif 2"]
    }
  ],
  "documentReferences": [
    {
      "topic": "Nom du sujet",
      "location": "Localisation dans le document",
      "importance": "Importance de cette section",
      "reviewPriority": "high"
    }
  ],
  "studyTips": ["Conseil pratique 1", "Conseil pratique 2"]
}

RAPPEL IMPORTANT:
- Le tableau dailySchedule doit contenir EXACTEMENT ${daysUntilExam} elements
- Les valeurs day doivent aller de 1 a ${daysUntilExam} sans interruption
- Utilise les dates fournies ci-dessus pour chaque jour
- Repartis le contenu de maniere progressive et equilibree
- TOUT le contenu doit etre en francais naturel et fluide

Retourne UNIQUEMENT le JSON valide, sans texte additionnel.`;

    console.log('📡 Calling GPT-4 to generate study plan...');

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: contextPart1,
        },
        {
          role: 'user',
          content: instructionPart,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    const studyPlan = JSON.parse(content || '{}');

    console.log('✅ Study plan generated successfully');

    // Return the study plan
    return NextResponse.json({
      success: true,
      studyPlan,
      metadata: {
        chapterId,
        examDate,
        dailyTime,
        objective,
        daysUntilExam,
        studentScore: progress.score,
        accuracy: accuracy.toFixed(1),
      },
    });
  } catch (error) {
    console.error('❌ Error generating study plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate study plan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
