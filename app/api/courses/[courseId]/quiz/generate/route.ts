import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';
import { generateMixedQuiz } from '@/lib/openai-vision';
import { CourseDeduplicationTracker } from '@/lib/llm';
import { QuizConfig, DEFAULT_QUIZ_CONFIG } from '@/types/quiz-personnalisation';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

// Parallel processing configuration - reduced to 1 for better progress tracking
const MAX_CONCURRENT_CHAPTERS = 1;

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

// Create SSE stream for progress updates
function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const sendProgress = (data: {
    type: string;
    message?: string;
    progress?: number;
    chapterIndex?: number;
    totalChapters?: number;
    questionsGenerated?: number;
  }) => {
    if (controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    }
  };

  // Send individual question as it's generated
  const sendQuestion = (data: {
    chapterId: string;
    chapterTitle: string;
    question: {
      id: string;
      type: string;
      questionText: string;
      options: string[] | null;
      correctOptionIndex: number | null;
      answerText: string | null;
      explanation: string | null;
      questionNumber: number;
    };
    questionsGenerated: number;
    progress: number;
  }) => {
    if (controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'question',
        data: {
          chapterId: data.chapterId,
          chapterTitle: data.chapterTitle,
          question: data.question,
        },
        questionsGenerated: data.questionsGenerated,
        progress: data.progress,
      })}\n\n`));
    }
  };

  const close = () => {
    if (controller) {
      controller.close();
    }
  };

  return { stream, sendProgress, sendQuestion, close };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  // Try to authenticate user (optional for guest users)
  const auth = await authenticateRequest(request);
  const guestSessionId = getGuestSessionIdFromRequest(request);

  // Must have either authentication or guest session
  if (!auth && !guestSessionId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse quiz config from request body (optional)
  let quizConfig: QuizConfig = DEFAULT_QUIZ_CONFIG;
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
  } catch {
    // No body or invalid JSON, use defaults
  }

  console.log(`[quiz-generate] Starting with config:`, JSON.stringify(quizConfig, null, 2));

  const supabase = await createSupabaseServerClient();
  const admin = getServiceSupabase();

  console.log(`[quiz-generate] Auth: ${auth ? 'authenticated' : 'guest'}, courseId: ${courseId}`);

  try {
    // Get course
    // For authenticated users: check user_id match
    // For guest users: check guest_session_id match and user_id is null
    let course;
    let courseError;

    if (auth) {
      // Authenticated user: must own the course
      const result = await supabase
        .from('courses')
        .select('id, title, content_language, quiz_status, user_id')
        .eq('id', courseId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      course = result.data;
      courseError = result.error;
    } else {
      // Guest user: course must have no user_id and matching guest_session_id
      const result = await admin
        .from('courses')
        .select('id, title, content_language, quiz_status, user_id, guest_session_id')
        .eq('id', courseId)
        .is('user_id', null)
        .eq('guest_session_id', guestSessionId)
        .maybeSingle();
      course = result.data;
      courseError = result.error;
    }

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check if quiz generation is already in progress
    if (course.quiz_status === 'generating') {
      return NextResponse.json({
        message: 'Quiz generation already in progress',
        status: 'generating'
      });
    }

    // If quiz already exists (ready), delete old questions to regenerate
    if (course.quiz_status === 'ready') {
      console.log(`[quiz-generate] Quiz already exists, deleting old questions for regeneration...`);

      const { data: courseChapters } = await admin
        .from('chapters')
        .select('id')
        .eq('course_id', courseId);

      if (courseChapters && courseChapters.length > 0) {
        const chapterIds = courseChapters.map(ch => ch.id);

        const { data: questionsToDelete } = await admin
          .from('questions')
          .select('id')
          .in('chapter_id', chapterIds);

        if (questionsToDelete && questionsToDelete.length > 0) {
          const questionIds = questionsToDelete.map(q => q.id);
          await admin
            .from('question_concepts')
            .delete()
            .in('question_id', questionIds);

          await admin
            .from('questions')
            .delete()
            .in('chapter_id', chapterIds);

          console.log(`[quiz-generate] Deleted ${questionsToDelete.length} old questions`);
        }
      }
    }

    // Mark quiz as generating + save config
    const updateData: Record<string, unknown> = { quiz_status: 'generating' };
    try {
      updateData.quiz_config = quizConfig;
    } catch {
      // quiz_config column might not exist yet
    }

    const { error: updateError } = await admin
      .from('courses')
      .update(updateData)
      .eq('id', courseId);

    if (updateError) {
      if (updateError.message?.includes('quiz_config')) {
        await admin.from('courses').update({ quiz_status: 'generating' }).eq('id', courseId);
      } else {
        return NextResponse.json({ error: 'Failed to update course status' }, { status: 500 });
      }
    }

    // Get all chapters with their text
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('id, title, summary, order_index, difficulty, source_text, status')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    if (chaptersError || !chapters || chapters.length === 0) {
      await admin.from('courses').update({ quiz_status: 'failed' }).eq('id', courseId);
      return NextResponse.json({ error: 'No chapters found' }, { status: 400 });
    }

    // Get concepts for each chapter
    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, chapter_id, title, description, importance')
      .eq('course_id', courseId);

    const modelLanguage = toModelLanguageCode(course.content_language || 'en');

    // Create SSE stream
    const { stream, sendProgress, sendQuestion, close } = createSSEStream();

    // Start generation in background (async, don't await)
    (async () => {
      try {
        const conceptsByChapter = new Map<string, typeof concepts>();
        (concepts || []).forEach(concept => {
          const chapterConcepts = conceptsByChapter.get(concept.chapter_id) || [];
          chapterConcepts.push(concept);
          conceptsByChapter.set(concept.chapter_id, chapterConcepts);
        });

        const deduplicationTracker = new CourseDeduplicationTracker(0.85);
        const chaptersToProcess = chapters.filter(ch => ch.status === 'ready');
        const totalChapters = chaptersToProcess.length;
        let totalQuestionsGenerated = 0;

        // Send initial progress
        sendProgress({
          type: 'progress',
          message: 'Initialisation...',
          progress: 5,
          totalChapters
        });

        for (let i = 0; i < chaptersToProcess.length; i += MAX_CONCURRENT_CHAPTERS) {
          const batch = chaptersToProcess.slice(i, i + MAX_CONCURRENT_CHAPTERS);

          for (const chapter of batch) {
            const chapterIndex = i + 1;
            const baseProgress = 10 + Math.floor((chapterIndex / totalChapters) * 80);

            try {
              // Update progress: starting chapter
              sendProgress({
                type: 'progress',
                message: `Analyse du chapitre ${chapterIndex}/${totalChapters}: ${chapter.title}`,
                progress: baseProgress,
                chapterIndex,
                totalChapters,
                questionsGenerated: totalQuestionsGenerated
              });

              await admin
                .from('chapters')
                .update({ status: 'processing' })
                .eq('id', chapter.id);

              const chapterConcepts = conceptsByChapter.get(chapter.id) || [];
              const chapterText = chapter.source_text || '';

              if (!chapterText) {
                console.warn(`Chapter ${chapter.id} has no source text, skipping`);
                await admin.from('chapters').update({ status: 'ready' }).eq('id', chapter.id);
                continue;
              }

              const coverageMap = new Map<string, number>();
              chapterConcepts.forEach(c => coverageMap.set(c.id, 0));

              let pass = 0;
              let finalCoverage = 0;

              while (pass < 2) {
                // Update progress: generating questions
                sendProgress({
                  type: 'progress',
                  message: `Génération des questions pour "${chapter.title}"${pass > 0 ? ' (complétion)' : ''}...`,
                  progress: baseProgress + 3,
                  chapterIndex,
                  totalChapters,
                  questionsGenerated: totalQuestionsGenerated
                });

                const generated = await generateMixedQuiz(
                  {
                    index: chapter.order_index + 1,
                    title: chapter.title,
                    short_summary: chapter.summary || '',
                    difficulty: chapter.difficulty === 'hard' ? 3 : chapter.difficulty === 'medium' ? 2 : 1,
                  },
                  chapterText,
                  modelLanguage,
                  quizConfig,
                  { enableSemanticValidation: true }
                );

                const rawQuestions: any[] = Array.isArray(generated)
                  ? generated
                  : (generated as any).questions || [];

                // Update progress: deduplication
                sendProgress({
                  type: 'progress',
                  message: `Vérification des doublons...`,
                  progress: baseProgress + 5,
                  chapterIndex,
                  totalChapters,
                  questionsGenerated: totalQuestionsGenerated
                });

                const dedupeResult = deduplicationTracker.filterQuestions(
                  rawQuestions.map(q => ({ prompt: q.prompt || q.question, ...q })),
                  chapter.order_index
                );
                const questions: any[] = dedupeResult.filtered as any[];

                // Update progress: saving questions
                sendProgress({
                  type: 'progress',
                  message: `Enregistrement de ${questions.length} questions...`,
                  progress: baseProgress + 7,
                  chapterIndex,
                  totalChapters,
                  questionsGenerated: totalQuestionsGenerated
                });

                // Insert questions
                for (let idx = 0; idx < questions.length; idx++) {
                  const q = questions[idx];
                  const questionId = randomUUID();

                  const conceptIdsFromLLM: string[] = Array.isArray((q as any).concept_ids)
                    ? (q as any).concept_ids.filter((id: string) => coverageMap.has(id))
                    : [];
                  const fallbackConceptId = chapterConcepts[(idx + pass) % Math.max(1, chapterConcepts.length)]?.id;
                  const targetConceptIds: string[] = conceptIdsFromLLM.length > 0
                    ? Array.from(new Set(conceptIdsFromLLM))
                    : fallbackConceptId ? [fallbackConceptId] : [];

                  const questionType = q.type || 'multiple_choice';

                  let questionData: any = {
                    id: questionId,
                    chapter_id: chapter.id,
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
                    totalQuestionsGenerated++;

                    // Send the question via SSE so frontend can display it immediately
                    const questionProgress = baseProgress + Math.floor((idx / questions.length) * 5);
                    sendQuestion({
                      chapterId: chapter.id,
                      chapterTitle: chapter.title,
                      question: {
                        id: questionId,
                        type: questionType === 'true_false' ? 'vrai_faux' : questionType === 'fill_blank' ? 'texte_trous' : 'QCM',
                        questionText: questionData.question_text,
                        options: Array.isArray(questionData.options) ? questionData.options : null,
                        correctOptionIndex: questionData.correct_option_index,
                        answerText: questionData.answer_text,
                        explanation: questionData.explanation,
                        questionNumber: questionData.question_number,
                      },
                      questionsGenerated: totalQuestionsGenerated,
                      progress: questionProgress,
                    });
                  }

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

                const covered = Array.from(coverageMap.values()).filter(v => v > 0).length;
                finalCoverage = chapterConcepts.length > 0 ? covered / chapterConcepts.length : 1;

                await admin
                  .from('chapters')
                  .update({
                    concept_count: chapterConcepts.length,
                    covered_concepts: covered,
                    coverage_ratio: finalCoverage,
                  })
                  .eq('id', chapter.id);

                if (finalCoverage >= 0.80) {
                  break;
                }
                pass += 1;
              }

              // Mark chapter as ready
              await admin
                .from('chapters')
                .update({ status: 'ready' })
                .eq('id', chapter.id);

              // Update progress: chapter complete
              sendProgress({
                type: 'progress',
                message: `Chapitre ${chapterIndex}/${totalChapters} terminé ✓`,
                progress: baseProgress + 10,
                chapterIndex,
                totalChapters,
                questionsGenerated: totalQuestionsGenerated
              });

              console.log(`[quiz-generate] Chapter ${chapter.order_index + 1} (${chapter.title}) quiz generated - ${totalQuestionsGenerated} total questions`);

            } catch (chapterError: any) {
              console.error(`Chapter ${chapter.id} quiz generation failed:`, chapterError);
              await admin
                .from('chapters')
                .update({ status: 'failed' })
                .eq('id', chapter.id);

              sendProgress({
                type: 'progress',
                message: `Erreur sur le chapitre ${chapterIndex}`,
                progress: baseProgress + 10,
                chapterIndex,
                totalChapters,
                questionsGenerated: totalQuestionsGenerated
              });
            }
          }
        }

        // Update course quiz status
        const { data: readyChapters } = await admin
          .from('chapters')
          .select('id')
          .eq('course_id', courseId)
          .eq('status', 'ready');

        const allReady = readyChapters?.length === chapters.length;

        await admin
          .from('courses')
          .update({
            quiz_status: allReady ? 'ready' : 'partial',
            chapter_count: readyChapters?.length || 0,
          })
          .eq('id', courseId);

        // Send complete
        sendProgress({
          type: 'complete',
          message: 'Quiz généré avec succès !',
          progress: 100,
          questionsGenerated: totalQuestionsGenerated
        });

        console.log(`[quiz-generate] Course ${courseId} quiz generation complete. ${totalQuestionsGenerated} questions generated.`);

      } catch (error: any) {
        console.error('[quiz-generate] Generation error:', error);

        await admin
          .from('courses')
          .update({ quiz_status: 'failed' })
          .eq('id', courseId);

        sendProgress({
          type: 'error',
          message: error.message || 'Erreur lors de la génération du quiz'
        });
      } finally {
        close();
      }
    })();

    // Return SSE stream response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Error starting quiz generation:', error);

    await admin
      .from('courses')
      .update({ quiz_status: 'failed' })
      .eq('id', courseId);

    return NextResponse.json(
      { error: 'Failed to start quiz generation' },
      { status: 500 }
    );
  }
}
