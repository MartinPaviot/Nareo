import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';
import { generateMixedQuizParallel } from '@/lib/openai-vision';
import { QuizConfig, DEFAULT_QUIZ_CONFIG, getAdjustedQuestionCount } from '@/types/quiz-personnalisation';

// 60 seconds is enough for a single chapter (works on Vercel Hobby plan)
export const maxDuration = 60;

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

function toModelLanguageCode(language: string): 'EN' | 'FR' | 'DE' {
  const lower = (language || '').toLowerCase();
  return lower === 'fr' ? 'FR' : lower === 'de' ? 'DE' : 'EN';
}

// Get True/False labels based on language
function getTrueFalseLabels(language: 'EN' | 'FR' | 'DE'): [string, string] {
  switch (language) {
    case 'FR':
      return ['Vrai', 'Faux'];
    case 'DE':
      return ['Wahr', 'Falsch'];
    case 'EN':
    default:
      return ['True', 'False'];
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string; chapterId: string }> }
) {
  const { courseId, chapterId } = await params;

  // Try to authenticate user (optional for guest users)
  const auth = await authenticateRequest(request);
  const guestSessionId = getGuestSessionIdFromRequest(request);

  // Must have either authentication or guest session
  if (!auth && !guestSessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse quiz config from request body (optional)
  let quizConfig: QuizConfig = DEFAULT_QUIZ_CONFIG;
  let clearExisting = false;
  try {
    const body = await request.json();
    if (body.config) {
      quizConfig = {
        niveau: body.config.niveau || DEFAULT_QUIZ_CONFIG.niveau,
        types: {
          qcm: body.config.types?.qcm ?? DEFAULT_QUIZ_CONFIG.types.qcm,
          vrai_faux: body.config.types?.vrai_faux ?? DEFAULT_QUIZ_CONFIG.types.vrai_faux,
          texte_trous: body.config.types?.texte_trous ?? DEFAULT_QUIZ_CONFIG.types.texte_trous,
        },
      };
    }
    clearExisting = body.clearExisting ?? false;
  } catch {
    // No body or invalid JSON, use defaults
  }

  console.log(`[chapter-quiz-generate] Starting for chapter ${chapterId} with config:`, JSON.stringify(quizConfig, null, 2));

  const supabase = await createSupabaseServerClient();
  const admin = getServiceSupabase();

  try {
    // Verify course ownership
    let course;
    if (auth) {
      const result = await supabase
        .from('courses')
        .select('id, title, content_language, user_id')
        .eq('id', courseId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      course = result.data;
    } else {
      const result = await admin
        .from('courses')
        .select('id, title, content_language, user_id, guest_session_id')
        .eq('id', courseId)
        .is('user_id', null)
        .eq('guest_session_id', guestSessionId)
        .maybeSingle();
      course = result.data;
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get chapter with its content
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('id, title, summary, order_index, difficulty, source_text, status')
      .eq('id', chapterId)
      .eq('course_id', courseId)
      .maybeSingle();

    if (chapterError || !chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Check if chapter has enough content
    if (!chapter.source_text || chapter.source_text.trim().length < 100) {
      return NextResponse.json({
        error: 'Chapter has insufficient content for quiz generation',
        details: `Chapter text is ${chapter.source_text?.length || 0} characters (minimum 100 required)`
      }, { status: 400 });
    }

    // If clearExisting, delete old questions for this chapter
    if (clearExisting) {
      console.log(`[chapter-quiz-generate] Clearing existing questions for chapter ${chapterId}`);

      // Delete quiz attempts for this chapter
      await admin
        .from('quiz_attempts')
        .delete()
        .eq('chapter_id', chapterId);

      // Get existing questions to delete their concept links
      const { data: existingQuestions } = await admin
        .from('questions')
        .select('id')
        .eq('chapter_id', chapterId);

      if (existingQuestions && existingQuestions.length > 0) {
        for (const q of existingQuestions) {
          await admin.from('question_concepts').delete().eq('question_id', q.id);
        }
      }

      // Delete questions
      await admin
        .from('questions')
        .delete()
        .eq('chapter_id', chapterId);

      console.log(`[chapter-quiz-generate] Deleted ${existingQuestions?.length || 0} existing questions`);
    }

    // Mark chapter as processing
    await admin
      .from('chapters')
      .update({ status: 'processing' })
      .eq('id', chapterId);

    // Get concepts for this chapter
    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, title, description, importance')
      .eq('chapter_id', chapterId);

    const modelLanguage = toModelLanguageCode(course.content_language || 'en');
    const chapterConcepts = concepts || [];

    // Calculate target questions
    const maxQuestionsPerChapter = quizConfig.niveau === 'exhaustif'
      ? 50
      : getAdjustedQuestionCount(10, quizConfig.niveau);

    console.log(`[chapter-quiz-generate] Generating ${maxQuestionsPerChapter} questions for "${chapter.title}"`);

    // Generate questions with parallel type generation
    let generated;
    try {
      generated = await generateMixedQuizParallel(
        {
          index: chapter.order_index + 1,
          title: chapter.title,
          short_summary: chapter.summary || '',
          difficulty: chapter.difficulty === 'hard' ? 3 : chapter.difficulty === 'medium' ? 2 : 1,
        },
        chapter.source_text,
        modelLanguage,
        quizConfig,
        { enableSemanticValidation: false }
      );
    } catch (genError: any) {
      console.error(`[chapter-quiz-generate] Generation failed for "${chapter.title}":`, genError.message);

      // Mark chapter as failed
      await admin
        .from('chapters')
        .update({ status: 'failed' })
        .eq('id', chapterId);

      return NextResponse.json({
        error: 'Quiz generation failed',
        details: genError.message
      }, { status: 500 });
    }

    const rawQuestions: any[] = Array.isArray(generated)
      ? generated
      : (generated as any).questions || [];

    console.log(`[chapter-quiz-generate] Generated ${rawQuestions.length} questions for "${chapter.title}"`);

    // Insert questions (limited to quota)
    const questionsToInsert = rawQuestions.slice(0, maxQuestionsPerChapter);
    const insertedQuestions: any[] = [];
    const coverageMap = new Map<string, number>();
    chapterConcepts.forEach(c => coverageMap.set(c.id, 0));

    for (let idx = 0; idx < questionsToInsert.length; idx++) {
      const q = questionsToInsert[idx];
      const questionId = randomUUID();

      const conceptIdsFromLLM: string[] = Array.isArray((q as any).concept_ids)
        ? (q as any).concept_ids.filter((id: string) => coverageMap.has(id))
        : [];
      const fallbackConceptId = chapterConcepts[idx % Math.max(1, chapterConcepts.length)]?.id;
      const targetConceptIds: string[] = conceptIdsFromLLM.length > 0
        ? Array.from(new Set(conceptIdsFromLLM))
        : fallbackConceptId ? [fallbackConceptId] : [];

      const questionType = q.type || 'multiple_choice';

      let questionData: any = {
        id: questionId,
        chapter_id: chapterId,
        concept_id: null,
        question_number: q.questionNumber ?? q.order ?? idx + 1,
        explanation: q.explanation || null,
        source_excerpt: q.source_reference || null,
        cognitive_level: q.cognitive_level || null,
      };

      if (questionType === 'true_false') {
        const [trueLabel, falseLabel] = getTrueFalseLabels(modelLanguage);
        questionData = {
          ...questionData,
          question_text: q.statement,
          answer_text: q.correct_answer ? 'true' : 'false',
          options: [trueLabel, falseLabel],
          type: 'mcq',
          difficulty: 2,
          phase: 'true_false',
          points: q.points ?? 10,
          correct_option_index: q.correct_answer ? 0 : 1,
        };
      } else if (questionType === 'fill_blank') {
        questionData = {
          ...questionData,
          question_text: q.sentence,
          answer_text: q.correct_answer,
          options: JSON.stringify(q.accepted_answers || [q.correct_answer]),
          type: 'open',
          difficulty: 2,
          phase: 'fill_blank',
          points: q.points ?? 10,
          correct_option_index: null,
        };
      } else {
        const rawOptions: string[] = Array.isArray(q.options) ? q.options : [];
        const fixedOptions: string[] =
          rawOptions.length === 4
            ? rawOptions
            : [...rawOptions, 'Option C', 'Option D'].slice(0, 4);

        const textCandidates = [q.expected_answer, q.correctAnswer, q.answer, q.answer_text].filter(Boolean) as string[];
        const findIndexFromText = () =>
          fixedOptions.findIndex((opt: string) =>
            textCandidates.some(txt => txt && opt.toLowerCase() === txt.toLowerCase())
          );
        const providedIndex =
          typeof q.correct_option_index === 'number' &&
          q.correct_option_index >= 0 &&
          q.correct_option_index < fixedOptions.length
            ? q.correct_option_index
            : -1;
        const derivedIndex = findIndexFromText();
        const correctIndex = providedIndex >= 0 ? providedIndex : derivedIndex >= 0 ? derivedIndex : 0;
        const correctOption = fixedOptions[correctIndex];

        questionData = {
          ...questionData,
          question_text: q.prompt || q.question,
          answer_text: q.expected_answer || correctOption || q.correctAnswer || q.answer || null,
          options: fixedOptions,
          type: 'mcq',
          difficulty: q.phase === 'mcq' ? 2 : 3,
          phase: q.phase || 'mcq',
          points: q.points ?? 10,
          correct_option_index: correctIndex,
        };
      }

      const { error: questionInsertError } = await admin.from('questions').insert(questionData);

      if (!questionInsertError) {
        insertedQuestions.push({
          id: questionId,
          type: questionType === 'true_false' ? 'vrai_faux' : questionType === 'fill_blank' ? 'texte_trous' : 'QCM',
          questionText: questionData.question_text,
          options: Array.isArray(questionData.options) ? questionData.options : null,
          correctOptionIndex: questionData.correct_option_index,
          answerText: questionData.answer_text,
          explanation: questionData.explanation,
        });

        // Link to concepts
        for (const conceptId of targetConceptIds) {
          const { error: linkError } = await admin.from('question_concepts').insert({
            question_id: questionId,
            concept_id: conceptId,
          });
          if (!linkError) {
            coverageMap.set(conceptId, (coverageMap.get(conceptId) ?? 0) + 1);
          }
        }
      }
    }

    // Update chapter coverage stats
    const covered = Array.from(coverageMap.values()).filter(v => v > 0).length;
    const coverageRatio = chapterConcepts.length > 0 ? covered / chapterConcepts.length : 1;

    await admin
      .from('chapters')
      .update({
        status: 'ready',
        concept_count: chapterConcepts.length,
        covered_concepts: covered,
        coverage_ratio: coverageRatio,
      })
      .eq('id', chapterId);

    console.log(`[chapter-quiz-generate] Chapter "${chapter.title}" completed with ${insertedQuestions.length} questions`);

    return NextResponse.json({
      success: true,
      chapterId,
      chapterTitle: chapter.title,
      questionsGenerated: insertedQuestions.length,
      questions: insertedQuestions,
      coverage: {
        concepts: chapterConcepts.length,
        covered,
        ratio: coverageRatio,
      }
    });

  } catch (error: any) {
    console.error('[chapter-quiz-generate] Error:', error);

    // Mark chapter as failed
    await admin
      .from('chapters')
      .update({ status: 'failed' })
      .eq('id', chapterId);

    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
