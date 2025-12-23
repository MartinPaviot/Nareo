import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';

// GET - Fetch all questions for a course
export async function GET(
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

    // Check course exists and belongs to user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, quiz_status')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (courseError) {
      console.error('Error fetching course:', courseError);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Fetch chapters for this course
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, title, order_index')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    if (chaptersError) {
      console.error('Error fetching chapters:', chaptersError);
      return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
    }

    // Fetch questions for all chapters
    const chapterIds = chapters?.map(c => c.id) || [];
    let questions: any[] = [];

    if (chapterIds.length > 0) {
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .in('chapter_id', chapterIds)
        .order('question_number', { ascending: true });

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
      }

      questions = questionsData || [];
    }

    // Fetch user progress for these questions
    const questionIds = questions.map(q => q.id);
    let progressMap: Record<string, { isCorrect: boolean; attemptedAt: string }> = {};

    if (questionIds.length > 0) {
      const { data: progress } = await supabase
        .from('quiz_attempts')
        .select('question_id, is_correct, created_at')
        .eq('user_id', auth.user.id)
        .in('question_id', questionIds)
        .order('created_at', { ascending: false });

      if (progress) {
        // Keep only the latest attempt per question
        progressMap = progress.reduce((acc, p) => {
          if (!acc[p.question_id]) {
            acc[p.question_id] = {
              isCorrect: p.is_correct,
              attemptedAt: p.created_at,
            };
          }
          return acc;
        }, {} as Record<string, { isCorrect: boolean; attemptedAt: string }>);
      }
    }

    // Merge questions with progress and organize by chapter
    const questionsWithProgress = questions.map(q => ({
      id: q.id,
      chapterId: q.chapter_id,
      type: q.type || 'mcq',
      questionText: q.question_text,
      options: q.options,
      correctOptionIndex: q.correct_option_index,
      answerText: q.answer_text,
      explanation: q.explanation,
      sourceExcerpt: q.source_excerpt,
      cognitiveLevel: q.cognitive_level,
      difficulty: q.difficulty,
      points: q.points,
      questionNumber: q.question_number,
      acceptedAnswers: q.accepted_answers ? JSON.parse(q.accepted_answers) : null,
      // Progress
      attempted: !!progressMap[q.id],
      isCorrect: progressMap[q.id]?.isCorrect || null,
    }));

    // Group questions by chapter
    const questionsByChapter = chapters?.map(chapter => ({
      id: chapter.id,
      title: chapter.title,
      orderIndex: chapter.order_index,
      questions: questionsWithProgress.filter(q => q.chapterId === chapter.id),
    })) || [];

    return NextResponse.json({
      chapters: questionsByChapter,
      status: course.quiz_status || 'pending',
      totalQuestions: questionsWithProgress.length,
    });
  } catch (error) {
    console.error('Error in quiz route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new question manually
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

    // Check course exists and belongs to user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (courseError) {
      console.error('Error fetching course:', courseError);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { chapterId, type, questionText, options, correctOptionIndex, explanation, acceptedAnswers } = body;

    if (!chapterId) {
      return NextResponse.json({ error: 'Chapter ID is required' }, { status: 400 });
    }

    if (!questionText) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    // Verify chapter belongs to this course
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id')
      .eq('id', chapterId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (chapterError || !chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Get the next question number for this chapter
    const { data: existingQuestions } = await supabase
      .from('questions')
      .select('question_number')
      .eq('chapter_id', chapterId)
      .order('question_number', { ascending: false })
      .limit(1);

    const nextQuestionNumber = (existingQuestions?.[0]?.question_number || 0) + 1;

    // Build question data based on type
    const questionId = crypto.randomUUID();
    const questionType = type || 'mcq';

    let questionData: any = {
      id: questionId,
      chapter_id: chapterId,
      type: questionType,
      question_text: questionText.trim(),
      explanation: explanation?.trim() || null,
      question_number: nextQuestionNumber,
      difficulty: 2,
      points: 10,
    };

    if (questionType === 'mcq' || questionType === 'multiple_choice') {
      if (!options || !Array.isArray(options) || options.length < 2) {
        return NextResponse.json({ error: 'MCQ requires at least 2 options' }, { status: 400 });
      }
      if (typeof correctOptionIndex !== 'number' || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
        return NextResponse.json({ error: 'Valid correct option index is required' }, { status: 400 });
      }
      questionData.options = options;
      questionData.correct_option_index = correctOptionIndex;
      questionData.answer_text = options[correctOptionIndex];
      questionData.phase = 'mcq';
    } else if (questionType === 'true_false') {
      if (typeof correctOptionIndex !== 'number' || (correctOptionIndex !== 0 && correctOptionIndex !== 1)) {
        return NextResponse.json({ error: 'True/False requires correctOptionIndex 0 (true) or 1 (false)' }, { status: 400 });
      }
      questionData.options = ['Vrai', 'Faux'];
      questionData.correct_option_index = correctOptionIndex;
      questionData.answer_text = correctOptionIndex === 0 ? 'true' : 'false';
      questionData.phase = 'true_false';
    } else if (questionType === 'fill_blank') {
      if (!body.answerText) {
        return NextResponse.json({ error: 'Fill-in-the-blank requires answerText' }, { status: 400 });
      }
      questionData.answer_text = body.answerText.trim();
      questionData.options = null;
      questionData.correct_option_index = null;
      questionData.accepted_answers = JSON.stringify(acceptedAnswers || [body.answerText.trim()]);
      questionData.phase = 'fill_blank';
    }

    // Create the question
    const { data: question, error: insertError } = await supabase
      .from('questions')
      .insert(questionData)
      .select('*')
      .single();

    if (insertError) {
      console.error('Error creating question:', insertError);
      return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
    }

    return NextResponse.json({
      question: {
        id: question.id,
        chapterId: question.chapter_id,
        type: question.type,
        questionText: question.question_text,
        options: question.options,
        correctOptionIndex: question.correct_option_index,
        answerText: question.answer_text,
        explanation: question.explanation,
        questionNumber: question.question_number,
        acceptedAnswers: question.accepted_answers ? JSON.parse(question.accepted_answers) : null,
      },
    });
  } catch (error) {
    console.error('Error in quiz POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update a question
export async function PUT(
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

    // Check course exists and belongs to user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (courseError) {
      console.error('Error fetching course:', courseError);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { questionId, questionText, options, correctOptionIndex, explanation, answerText, acceptedAnswers } = body;

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    // Get the existing question to check its type and chapter
    const { data: existingQuestion, error: fetchError } = await supabase
      .from('questions')
      .select('*, chapters!inner(course_id)')
      .eq('id', questionId)
      .maybeSingle();

    if (fetchError || !existingQuestion) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Verify the question belongs to this course
    const existingChapterData = existingQuestion.chapters as unknown as { course_id: string };
    if (existingChapterData.course_id !== courseId) {
      return NextResponse.json({ error: 'Question does not belong to this course' }, { status: 403 });
    }

    // Build update data based on question type
    const updateData: any = {};

    if (questionText !== undefined) {
      updateData.question_text = questionText.trim();
    }

    if (explanation !== undefined) {
      updateData.explanation = explanation?.trim() || null;
    }

    const questionType = existingQuestion.type || 'mcq';

    if (questionType === 'mcq' || questionType === 'multiple_choice') {
      if (options !== undefined) {
        updateData.options = options;
      }
      if (correctOptionIndex !== undefined) {
        updateData.correct_option_index = correctOptionIndex;
        if (options) {
          updateData.answer_text = options[correctOptionIndex];
        } else if (existingQuestion.options) {
          updateData.answer_text = existingQuestion.options[correctOptionIndex];
        }
      }
    } else if (questionType === 'true_false') {
      if (correctOptionIndex !== undefined) {
        updateData.correct_option_index = correctOptionIndex;
        updateData.answer_text = correctOptionIndex === 0 ? 'true' : 'false';
      }
    } else if (questionType === 'fill_blank') {
      if (answerText !== undefined) {
        updateData.answer_text = answerText.trim();
      }
      if (acceptedAnswers !== undefined) {
        updateData.accepted_answers = JSON.stringify(acceptedAnswers);
      }
    }

    // Update the question
    const { data: question, error: updateError } = await supabase
      .from('questions')
      .update(updateData)
      .eq('id', questionId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating question:', updateError);
      return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
    }

    return NextResponse.json({
      question: {
        id: question.id,
        chapterId: question.chapter_id,
        type: question.type,
        questionText: question.question_text,
        options: question.options,
        correctOptionIndex: question.correct_option_index,
        answerText: question.answer_text,
        explanation: question.explanation,
        questionNumber: question.question_number,
        acceptedAnswers: question.accepted_answers ? JSON.parse(question.accepted_answers) : null,
      },
    });
  } catch (error) {
    console.error('Error in quiz PUT route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a question
export async function DELETE(
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

    // Get question ID from query params
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Check course exists and belongs to user
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (courseError) {
      console.error('Error fetching course:', courseError);
      return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 });
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Verify the question belongs to this course
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('id, chapters!inner(course_id)')
      .eq('id', questionId)
      .maybeSingle();

    if (fetchError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // chapters is returned as an object due to !inner join
    const chapterData = question.chapters as unknown as { course_id: string };
    if (chapterData.course_id !== courseId) {
      return NextResponse.json({ error: 'Question does not belong to this course' }, { status: 403 });
    }

    // Delete question_concepts links first (foreign key constraint)
    await supabase
      .from('question_concepts')
      .delete()
      .eq('question_id', questionId);

    // Delete quiz_attempts for this question
    await supabase
      .from('quiz_attempts')
      .delete()
      .eq('question_id', questionId);

    // Delete the question
    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (deleteError) {
      console.error('Error deleting question:', deleteError);
      return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in quiz DELETE route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
