import { NextRequest, NextResponse } from 'next/server';
import { evaluateAnswer } from '@/lib/openai-vision';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { calculateBadge } from '@/lib/scoring';
import { openai } from '@/lib/openai-vision';

// ✅ Fonction helper pour traduire une option de QCM en français
async function translateOptionToFrench(optionText: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Tu es un traducteur professionnel. Traduis UNIQUEMENT le texte fourni en français, sans ajouter d\'explication. Si le texte est déjà en français, retourne-le tel quel.',
        },
        {
          role: 'user',
          content: optionText,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    return response.choices[0].message.content?.trim() || optionText;
  } catch (error) {
    console.error('❌ Error translating option text:', error);
    // Fallback: simple remplacement de mots courants
    return optionText
      .replace(/characters?/gi, 'caractères')
      .replace(/posts?/gi, 'publications')
      .replace(/views?/gi, 'vues')
      .replace(/clicks?/gi, 'clics')
      .replace(/professionally/gi, 'professionnellement')
      .replace(/click-through rate/gi, 'taux de clic');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is chapter-based or concept-based evaluation
    if (body.chapterId) {
      return handleChapterEvaluation(request, body);
    } else {
      return handleConceptEvaluation(request, body);
    }
  } catch (error) {
    console.error('❌ Error evaluating answer:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate answer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// New chapter-based evaluation
async function handleChapterEvaluation(request: NextRequest, body: any) {
  const { chapterId, questionId, questionNumber, questionType, answer, correctAnswer, language = 'EN' } = body;

  // Authenticate user
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = auth.user.id;

  if (!chapterId || !questionId || !questionNumber || !questionType || !answer) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  console.log('📝 Evaluating answer for chapter:', chapterId, 'question:', questionNumber, 'user:', userId);

  const supabase = await createSupabaseServerClient();

  // Get chapter from Supabase
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

  // Get the question
  const question = chapter.questions?.find((q: any) => q.id === questionId);
  if (!question) {
    console.error('❌ Question not found:', questionId);
    return NextResponse.json(
      { error: 'Question not found' },
      { status: 404 }
    );
  }

  console.log('✅ Question found:', question.type, 'points:', question.points);

  let evaluation: any;
  let score = 0;
  let correct: boolean | undefined;
  let feedback = '';

  // Handle MCQ differently from open-ended
  if (questionType === 'mcq') {
    // For MCQ, check if answer matches correct answer (A, B, C, or D)
    const userAnswer = answer.trim().toUpperCase();
    const correctAnswerLetter = correctAnswer?.trim().toUpperCase();
    
    correct = userAnswer === correctAnswerLetter;
    score = correct ? question.points : 0;
    
    console.log('📊 MCQ evaluation:', { userAnswer, correctAnswerLetter, correct, score });

    if (correct) {
      // ✅ Pour réponse correcte, on peut aussi afficher l'option en français si besoin
      const correctOptionIndex = correctAnswerLetter ? correctAnswerLetter.charCodeAt(0) - 65 : 0;
      const correctOptionText = question.options?.[correctOptionIndex] || '';
      const correctOptionTextFR = await translateOptionToFrench(correctOptionText);

      feedback = `✅ Correct ! Vous avez choisi **${correctAnswerLetter}) ${correctOptionTextFR}**. Excellent travail ! Vous avez gagné ${question.points} points.`;
    } else {
      // Use AI to explain why the answer is wrong
      const correctOptionIndex = correctAnswerLetter ? correctAnswerLetter.charCodeAt(0) - 65 : 0;
      const correctOptionText = question.options?.[correctOptionIndex] || '';

      // ✅ TRADUIRE le texte de l'option correcte en français
      const correctOptionTextFR = await translateOptionToFrench(correctOptionText);

      evaluation = await evaluateAnswer(
        `Question: ${question.question}\n\nOptions:\n${question.options?.map((opt: string, idx: number) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')}\n\nRéponse de l'étudiant : ${userAnswer}\nBonne réponse : ${correctAnswerLetter}) ${correctOptionText}`,
        `L'étudiant a choisi ${userAnswer} mais la bonne réponse est ${correctAnswerLetter}. Explique en français pourquoi ${correctAnswerLetter} est correct et pourquoi ${userAnswer} est incorrect. Reformule clairement la bonne réponse en français, même si le texte source était en anglais.`,
        questionNumber <= 3 ? 1 : questionNumber === 4 ? 2 : 3,
        undefined,
        chapter.source_text,
        'FR' // Toujours forcer le français
      );

      // ✅ Utiliser la version française dans le feedback final
      feedback = `❌ Pas tout à fait. La bonne réponse était **${correctAnswerLetter}) ${correctOptionTextFR}**.\n\n${evaluation.feedback}`;
    }
  } else {
    // For open-ended questions, use AI evaluation
    console.log('🤖 Using AI evaluation for open-ended question');
    evaluation = await evaluateAnswer(
      question.question,
      answer,
      questionNumber <= 3 ? 1 : questionNumber === 4 ? 2 : 3,
      undefined,
      chapter.source_text,
      language
    );


    score = evaluation.score || 0;
    feedback = evaluation.feedback || 'Bon effort ! Continuez à explorer ce concept.';
    correct = score > (question.points * 0.6); // Consider correct if > 60% of points

    console.log('📊 AI evaluation result:', { score, correct });
  }

  // Update chapter progress in Supabase
  console.log('💾 Updating chapter progress in Supabase');
  
  // Get current progress
  const { data: currentProgress, error: progressFetchError } = await supabase
    .from('chapter_progress')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('user_id', userId)
    .maybeSingle();

  if (progressFetchError && progressFetchError.code !== 'PGRST116') {
    console.error('❌ Error fetching progress:', progressFetchError);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }

  // Prepare answer record
  const answerRecord = {
    questionId,
    questionNumber,
    answer,
    correct,
    score,
    feedback,
    timestamp: new Date().toISOString(),
  };

  let updatedProgress;

  if (currentProgress) {
    // Update existing progress
    const answers = currentProgress.answers || [];
    // Remove any existing answer for this question
    const filteredAnswers = answers.filter((a: any) => a.questionNumber !== questionNumber);
    // Add new answer
    const newAnswers = [...filteredAnswers, answerRecord];
    
    const newScore = newAnswers.reduce((sum: number, a: any) => sum + (a.score || 0), 0);
    const newQuestionsAnswered = newAnswers.length;
    const newCompleted = newQuestionsAnswered >= 5;
    const newCurrentQuestion = Math.min(questionNumber + 1, 5);

    const { data: updated, error: updateError } = await supabase
      .from('chapter_progress')
      .update({
        current_question: newCurrentQuestion,
        questions_answered: newQuestionsAnswered,
        score: newScore,
        completed: newCompleted,
        answers: newAnswers,
      })
      .eq('chapter_id', chapterId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating progress:', updateError);
      return NextResponse.json(
        { error: 'Failed to update progress' },
        { status: 500 }
      );
    }

    updatedProgress = updated;
  } else {
    // Create new progress
    const newCurrentQuestion = Math.min(questionNumber + 1, 5);
    
    const { data: created, error: createError } = await supabase
      .from('chapter_progress')
      .insert({
        chapter_id: chapterId,
        user_id: userId,
        current_question: newCurrentQuestion,
        questions_answered: 1,
        score: score,
        completed: false,
        answers: [answerRecord],
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating progress:', createError);
      return NextResponse.json(
        { error: 'Failed to create progress' },
        { status: 500 }
      );
    }

    updatedProgress = created;
  }

  console.log('✅ Progress updated successfully');

  // Format progress for response (camelCase for frontend)
  const formattedProgress = {
    chapterId: updatedProgress.chapter_id,
    currentQuestion: updatedProgress.current_question,
    questionsAnswered: updatedProgress.questions_answered,
    score: updatedProgress.score,
    completed: updatedProgress.completed,
    answers: updatedProgress.answers,
  };

  return NextResponse.json({
    success: true,
    correct,
    score,
    feedback,
    progress: formattedProgress,
    phaseComplete: false, // Not used in chapter-based learning
    followUpQuestion: evaluation?.followUpQuestion,
  });
}

// Original concept-based evaluation (for backward compatibility)
// This is deprecated but kept for any legacy code
async function handleConceptEvaluation(request: NextRequest, body: any) {
  const { conceptId, question, answer, phase, correctAnswer } = body;

  // Authenticate user
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = auth.user.id;

  if (!conceptId || !question || !answer || !phase) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  console.log('📝 Evaluating concept answer (legacy):', conceptId, 'phase:', phase, 'user:', userId);

  const supabase = await createSupabaseServerClient();

  // Get concept details from Supabase
  const { data: concept, error: conceptError } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', conceptId)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (conceptError) {
    console.error('❌ Error fetching concept:', conceptError);
    return NextResponse.json(
      { error: 'Failed to fetch concept' },
      { status: 500 }
    );
  }

  if (!concept) {
    console.error('❌ Concept not found:', conceptId);
    return NextResponse.json(
      { error: 'Concept not found' },
      { status: 404 }
    );
  }

  // Evaluate the answer with source text for better context
  const evaluation = await evaluateAnswer(
    question,
    answer,
    phase as 1 | 2 | 3,
    correctAnswer,
    concept.source_text
  );

  // Update score for the current phase
  const phaseKey = `phase${phase}_score` as 'phase1_score' | 'phase2_score' | 'phase3_score';
  const newPhaseScore = evaluation.score || (evaluation.correct ? (phase === 1 ? 10 : phase === 2 ? 30 : 60) : 0);
  
  // Get current progress
  const { data: currentProgress, error: progressFetchError } = await supabase
    .from('user_progress')
    .select('*')
    .eq('concept_id', conceptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (progressFetchError && progressFetchError.code !== 'PGRST116') {
    console.error('❌ Error fetching progress:', progressFetchError);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }

  const phase1Score = phaseKey === 'phase1_score' ? newPhaseScore : (currentProgress?.phase1_score || 0);
  const phase2Score = phaseKey === 'phase2_score' ? newPhaseScore : (currentProgress?.phase2_score || 0);
  const phase3Score = phaseKey === 'phase3_score' ? newPhaseScore : (currentProgress?.phase3_score || 0);
  
  const totalScore = phase1Score + phase2Score + phase3Score;
  const badge = calculateBadge(totalScore);
  const completed = phase1Score > 0 && phase2Score > 0 && phase3Score > 0;

  // Upsert progress
  const { data: updatedProgress, error: upsertError } = await supabase
    .from('user_progress')
    .upsert({
      concept_id: conceptId,
      user_id: userId,
      phase1_score: phase1Score,
      phase2_score: phase2Score,
      phase3_score: phase3Score,
      total_score: totalScore,
      badge: badge,
      completed: completed,
    }, {
      onConflict: 'concept_id,user_id'
    })
    .select()
    .single();

  if (upsertError) {
    console.error('❌ Error updating progress:', upsertError);
    return NextResponse.json(
      { error: 'Failed to update progress' },
      { status: 500 }
    );
  }

  console.log('✅ Concept progress updated successfully');

  return NextResponse.json({
    success: true,
    evaluation: {
      correct: evaluation.correct,
      score: newPhaseScore,
      feedback: evaluation.feedback,
      needsClarification: evaluation.needsClarification,
      followUpQuestion: evaluation.followUpQuestion,
    },
    progress: {
      conceptId: updatedProgress.concept_id,
      phase1Score: updatedProgress.phase1_score,
      phase2Score: updatedProgress.phase2_score,
      phase3Score: updatedProgress.phase3_score,
      totalScore: updatedProgress.total_score,
      badge: updatedProgress.badge,
      completed: updatedProgress.completed,
    },
  });
}
