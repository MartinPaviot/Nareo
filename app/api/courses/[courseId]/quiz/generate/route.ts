import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';
import { generateMixedQuiz } from '@/lib/openai-vision';
import { CourseDeduplicationTracker } from '@/lib/llm';
import { QuizConfig, DEFAULT_QUIZ_CONFIG, getAdjustedQuestionCount } from '@/types/quiz-personnalisation';

// Increase max duration for quiz generation (requires Vercel Pro plan for > 60s)
// This is needed because generating questions for multiple chapters takes time
export const maxDuration = 300; // 5 minutes max

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
function createSSEStream(signal?: AbortSignal) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let isClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      // Listen for client disconnection
      if (signal) {
        signal.addEventListener('abort', () => {
          console.log('[SSE] Client disconnected (abort signal)');
          isClosed = true;
          try {
            controller?.close();
          } catch {
            // Already closed
          }
        });
      }
    },
    cancel() {
      console.log('[SSE] Stream cancelled by client');
      isClosed = true;
    },
  });

  const sendProgress = (data: {
    type: string;
    message?: string;
    step?: string;
    progress?: number;
    chapterIndex?: number;
    totalChapters?: number;
    questionsGenerated?: number;
    totalQuestions?: number;
  }) => {
    if (controller && !isClosed) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      } catch (e) {
        console.log('[SSE] Failed to send progress, client likely disconnected');
        isClosed = true;
      }
    }
  };

  const isClientConnected = () => !isClosed;

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
    totalQuestions?: number;
    progress: number;
  }) => {
    if (controller && !isClosed) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'question',
          data: {
            chapterId: data.chapterId,
            chapterTitle: data.chapterTitle,
            question: data.question,
          },
          questionsGenerated: data.questionsGenerated,
          totalQuestions: data.totalQuestions,
          progress: data.progress,
        })}\n\n`));
      } catch (e) {
        console.log('[SSE] Failed to send question, client likely disconnected');
        isClosed = true;
      }
    }
  };

  const close = () => {
    if (controller && !isClosed) {
      isClosed = true;
      try {
        controller.close();
      } catch {
        // Already closed
      }
    }
  };

  return { stream, sendProgress, sendQuestion, close, isClientConnected };
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

    // ALWAYS delete old questions AND reset quiz attempts before regenerating
    // This ensures a clean slate for the new quiz generation
    console.log(`[quiz-generate] Resetting quiz data before regeneration (current status: ${course.quiz_status})...`);

    const { data: courseChapters } = await admin
      .from('chapters')
      .select('id')
      .eq('course_id', courseId);

    if (courseChapters && courseChapters.length > 0) {
      const chapterIds = courseChapters.map(ch => ch.id);
      console.log(`[quiz-generate] Found ${chapterIds.length} chapters to clean: ${chapterIds.join(', ')}`);

      // Delete quiz attempts for all chapters of this course
      for (const chapterId of chapterIds) {
        const { error: attemptError } = await admin
          .from('quiz_attempts')
          .delete()
          .eq('chapter_id', chapterId);
        if (attemptError) {
          console.error(`[quiz-generate] Error deleting attempts for chapter ${chapterId}:`, attemptError);
        }
      }

      // Also delete course-level quiz attempts (if any)
      await admin
        .from('quiz_attempts')
        .delete()
        .eq('course_id', courseId);

      console.log(`[quiz-generate] Deleted quiz attempts for course`);

      // Count questions before deletion
      const { count: beforeCount } = await admin
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .in('chapter_id', chapterIds);

      console.log(`[quiz-generate] Questions before deletion: ${beforeCount}`);

      // Delete questions for each chapter individually (more reliable than .in())
      for (const chapterId of chapterIds) {
        // First delete question_concepts links
        const { data: chapterQuestions } = await admin
          .from('questions')
          .select('id')
          .eq('chapter_id', chapterId);

        if (chapterQuestions && chapterQuestions.length > 0) {
          const questionIds = chapterQuestions.map(q => q.id);
          for (const qId of questionIds) {
            await admin.from('question_concepts').delete().eq('question_id', qId);
          }
        }

        // Then delete questions
        const { error: deleteError } = await admin
          .from('questions')
          .delete()
          .eq('chapter_id', chapterId);

        if (deleteError) {
          console.error(`[quiz-generate] Error deleting questions for chapter ${chapterId}:`, deleteError);
        }
      }

      // Verify deletion
      const { count: afterCount } = await admin
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .in('chapter_id', chapterIds);

      console.log(`[quiz-generate] Questions after deletion: ${afterCount} (deleted ${(beforeCount || 0) - (afterCount || 0)})`);

      if ((afterCount || 0) > 0) {
        console.error(`[quiz-generate] WARNING: ${afterCount} questions still remain after deletion!`);
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

    // Create SSE stream with abort signal to detect client disconnection
    const { stream, sendProgress, sendQuestion, close, isClientConnected } = createSSEStream(request.signal);

    // Start generation in background (async, don't await)
    // IMPORTANT: Generation continues even if client disconnects - questions are saved to DB
    (async () => {
      // Declare heartbeat interval outside try block so it can be cleared in finally
      let heartbeatInterval: ReturnType<typeof setInterval> | undefined;

      try {
        const conceptsByChapter = new Map<string, typeof concepts>();
        (concepts || []).forEach(concept => {
          const chapterConcepts = conceptsByChapter.get(concept.chapter_id) || [];
          chapterConcepts.push(concept);
          conceptsByChapter.set(concept.chapter_id, chapterConcepts);
        });

        // Seuil de déduplication à 0.92 = rejette seulement les questions quasi-identiques
        // (0.85 était trop strict et rejetait des questions sur des sujets connexes)
        const deduplicationTracker = new CourseDeduplicationTracker(0.92);
        // Process ALL chapters that have source_text, not just 'ready' ones
        // This ensures manually added chapters and chapters with any status get questions
        const chaptersToProcess = chapters.filter(ch => {
          const hasSourceText = ch.source_text && ch.source_text.trim().length >= 100;
          if (!hasSourceText) {
            console.log(`[quiz-generate] Skipping chapter "${ch.title}" - no source_text or too short (${ch.source_text?.length || 0} chars)`);
          }
          return hasSourceText;
        });
        const totalChapters = chaptersToProcess.length;

        if (totalChapters === 0) {
          console.error('[quiz-generate] No chapters with sufficient source_text found');
          throw new Error('No chapters with content to generate questions from');
        }
        let totalQuestionsGenerated = 0;

        // Calculate target questions per chapter and total
        const questionsPerChapter = quizConfig.niveau === 'exhaustif'
          ? 50
          : getAdjustedQuestionCount(10, quizConfig.niveau);
        const totalExpectedQuestions = totalChapters * questionsPerChapter;

        // Track monotonic progress - never goes backwards
        // Start at 2% to give more room for slow progression at the beginning
        let currentProgress = 2;

        // Send initial progress
        sendProgress({
          type: 'progress',
          step: 'analyzing_document',
          progress: currentProgress,
          totalChapters,
          questionsGenerated: 0,
          totalQuestions: totalExpectedQuestions
        });

        // Start heartbeat to keep SSE connection alive
        // This prevents proxies/browsers from closing inactive connections
        heartbeatInterval = setInterval(() => {
          if (isClientConnected()) {
            sendProgress({
              type: 'heartbeat',
              progress: currentProgress,
              questionsGenerated: totalQuestionsGenerated,
              totalQuestions: totalExpectedQuestions
            });
          } else {
            clearInterval(heartbeatInterval);
          }
        }, 15000); // Send heartbeat every 15 seconds

        for (let i = 0; i < chaptersToProcess.length; i += MAX_CONCURRENT_CHAPTERS) {
          const batch = chaptersToProcess.slice(i, i + MAX_CONCURRENT_CHAPTERS);

          for (const chapter of batch) {
            const chapterIndex = i + 1;
            // Progress is based on questions generated, not chapters
            // Reserve 5% for init and 5% for finalization, so 90% for question generation
            const progressPerQuestion = 90 / totalExpectedQuestions;

            try {
              // Update progress: starting chapter (don't decrease progress)
              // Use a slower curve at the beginning: start at 5% for first chapter
              // and progress more gradually (use 75% of range, leaving room at start and end)
              const chapterStartProgress = 5 + (chapterIndex - 1) * (70 / totalChapters);
              currentProgress = Math.max(currentProgress, chapterStartProgress);
              sendProgress({
                type: 'progress',
                step: 'extracting_chapter',
                progress: Math.round(currentProgress),
                chapterIndex,
                totalChapters,
                questionsGenerated: totalQuestionsGenerated,
                totalQuestions: totalExpectedQuestions
              });

              await admin
                .from('chapters')
                .update({ status: 'processing' })
                .eq('id', chapter.id);

              const chapterConcepts = conceptsByChapter.get(chapter.id) || [];
              const chapterText = chapter.source_text || '';

              // Note: chapters without sufficient source_text are already filtered out above
              console.log(`[quiz-generate] Processing chapter ${chapterIndex}/${totalChapters}: "${chapter.title}" (${chapterText.length} chars, ${chapterConcepts.length} concepts)`);

              const coverageMap = new Map<string, number>();
              chapterConcepts.forEach(c => coverageMap.set(c.id, 0));

              let pass = 0;
              let finalCoverage = 0;
              let chapterQuestionsInserted = 0;

              // Calculate the maximum questions allowed for this chapter based on niveau
              // For standard: 10, for synthetique: 5, for exhaustif: unlimited (use 50 as cap)
              const maxQuestionsPerChapter = quizConfig.niveau === 'exhaustif'
                ? 50
                : getAdjustedQuestionCount(10, quizConfig.niveau);

              console.log(`[quiz-generate] Chapter "${chapter.title}" quota: ${maxQuestionsPerChapter} questions (niveau: ${quizConfig.niveau})`);

              while (pass < 3) { // 3 passes max to ensure we reach quota
                // Check if we've already reached the quota for this chapter
                if (chapterQuestionsInserted >= maxQuestionsPerChapter) {
                  console.log(`[quiz-generate] Chapter "${chapter.title}" already at quota (${chapterQuestionsInserted}/${maxQuestionsPerChapter}), skipping pass ${pass + 1}`);
                  break;
                }

                // Calculate how many questions we still need
                const questionsNeeded = maxQuestionsPerChapter - chapterQuestionsInserted;
                // Ask for 50% more to compensate for deduplication losses
                const questionsToRequest = Math.ceil(questionsNeeded * 1.5);

                // Update progress: generating questions (increment by small amount)
                // Smaller increments at the beginning for smoother progression
                const progressIncrement = currentProgress < 20 ? 0.5 : 1;
                currentProgress = Math.min(currentProgress + progressIncrement, 95);
                sendProgress({
                  type: 'progress',
                  step: 'generating_content',
                  progress: Math.round(currentProgress),
                  chapterIndex,
                  totalChapters,
                  questionsGenerated: totalQuestionsGenerated,
                  totalQuestions: totalExpectedQuestions
                });

                // Create a modified config that requests extra questions to compensate for deduplication
                const adjustedConfig = {
                  ...quizConfig,
                  // Override the question count to request more
                  _requestedCount: questionsToRequest
                };

                // Start a progress ticker to show activity during LLM generation
                // This prevents the UI from appearing frozen during long API calls
                let tickerCount = 0;
                let tickerProgress = currentProgress;
                // Calculate max progress for this chapter's LLM call (don't go beyond chapter's allocated range)
                const chapterProgressRange = 70 / totalChapters;
                const maxTickerProgress = Math.min(
                  5 + chapterIndex * chapterProgressRange - 3, // Leave room for saving
                  currentProgress + 10 // Don't jump more than 10%
                );
                const thinkingSteps = [
                  'identifying_concepts',
                  'generating_content',
                ];
                // Slower increment at the beginning (first 20%), faster later
                const getTickerIncrement = () => {
                  if (tickerProgress < 15) return 0.2; // Very slow at the start
                  if (tickerProgress < 30) return 0.3; // Slow in early phase
                  return 0.5; // Normal speed later
                };
                const progressTicker = setInterval(() => {
                  // Increment progress with variable speed (slower at start)
                  tickerProgress = Math.min(tickerProgress + getTickerIncrement(), maxTickerProgress, 90);
                  currentProgress = Math.max(currentProgress, tickerProgress);
                  const stepIndex = tickerCount % thinkingSteps.length;
                  sendProgress({
                    type: 'progress',
                    step: thinkingSteps[stepIndex],
                    progress: Math.round(tickerProgress),
                    chapterIndex,
                    totalChapters,
                    questionsGenerated: totalQuestionsGenerated,
                    totalQuestions: totalExpectedQuestions
                  });
                  tickerCount++;
                }, 2000); // Update every 2 seconds

                let generated;
                try {
                  generated = await generateMixedQuiz(
                    {
                      index: chapter.order_index + 1,
                      title: chapter.title,
                      short_summary: chapter.summary || '',
                      difficulty: chapter.difficulty === 'hard' ? 3 : chapter.difficulty === 'medium' ? 2 : 1,
                    },
                    chapterText,
                    modelLanguage,
                    adjustedConfig,
                    { enableSemanticValidation: false } // Disabled to guarantee exact question count
                  );
                } catch (genError: any) {
                  clearInterval(progressTicker);
                  console.error(`[quiz-generate] generateMixedQuiz failed for chapter "${chapter.title}":`, genError.message);
                  // Continue to next pass or chapter instead of failing completely
                  pass += 1;
                  continue;
                }
                clearInterval(progressTicker);

                const rawQuestions: any[] = Array.isArray(generated)
                  ? generated
                  : (generated as any).questions || [];

                console.log(`[quiz-generate] Chapter "${chapter.title}" pass ${pass + 1}: generated ${rawQuestions.length} raw questions`);

                // Update progress: deduplication (small increment)
                const dedupeIncrement = currentProgress < 20 ? 0.3 : 0.8;
                currentProgress = Math.min(currentProgress + dedupeIncrement, 95);
                sendProgress({
                  type: 'progress',
                  step: 'verifying_content',
                  progress: Math.round(currentProgress),
                  chapterIndex,
                  totalChapters,
                  questionsGenerated: totalQuestionsGenerated,
                  totalQuestions: totalExpectedQuestions
                });

                const dedupeResult = deduplicationTracker.filterQuestions(
                  rawQuestions.map(q => ({ prompt: q.prompt || q.question, ...q })),
                  chapter.order_index
                );
                const questions: any[] = dedupeResult.filtered as any[];

                console.log(`[quiz-generate] Chapter "${chapter.title}" after dedupe: ${questions.length}/${rawQuestions.length} questions kept`);

                // Update progress: saving questions (small increment)
                const saveIncrement = currentProgress < 20 ? 0.3 : 0.8;
                currentProgress = Math.min(currentProgress + saveIncrement, 95);
                sendProgress({
                  type: 'progress',
                  step: 'saving_content',
                  progress: Math.round(currentProgress),
                  chapterIndex,
                  totalChapters,
                  questionsGenerated: totalQuestionsGenerated,
                  totalQuestions: totalExpectedQuestions
                });

                // Calculate how many more questions we can insert for this chapter
                const remainingQuota = maxQuestionsPerChapter - chapterQuestionsInserted;
                const questionsToInsert = questions.slice(0, remainingQuota);

                if (questionsToInsert.length < questions.length) {
                  console.log(`[quiz-generate] Limiting insertion from ${questions.length} to ${questionsToInsert.length} to respect quota (${chapterQuestionsInserted}/${maxQuestionsPerChapter})`);
                }

                // Insert questions (limited to remaining quota)
                for (let idx = 0; idx < questionsToInsert.length; idx++) {
                  const q = questionsToInsert[idx];
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
                    chapterQuestionsInserted++;

                    // Update progress based on questions generated (progress grows with each question)
                    // 5% init + 90% for questions + 5% finalize
                    currentProgress = Math.min(5 + (totalQuestionsGenerated / totalExpectedQuestions) * 90, 95);

                    // Send the question via SSE so frontend can display it immediately
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
                      totalQuestions: totalExpectedQuestions,
                      progress: Math.round(currentProgress),
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

                // Stop if we've reached quota or good coverage
                if (chapterQuestionsInserted >= maxQuestionsPerChapter) {
                  console.log(`[quiz-generate] Chapter "${chapter.title}" reached quota (${chapterQuestionsInserted}/${maxQuestionsPerChapter})`);
                  break;
                }
                if (finalCoverage >= 0.80) {
                  console.log(`[quiz-generate] Chapter "${chapter.title}" reached good coverage (${Math.round(finalCoverage * 100)}%)`);
                  break;
                }
                pass += 1;
              }

              // Count questions generated for this chapter
              const { count: chapterQuestionCount } = await admin
                .from('questions')
                .select('*', { count: 'exact', head: true })
                .eq('chapter_id', chapter.id);

              // Mark chapter as ready
              await admin
                .from('chapters')
                .update({ status: 'ready' })
                .eq('id', chapter.id);

              // Update progress: chapter complete
              // Calculate progress based on chapter completion (15-85 range for generation)
              const chapterCompleteProgress = Math.min(85, 15 + (chapterIndex / totalChapters) * 70);
              currentProgress = Math.max(currentProgress, chapterCompleteProgress);
              sendProgress({
                type: 'progress',
                step: 'generating_content',
                progress: currentProgress,
                chapterIndex,
                totalChapters,
                questionsGenerated: totalQuestionsGenerated
              });

              if ((chapterQuestionCount || 0) === 0) {
                console.warn(`[quiz-generate] WARNING: Chapter "${chapter.title}" completed with 0 questions! Text length: ${chapterText.length}, concepts: ${chapterConcepts.length}`);
              } else {
                console.log(`[quiz-generate] Chapter ${chapter.order_index + 1} (${chapter.title}) completed with ${chapterQuestionCount} questions - ${totalQuestionsGenerated} total`);
              }

            } catch (chapterError: any) {
              console.error(`Chapter ${chapter.id} quiz generation failed:`, chapterError);
              await admin
                .from('chapters')
                .update({ status: 'failed' })
                .eq('id', chapter.id);

              // Still advance progress even on error
              const chapterErrorProgress = Math.min(85, 15 + (chapterIndex / totalChapters) * 70);
              currentProgress = Math.max(currentProgress, chapterErrorProgress);
              sendProgress({
                type: 'progress',
                step: 'generating_content',
                progress: currentProgress,
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
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
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
