import { NextRequest, NextResponse } from 'next/server';
import { evaluateAnswer } from '@/lib/openai-vision';
import { memoryStore } from '@/lib/memory-store';
import { calculateBadge } from '@/lib/scoring';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is chapter-based or concept-based evaluation
    if (body.chapterId) {
      return handleChapterEvaluation(body);
    } else {
      return handleConceptEvaluation(body);
    }
  } catch (error) {
    console.error('Error evaluating answer:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate answer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// New chapter-based evaluation
async function handleChapterEvaluation(body: any) {
  const { chapterId, questionId, questionNumber, questionType, answer, correctAnswer, language = 'EN' } = body;

  if (!chapterId || !questionId || !questionNumber || !questionType || !answer) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // Get chapter
  const chapter = memoryStore.getChapter(chapterId);
  if (!chapter) {
    return NextResponse.json(
      { error: 'Chapter not found' },
      { status: 404 }
    );
  }

  // Get the question
  const question = chapter.questions?.find(q => q.id === questionId);
  if (!question) {
    return NextResponse.json(
      { error: 'Question not found' },
      { status: 404 }
    );
  }

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
    
    if (correct) {
      feedback = language === 'FR' 
        ? `✅ Correct ! Excellent travail ! Vous avez gagné ${question.points} points.`
        : `✅ Correct! Great job! You earned ${question.points} points.`;
    } else {
      // Use AI to explain why the answer is wrong
      const correctOptionIndex = correctAnswerLetter ? correctAnswerLetter.charCodeAt(0) - 65 : 0;
      const correctOptionText = question.options?.[correctOptionIndex] || '';
      
      evaluation = await evaluateAnswer(
        `Question: ${question.question}\n\nOptions:\n${question.options?.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')}\n\nStudent answered: ${userAnswer}\nCorrect answer: ${correctAnswerLetter}) ${correctOptionText}`,
        `The student chose ${userAnswer} but the correct answer is ${correctAnswerLetter}. Explain why ${correctAnswerLetter} is correct and why ${userAnswer} is incorrect.`,
        questionNumber <= 3 ? 1 : questionNumber === 4 ? 2 : 3,
        undefined,
        chapter.sourceText,
        language
      );
      
      feedback = language === 'FR'
        ? `❌ Pas tout à fait. La bonne réponse était **${correctAnswerLetter}) ${correctOptionText}**.\n\n${evaluation.feedback}`
        : `❌ Not quite. The correct answer was **${correctAnswerLetter}) ${correctOptionText}**.\n\n${evaluation.feedback}`;
    }
  } else {
    // For open-ended questions, use AI evaluation
    evaluation = await evaluateAnswer(
      question.question,
      answer,
      questionNumber <= 3 ? 1 : questionNumber === 4 ? 2 : 3,
      undefined,
      chapter.sourceText,
      language
    );
    
    score = evaluation.score || 0;
    feedback = evaluation.feedback || (language === 'FR' 
      ? 'Bon effort ! Continuez à explorer ce concept.'
      : 'Good effort! Keep exploring this concept.');
    correct = score > (question.points * 0.6); // Consider correct if > 60% of points
  }

  // Update chapter progress
  memoryStore.addChapterAnswer(
    chapterId,
    questionId,
    questionNumber,
    answer,
    correct,
    score,
    feedback
  );

  // Get updated progress
  const progress = memoryStore.getChapterProgress(chapterId);

  return NextResponse.json({
    success: true,
    correct,
    score,
    feedback,
    progress,
    phaseComplete: false, // Not used in chapter-based learning
    followUpQuestion: evaluation?.followUpQuestion,
  });
}

// Original concept-based evaluation (for backward compatibility)
async function handleConceptEvaluation(body: any) {
  const { conceptId, question, answer, phase, correctAnswer } = body;

  if (!conceptId || !question || !answer || !phase) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  // Get concept details
  const concept = memoryStore.getConcept(conceptId);
  
  if (!concept) {
    return NextResponse.json(
      { error: 'Concept not found' },
      { status: 404 }
    );
  }

  // Store student's answer in chat history
  memoryStore.addChatMessage(conceptId, 'user', answer);

  // Evaluate the answer with source text for better context
  const evaluation = await evaluateAnswer(
    question,
    answer,
    phase as 1 | 2 | 3,
    correctAnswer,
    concept.sourceText
  );

  // Store evaluation feedback in chat history
  memoryStore.addChatMessage(conceptId, 'assistant', evaluation.feedback);

  // Update progress
  const currentProgress = memoryStore.getProgress(conceptId) || {
    conceptId,
    phase1Score: 0,
    phase2Score: 0,
    phase3Score: 0,
    totalScore: 0,
    badge: null,
    completed: false,
  };

  // Update score for the current phase
  const phaseKey = `phase${phase}Score` as 'phase1Score' | 'phase2Score' | 'phase3Score';
  const newPhaseScore = evaluation.score || (evaluation.correct ? (phase === 1 ? 10 : phase === 2 ? 30 : 60) : 0);
  
  const updatedProgress = {
    ...currentProgress,
    [phaseKey]: Math.max(currentProgress[phaseKey], newPhaseScore),
  };

  // Calculate total score
  updatedProgress.totalScore = 
    updatedProgress.phase1Score + 
    updatedProgress.phase2Score + 
    updatedProgress.phase3Score;

  // Calculate badge
  updatedProgress.badge = calculateBadge(updatedProgress.totalScore);
  
  // Check if completed (all phases done)
  updatedProgress.completed = 
    updatedProgress.phase1Score > 0 && 
    updatedProgress.phase2Score > 0 && 
    updatedProgress.phase3Score > 0;

  // Save progress
  memoryStore.updateProgress(conceptId, updatedProgress);

  return NextResponse.json({
    success: true,
    evaluation: {
      correct: evaluation.correct,
      score: newPhaseScore,
      feedback: evaluation.feedback,
      needsClarification: evaluation.needsClarification,
      followUpQuestion: evaluation.followUpQuestion,
    },
    progress: updatedProgress,
  });
}
