import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { authenticateRequest } from '@/lib/api-auth';
import { DEFAULT_TIME_PER_QUESTION, TIME_OPTIONS } from '@/types/defi';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();
    const body = await request.json();
    const { courseId, chapterId, timePerQuestion: inputTime } = body;

    // Validate time per question
    const validTimes = TIME_OPTIONS.map(opt => opt.value);
    const timePerQuestion = validTimes.includes(inputTime) ? inputTime : DEFAULT_TIME_PER_QUESTION;

    // Verify course/chapter exists and user has access
    if (courseId) {
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, title, user_id')
        .eq('id', courseId)
        .maybeSingle();

      if (courseError || !course) {
        return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 });
      }

      // Only course owner can create challenges from their course
      if (course.user_id && course.user_id !== auth.user.id) {
        return NextResponse.json(
          { error: "Vous n'avez pas accès à ce cours" },
          { status: 403 }
        );
      }
    }

    if (chapterId) {
      const { data: chapter, error: chapterError } = await supabase
        .from('chapters')
        .select('id, title, course_id')
        .eq('id', chapterId)
        .maybeSingle();

      if (chapterError || !chapter) {
        return NextResponse.json({ error: 'Chapitre introuvable' }, { status: 404 });
      }
    }

    // Generate a unique challenge code
    let code: string | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!code && attempts < maxAttempts) {
      const { data: generatedCode } = await supabase.rpc('generate_challenge_code');

      if (generatedCode) {
        // Check if code already exists
        const { data: existing } = await supabase
          .from('challenges')
          .select('id')
          .eq('code', generatedCode)
          .maybeSingle();

        if (!existing) {
          code = generatedCode;
        }
      }
      attempts++;
    }

    if (!code) {
      return NextResponse.json(
        { error: 'Impossible de générer un code unique' },
        { status: 500 }
      );
    }

    // Create the challenge - question_count will be determined by available questions
    const { data: challenge, error: createError } = await supabase
      .from('challenges')
      .insert({
        code,
        host_id: auth.user.id,
        course_id: courseId || null,
        chapter_id: chapterId || null,
        question_count: 0, // Will be updated after selecting questions
        time_per_question: timePerQuestion,
        status: 'lobby',
        current_question_index: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating challenge:', createError);
      return NextResponse.json(
        { error: 'Impossible de créer le défi' },
        { status: 500 }
      );
    }

    // Get user profile for display name
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', auth.user.id)
      .maybeSingle();

    // If no profile exists, use email prefix as display name
    const displayName = profile?.display_name || auth.user.email?.split('@')[0] || 'Hôte';

    // Add host as first player (always ready)
    const { error: playerError } = await supabase
      .from('challenge_players')
      .insert({
        challenge_id: challenge.id,
        user_id: auth.user.id,
        display_name: displayName,
        is_guest: false,
        is_ready: true, // Host is always ready
      });

    if (playerError) {
      console.error('Error adding host as player:', playerError);
      // Delete the challenge if we can't add the host
      await supabase.from('challenges').delete().eq('id', challenge.id);
      return NextResponse.json(
        { error: "Impossible d'ajouter l'hôte au défi" },
        { status: 500 }
      );
    }

    // Select questions for the challenge (takes all available questions)
    const questionCount = await selectQuestionsForChallenge(
      supabase,
      challenge.id,
      chapterId,
      courseId
    );

    // Update challenge with actual question count
    if (questionCount > 0) {
      await supabase
        .from('challenges')
        .update({ question_count: questionCount })
        .eq('id', challenge.id);
    }

    // Fetch full challenge with relations
    const { data: fullChallenge } = await supabase
      .from('challenges')
      .select(`
        *,
        course:courses(id, title),
        chapter:chapters(id, title)
      `)
      .eq('id', challenge.id)
      .single();

    return NextResponse.json({
      challenge: fullChallenge,
      code: challenge.code,
    });
  } catch (error) {
    console.error('Error in challenge create:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

async function selectQuestionsForChallenge(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  challengeId: string,
  chapterId: string | null,
  courseId: string | null
): Promise<number> {
  // Build query for questions
  let query = supabase.from('questions').select('*');

  if (chapterId) {
    // Get questions from specific chapter
    query = query.eq('chapter_id', chapterId);
  } else if (courseId) {
    // Get all chapters for this course
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id')
      .eq('course_id', courseId);

    if (chapters && chapters.length > 0) {
      const chapterIds = chapters.map((c) => c.id);
      query = query.in('chapter_id', chapterIds);
    } else {
      console.warn('No chapters found for course:', courseId);
      return 0;
    }
  } else {
    console.warn('No courseId or chapterId provided');
    return 0;
  }

  const { data: allQuestions, error } = await query;

  if (error) {
    console.error('Error fetching questions:', error);
    return 0;
  }

  if (!allQuestions || allQuestions.length === 0) {
    console.warn('No questions found for challenge');
    return 0;
  }

  // Shuffle all available questions (use all of them)
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);

  // Map database question format to challenge question format
  const challengeQuestions = shuffled.map((q, index) => {
    let questionType: 'multiple_choice' | 'true_false' | 'fill_blank' = 'multiple_choice';
    let questionData: any;
    let correctAnswer: string;

    // Determine type and format based on existing question structure
    const qType = q.type || q.phase || 'mcq';

    if (qType === 'true_false') {
      questionType = 'true_false';
      const isTrue = q.answer_text === 'true' || q.correct_option_index === 0;
      questionData = {
        type: 'true_false',
        statement: q.question_text,
        correct_answer: isTrue,
        explanation: q.explanation || '',
        source_reference: q.source_excerpt || '',
      };
      correctAnswer = isTrue ? 'Vrai' : 'Faux';
    } else if (qType === 'fill_blank') {
      questionType = 'fill_blank';
      let acceptedAnswers: string[] = [];
      try {
        acceptedAnswers = q.accepted_answers ? JSON.parse(q.accepted_answers) : [];
      } catch {
        acceptedAnswers = [];
      }
      questionData = {
        type: 'fill_blank',
        sentence: q.question_text,
        correct_answer: q.answer_text || '',
        accepted_answers: acceptedAnswers,
        explanation: q.explanation || '',
        source_reference: q.source_excerpt || '',
      };
      correctAnswer = q.answer_text || '';
    } else {
      // MCQ / multiple_choice
      questionType = 'multiple_choice';
      questionData = {
        type: 'multiple_choice',
        prompt: q.question_text,
        options: q.options || [],
        correct_option_index: q.correct_option_index ?? 0,
        explanation: q.explanation || '',
        source_reference: q.source_excerpt || '',
      };
      correctAnswer = q.options?.[q.correct_option_index] || '';
    }

    return {
      challenge_id: challengeId,
      question_index: index,
      question_type: questionType,
      question_data: questionData,
      correct_answer: correctAnswer,
    };
  });

  // Insert challenge questions
  const { error: insertError } = await supabase
    .from('challenge_questions')
    .insert(challengeQuestions);

  if (insertError) {
    console.error('Error inserting challenge questions:', insertError);
    return 0;
  }

  return challengeQuestions.length;
}
