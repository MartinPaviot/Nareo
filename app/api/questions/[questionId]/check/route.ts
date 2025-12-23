import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  context: { params: { questionId: string } } | { params: Promise<{ questionId: string }> }
) {
  try {
    const auth = await authenticateRequest(request); // optional auth
    const supabase = await createSupabaseServerClient();
    const userId = auth?.user.id || null;
    const resolvedParams = "then" in context.params ? await context.params : context.params;
    const questionId = resolvedParams.questionId;

    const body = await request.json();
    const { answer } = body;

    console.log('[check] RECEIVED REQUEST:', {
      questionId,
      body,
      answer,
      answerType: typeof answer,
    });

    // Accept 0 as a valid answer (for MCQ index 0)
    if (answer === undefined || answer === null || answer === '') {
      console.error('[check] VALIDATION FAILED - answer is missing:', { answer, body });
      return NextResponse.json({ error: 'Answer is required' }, { status: 400 });
    }

    // Get the question
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      console.error('[check] question_not_found', { questionId, questionError });
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Fetch chapter first (without join to avoid ambiguous relationship error)
    const { data: chapterRow, error: chapterError } = await supabase
      .from('chapters')
      .select('id, course_id, user_id')
      .eq('id', question.chapter_id)
      .single();

    if (chapterError || !chapterRow) {
      console.error('[check] chapter_not_found', { chapterId: question.chapter_id, chapterError });
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Fetch course separately to avoid ambiguous FK relationship
    const { data: courseInfo, error: courseError } = await supabase
      .from('courses')
      .select('is_public, status, user_id')
      .eq('id', chapterRow.course_id)
      .single();

    if (courseError || !courseInfo) {
      console.error('[check] course_not_found', { courseId: chapterRow.course_id, courseError });
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const isOwner = !!userId && courseInfo.user_id === userId;
    const isGuestCourse = !courseInfo.user_id; // uploaded by guest
    const isPublic = courseInfo.is_public === true && courseInfo.status === 'ready';
    if (!isOwner && !isGuestCourse && !isPublic) {
      console.warn('[check] unauthorized', { questionId, chapterId: chapterRow.id, userId });
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check answer based on question type
    let isCorrect = false;
    let feedback = '';
    let effectiveCorrectIndex: number | undefined = undefined;

    if (question.type === 'mcq') {
      const userAnswerRaw = String(answer).trim();

      console.log('[check] DEBUG received answer:', {
        answer,
        userAnswerRaw,
        answerType: typeof answer,
      });

      // Normalize options as array
      const optionsArray: string[] = Array.isArray(question.options)
        ? question.options
        : question.options && typeof question.options === 'object'
          ? Object.values(question.options)
          : [];
      const correctIndex =
        typeof question.correct_option_index === 'number' && question.correct_option_index >= 0
          ? question.correct_option_index
          : optionsArray.findIndex(opt => question.answer_text && opt?.toLowerCase() === question.answer_text.toLowerCase());
      effectiveCorrectIndex = correctIndex >= 0 ? correctIndex : 0;
      const correctText =
        effectiveCorrectIndex >= 0 && effectiveCorrectIndex < optionsArray.length
          ? optionsArray[effectiveCorrectIndex]
          : question.answer_text;

      // Allow answering by index (0-based) or by option text
      const answerIndex = Number.isFinite(Number(userAnswerRaw)) ? Number(userAnswerRaw) : -1;

      console.log('[check] DEBUG comparison:', {
        answerIndex,
        effectiveCorrectIndex,
        willCompareIndices: answerIndex >= 0 && effectiveCorrectIndex >= 0,
        comparison: answerIndex === effectiveCorrectIndex,
      });

      if (answerIndex >= 0 && effectiveCorrectIndex >= 0) {
        isCorrect = answerIndex === effectiveCorrectIndex;
      } else if (correctText) {
        isCorrect = userAnswerRaw.toLowerCase() === correctText.toLowerCase();
      }

      feedback = isCorrect
        ? 'Correct! Well done.'
        : `Not quite. The correct answer is option ${effectiveCorrectIndex}: ${correctText || 'unavailable'}.`;

      console.log('[check] mcq_eval', {
        questionId,
        userId,
        answerRaw: userAnswerRaw,
        optionsArray,
        correctIndex,
        effectiveCorrectIndex,
        correctText,
        isCorrect,
      });
    } else {
      // For open questions, use simple keyword matching
      // In production, you'd want to use an LLM for better evaluation
      const userAnswerLower = answer.toLowerCase();
      const correctAnswerLower = (question.answer_text || '').toLowerCase();

      // Simple keyword-based checking (can be improved)
      const keywords = correctAnswerLower.split(' ').filter((w: string) => w.length > 3);
      const matchedKeywords = keywords.filter((k: string) => userAnswerLower.includes(k));
      const matchRatio = matchedKeywords.length / Math.max(keywords.length, 1);

      if (matchRatio > 0.6) {
        isCorrect = true;
        feedback = 'Good answer! You covered the key points.';
      } else {
        isCorrect = false;
        feedback = `Your answer is incomplete. Key points to include: ${question.answer_text}`;
      }
    }

    // Calculate points - fixed at 10 points per question
    const pointsEarned = isCorrect ? 10 : 0;

    // Update chapter_mastery and course_mastery for logged-in users
    if (userId) {
      try {
        // Update chapter mastery
        const { error: masteryError } = await supabase.rpc('update_chapter_mastery', {
          p_user_id: userId,
          p_chapter_id: question.chapter_id,
          p_course_id: chapterRow.course_id,
          p_is_correct: isCorrect,
        });

        if (masteryError) {
          console.error('[check] Error updating chapter mastery:', masteryError);
        }

        // Update course overall mastery percentage
        console.log('[check] Calling update_course_mastery for course:', chapterRow.course_id);
        const { data: courseMasteryData, error: courseMasteryError } = await supabase.rpc('update_course_mastery', {
          p_course_id: chapterRow.course_id,
        });

        console.log('[check] update_course_mastery result:', { data: courseMasteryData, error: courseMasteryError });

        if (courseMasteryError) {
          console.error('[check] Error updating course mastery:', courseMasteryError);
        }

        // Update last_studied_at on the course
        const { error: lastStudiedError } = await supabase
          .from('courses')
          .update({ last_studied_at: new Date().toISOString() })
          .eq('id', chapterRow.course_id);

        if (lastStudiedError) {
          console.error('[check] Error updating last_studied_at:', lastStudiedError);
        }
      } catch (masteryErr) {
        console.error('[check] Exception updating mastery:', masteryErr);
      }
    }

    // For MCQ, use effectiveCorrectIndex which is what we actually compared against
    // This ensures consistency between what we compared and what we return to the frontend
    const returnedCorrectIndex = question.type === 'mcq' ? (effectiveCorrectIndex ?? 0) : undefined;

    return NextResponse.json({
      success: true,
      isCorrect,
      feedback,
      pointsEarned,
      correctAnswer: question.answer_text,
      correctOptionIndex: returnedCorrectIndex,
      explanation: question.explanation || null,
      sourceExcerpt: question.source_excerpt || null,
    });
  } catch (error) {
    console.error('Error checking answer:', error);
    return NextResponse.json(
      { error: 'Failed to check answer' },
      { status: 500 }
    );
  }
}
