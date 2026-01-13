import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';
import { generateMixedQuizParallel } from '@/lib/openai-vision';
import { CourseDeduplicationTracker } from '@/lib/llm';
import { QuizConfig, DEFAULT_QUIZ_CONFIG, getAdjustedQuestionCount } from '@/types/quiz-personnalisation';

// Max duration for quiz generation
// Vercel Hobby plan limit is 60 seconds, Pro plan allows 300 seconds
// With chunked approach, each request handles 1-2 chapters max
export const maxDuration = 300;

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

// Hybrid processing strategy:
// 1. First chapter processed alone (so user can start practicing quickly)
// 2. Remaining chapters processed in parallel batches of 5
// Batch of 5 = 15 API calls max (5 chapters × 3 question types)
// Vercel Pro allows 300s timeout, retry mechanism handles rate limits
const PARALLEL_CHAPTER_BATCH_SIZE = 5;

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

/**
 * FALLBACK: Generate basic True/False questions from chapter text
 * Used when all LLM-based generation methods fail
 * Guarantees every chapter has at least some questions
 */
async function generateFallbackQuestions(
  admin: ReturnType<typeof getServiceSupabase>,
  chapter: { id: string; title: string; source_text: string | null },
  language: 'EN' | 'FR' | 'DE'
): Promise<number> {
  console.log(`[quiz-generate] FALLBACK: Generating basic questions for chapter "${chapter.title}"`);

  const text = chapter.source_text || '';
  if (text.length < 50) {
    console.warn(`[quiz-generate] FALLBACK: Chapter "${chapter.title}" has insufficient text (${text.length} chars)`);
    return 0;
  }

  // Extract sentences that are good candidates for True/False questions
  // Looking for declarative sentences with facts
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => {
      const wordCount = s.split(/\s+/).length;
      // Keep sentences with 8-40 words (good length for questions)
      return wordCount >= 8 && wordCount <= 40;
    })
    .slice(0, 10); // Take first 10 suitable sentences

  if (sentences.length === 0) {
    console.warn(`[quiz-generate] FALLBACK: No suitable sentences found in chapter "${chapter.title}"`);
    return 0;
  }

  const [trueLabel, falseLabel] = getTrueFalseLabels(language);

  // Create True/False questions from the sentences
  const questionsToInsert = sentences.slice(0, 5).map((sentence, idx) => {
    // Randomly decide if this will be a TRUE or FALSE question
    const isTrue = Math.random() > 0.3; // 70% true questions (easier to create)

    let statement = sentence;
    if (!isTrue) {
      // Try to negate the statement by adding "ne...pas" or "not"
      if (language === 'FR') {
        statement = `Il est faux que : ${sentence}`;
      } else if (language === 'DE') {
        statement = `Es ist falsch, dass: ${sentence}`;
      } else {
        statement = `It is false that: ${sentence}`;
      }
    }

    const explanation = language === 'FR'
      ? `Cette affirmation est ${isTrue ? 'vraie' : 'fausse'} selon le contenu du chapitre "${chapter.title}".`
      : language === 'DE'
        ? `Diese Aussage ist ${isTrue ? 'wahr' : 'falsch'} laut dem Inhalt des Kapitels "${chapter.title}".`
        : `This statement is ${isTrue ? 'true' : 'false'} according to the content of chapter "${chapter.title}".`;

    return {
      id: randomUUID(),
      chapter_id: chapter.id,
      concept_id: null,
      question_number: idx + 1,
      question_text: statement,
      answer_text: isTrue ? 'true' : 'false',
      options: [trueLabel, falseLabel],
      type: 'mcq',
      difficulty: 1, // Easy difficulty for fallback questions
      phase: 'true_false',
      points: 10,
      correct_option_index: isTrue ? 0 : 1,
      explanation,
      source_excerpt: sentence.substring(0, 200),
      cognitive_level: 'remember',
    };
  });

  if (questionsToInsert.length === 0) {
    return 0;
  }

  // Insert fallback questions
  const { error: insertError } = await admin.from('questions').insert(questionsToInsert);
  if (insertError) {
    console.error(`[quiz-generate] FALLBACK: Failed to insert fallback questions:`, insertError.message);
    return 0;
  }

  console.log(`[quiz-generate] FALLBACK: Successfully inserted ${questionsToInsert.length} fallback questions for chapter "${chapter.title}"`);
  return questionsToInsert.length;
}

/**
 * Progress milestones for quiz generation
 * These are the key stages with their target percentages
 * Frontend will animate smoothly between these values
 */
const PROGRESS_MILESTONES = {
  STARTING: 3,              // Initial state
  ANALYZING: 8,             // Analyzing document structure
  EXTRACTING_FACTS: 15,     // Extracting facts from chapters
  GENERATING_START: 20,     // Starting question generation
  // 20-85: Generating questions (distributed across chapters)
  VALIDATING: 88,           // Validating and deduplicating
  SAVING: 95,               // Final save
  COMPLETE: 100,            // Done
};

// Update progress in database (fire-and-forget, doesn't throw)
async function updateQuizProgress(
  admin: ReturnType<typeof getServiceSupabase>,
  courseId: string,
  data: {
    progress?: number;
    questionsGenerated?: number;
    totalQuestions?: number;
    currentStep?: string;
    status?: 'generating' | 'ready' | 'partial' | 'failed';
    errorMessage?: string | null;
  }
) {
  try {
    const updateData: Record<string, unknown> = {};

    if (data.progress !== undefined) updateData.quiz_progress = data.progress;
    if (data.questionsGenerated !== undefined) updateData.quiz_questions_generated = data.questionsGenerated;
    if (data.totalQuestions !== undefined) updateData.quiz_total_questions = data.totalQuestions;
    if (data.currentStep !== undefined) updateData.quiz_current_step = data.currentStep;
    if (data.status !== undefined) updateData.quiz_status = data.status;
    if (data.errorMessage !== undefined) updateData.quiz_error_message = data.errorMessage;

    if (data.status === 'ready' || data.status === 'partial') {
      updateData.quiz_completed_at = new Date().toISOString();
    }

    await admin.from('courses').update(updateData).eq('id', courseId);
    console.log(`[quiz-progress] Updated: ${data.currentStep || 'unknown'} - ${data.progress ?? '?'}%`);
  } catch (e) {
    console.error('[quiz-generate] Failed to update progress:', e);
  }
}

// Main quiz generation function - runs independently of HTTP connection
async function runQuizGeneration(
  courseId: string,
  quizConfig: QuizConfig,
  modelLanguage: 'EN' | 'FR' | 'DE',
  chapters: Array<{
    id: string;
    title: string;
    summary: string | null;
    order_index: number;
    difficulty: string | null;
    source_text: string | null;
    status: string | null;
  }>,
  concepts: Array<{
    id: string;
    chapter_id: string;
    title: string;
    description: string | null;
    importance: string | null;
  }> | null
) {
  console.log('🚀 [runQuizGeneration] ENTRY - Starting quiz generation function');
  console.log(`🚀 [runQuizGeneration] courseId: ${courseId}`);
  console.log(`🚀 [runQuizGeneration] chapters: ${chapters.length}`);
  console.log(`🚀 [runQuizGeneration] concepts: ${concepts?.length || 0}`);
  console.log(`🚀 [runQuizGeneration] language: ${modelLanguage}`);

  const admin = getServiceSupabase();

  try {
    const conceptsByChapter = new Map<string, typeof concepts>();
    (concepts || []).forEach(concept => {
      const chapterConcepts = conceptsByChapter.get(concept.chapter_id) || [];
      chapterConcepts.push(concept);
      conceptsByChapter.set(concept.chapter_id, chapterConcepts);
    });

    // Seuil de déduplication à 0.92 = rejette seulement les questions quasi-identiques
    const deduplicationTracker = new CourseDeduplicationTracker(0.92);

    // Process ALL chapters that have source_text
    // NOTE: Chapters with insufficient content are now filtered during course extraction (course-pipeline.ts)
    // This check remains as a safety net for older courses created before that filter was added
    const MIN_SOURCE_TEXT_LENGTH = 50;
    const chaptersToProcess = chapters
      .filter(ch => {
        const hasSourceText = ch.source_text && ch.source_text.trim().length >= MIN_SOURCE_TEXT_LENGTH;
        if (!hasSourceText) {
          console.log(`[quiz-generate] LEGACY FALLBACK: Skipping chapter "${ch.title}" - no source_text or too short (${ch.source_text?.length || 0} chars). Note: This should not happen for newly created courses.`);
        }
        return hasSourceText;
      })
      // IMPORTANT: Sort by order_index to ensure chapter 1 is processed first
      // This maintains the expected order even if chapters were filtered
      .sort((a, b) => a.order_index - b.order_index);
    const totalChapters = chaptersToProcess.length;

    // Log the order of chapters to be processed
    console.log(`[quiz-generate] Chapters to process in order: ${chaptersToProcess.map(ch => `${ch.order_index}:"${ch.title}"`).join(', ')}`);

    if (totalChapters === 0) {
      console.error('[quiz-generate] No chapters with sufficient source_text found');
      await updateQuizProgress(admin, courseId, {
        status: 'failed',
        errorMessage: 'No chapters with content to generate questions from',
        progress: 0,
      });
      return;
    }

    let totalQuestionsGenerated = 0;

    // Calculate target questions per chapter and total
    const questionsPerChapter = quizConfig.niveau === 'exhaustif'
      ? 50
      : getAdjustedQuestionCount(10, quizConfig.niveau);
    const totalExpectedQuestions = totalChapters * questionsPerChapter;

    // Track monotonic progress - never goes backwards
    let currentProgress = PROGRESS_MILESTONES.STARTING;

    // Update initial progress - STARTING
    await updateQuizProgress(admin, courseId, {
      progress: currentProgress,
      questionsGenerated: 0,
      totalQuestions: totalExpectedQuestions,
      currentStep: 'starting',
    });

    // Small delay to ensure frontend sees the starting state
    await new Promise(resolve => setTimeout(resolve, 500));

    // ANALYZING phase
    currentProgress = PROGRESS_MILESTONES.ANALYZING;
    await updateQuizProgress(admin, courseId, {
      progress: currentProgress,
      currentStep: 'analyzing_document',
    });

    // Small processing delay
    await new Promise(resolve => setTimeout(resolve, 300));

    // Helper to build question data object (extracted to avoid duplication)
    const buildQuestionData = (q: any, questionId: string, chapterId: string, idx: number) => {
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

      return questionData;
    };

    // Process a single chapter - returns questions generated count
    const processChapter = async (
      chapter: typeof chaptersToProcess[0],
      chapterIndex: number
    ): Promise<{ questionsGenerated: number; chapterId: string }> => {
      const chapterConcepts = conceptsByChapter.get(chapter.id) || [];
      const chapterText = chapter.source_text || '';

      console.log(`[quiz-generate] Processing chapter ${chapterIndex}/${totalChapters}: "${chapter.title}" (${chapterText.length} chars, ${chapterConcepts.length} concepts)`);

      // Mark chapter as processing (fire-and-forget)
      admin.from('chapters').update({ status: 'processing' }).eq('id', chapter.id).then(() => {});

      const coverageMap = new Map<string, number>();
      chapterConcepts.forEach(c => coverageMap.set(c.id, 0));

      let chapterQuestionsInserted = 0;
      const maxQuestionsPerChapter = quizConfig.niveau === 'exhaustif'
        ? 50
        : getAdjustedQuestionCount(10, quizConfig.niveau);

      console.log(`[quiz-generate] Chapter "${chapter.title}" quota: ${maxQuestionsPerChapter} questions (niveau: ${quizConfig.niveau})`);

      for (let pass = 0; pass < 2; pass++) {
        if (chapterQuestionsInserted >= maxQuestionsPerChapter) {
          console.log(`[quiz-generate] Chapter "${chapter.title}" already at quota, skipping pass ${pass + 1}`);
          break;
        }

        const questionsNeeded = maxQuestionsPerChapter - chapterQuestionsInserted;
        const questionsToRequest = Math.ceil(questionsNeeded * 1.5);

        const adjustedConfig = {
          ...quizConfig,
          _requestedCount: questionsToRequest
        };

        let generated;
        const maxRetries = 2;
        let lastError: Error | null = null;

        for (let retry = 0; retry <= maxRetries; retry++) {
          try {
            if (retry > 0) {
              console.log(`[quiz-generate] Retry ${retry}/${maxRetries} for chapter "${chapter.title}"`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retry)); // Reduced delay
            }

            console.log(`[quiz-generate] 🔥 CALLING generateMixedQuizParallel for chapter "${chapter.title}" (attempt ${retry + 1})`);
            generated = await generateMixedQuizParallel(
              {
                index: chapter.order_index + 1,
                title: chapter.title,
                short_summary: chapter.summary || '',
                difficulty: chapter.difficulty === 'hard' ? 3 : chapter.difficulty === 'medium' ? 2 : 1,
              },
              chapterText,
              modelLanguage,
              adjustedConfig,
              { enableSemanticValidation: false }
            );
            lastError = null;
            break;
          } catch (genError: any) {
            lastError = genError;
            console.error(`[quiz-generate] generateMixedQuiz attempt ${retry + 1} failed for chapter "${chapter.title}":`, genError.message);

            if (genError.message?.includes('content_policy') || genError.message?.includes('invalid_api_key')) {
              break;
            }
          }
        }

        if (lastError || !generated) {
          console.error(`[quiz-generate] All retries failed for chapter "${chapter.title}", moving to next pass`);
          continue;
        }

        const rawQuestions: any[] = Array.isArray(generated)
          ? generated
          : (generated as any).questions || [];

        console.log(`[quiz-generate] Chapter "${chapter.title}" pass ${pass + 1}: generated ${rawQuestions.length} raw questions`);

        const dedupeResult = deduplicationTracker.filterQuestions(
          rawQuestions.map(q => ({ prompt: q.prompt || q.question, ...q })),
          chapter.order_index
        );
        const questions: any[] = dedupeResult.filtered as any[];

        console.log(`[quiz-generate] Chapter "${chapter.title}" after dedupe: ${questions.length}/${rawQuestions.length} questions kept`);

        const remainingQuota = maxQuestionsPerChapter - chapterQuestionsInserted;
        const questionsToInsert = questions.slice(0, remainingQuota);

        // Build question data objects for this pass
        const passQuestionsToInsert: any[] = [];
        const passConceptLinks: { question_id: string; concept_id: string }[] = [];

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

          const questionData = buildQuestionData(q, questionId, chapter.id, idx);
          passQuestionsToInsert.push(questionData);
          chapterQuestionsInserted++;

          // Collect concept links for batch insert
          for (const conceptId of targetConceptIds) {
            passConceptLinks.push({ question_id: questionId, concept_id: conceptId });
            coverageMap.set(conceptId, (coverageMap.get(conceptId) ?? 0) + 1);
          }
        }

        // INSERT IMMEDIATELY after each pass so questions appear in real-time
        // This is a compromise: batch per pass (not per question) for performance + real-time visibility
        if (passQuestionsToInsert.length > 0) {
          const { error: batchInsertError } = await admin.from('questions').insert(passQuestionsToInsert);
          if (batchInsertError) {
            console.error(`[quiz-generate] Batch insert failed for chapter "${chapter.title}" pass ${pass + 1}:`, batchInsertError.message);
            // Fallback: try inserting in smaller batches
            const BATCH_SIZE = 25;
            for (let i = 0; i < passQuestionsToInsert.length; i += BATCH_SIZE) {
              const batch = passQuestionsToInsert.slice(i, i + BATCH_SIZE);
              await admin.from('questions').insert(batch);
            }
          }
          console.log(`[quiz-generate] Inserted ${passQuestionsToInsert.length} questions for chapter "${chapter.title}" (pass ${pass + 1})`);

          // Insert concept links for this pass
          if (passConceptLinks.length > 0) {
            await admin.from('question_concepts').insert(passConceptLinks);
          }
        }

        const covered = Array.from(coverageMap.values()).filter(v => v > 0).length;
        const finalCoverage = chapterConcepts.length > 0 ? covered / chapterConcepts.length : 1;

        if (chapterQuestionsInserted >= maxQuestionsPerChapter || finalCoverage >= 0.80) {
          console.log(`[quiz-generate] Chapter "${chapter.title}" stopping: quota=${chapterQuestionsInserted}/${maxQuestionsPerChapter}, coverage=${Math.round(finalCoverage * 100)}%`);
          break;
        }
      }

      // Update chapter status and coverage (fire-and-forget)
      const covered = Array.from(coverageMap.values()).filter(v => v > 0).length;
      admin.from('chapters').update({
        status: 'ready',
        concept_count: chapterConcepts.length,
        covered_concepts: covered,
        coverage_ratio: chapterConcepts.length > 0 ? covered / chapterConcepts.length : 1,
      }).eq('id', chapter.id).then(() => {});

      console.log(`[quiz-generate] Chapter "${chapter.title}" completed with ${chapterQuestionsInserted} questions`);

      return { questionsGenerated: chapterQuestionsInserted, chapterId: chapter.id };
    };

    // EXTRACTING_FACTS phase
    currentProgress = PROGRESS_MILESTONES.EXTRACTING_FACTS;
    await updateQuizProgress(admin, courseId, {
      progress: currentProgress,
      currentStep: 'identifying_concepts',
    });

    // GENERATING_START phase
    currentProgress = PROGRESS_MILESTONES.GENERATING_START;
    await updateQuizProgress(admin, courseId, {
      progress: currentProgress,
      currentStep: 'generating_content',
    });

    // HYBRID PROCESSING: First chapter alone, then parallel batches
    // This allows the first chapter to be ready quickly so users can start practicing
    // while remaining chapters are processed faster in parallel
    // Progress range: GENERATING_START (20) to VALIDATING (88) = 68 points distributed across chapters
    const progressPerChapter = (PROGRESS_MILESTONES.VALIDATING - PROGRESS_MILESTONES.GENERATING_START) / Math.max(1, chaptersToProcess.length);

    // PHASE 1: Process first chapter alone (for fast UX)
    if (chaptersToProcess.length > 0) {
      const firstChapter = chaptersToProcess[0];

      await updateQuizProgress(admin, courseId, {
        progress: PROGRESS_MILESTONES.GENERATING_START,
        currentStep: 'generating_content',
        questionsGenerated: totalQuestionsGenerated,
      });

      try {
        const result = await processChapter(firstChapter, 1);
        totalQuestionsGenerated += result.questionsGenerated;
        console.log(`[quiz-generate] Chapter 1/${chaptersToProcess.length} complete: "${firstChapter.title}" with ${result.questionsGenerated} questions (FIRST - user can start playing!)`);
      } catch (error) {
        console.error(`[quiz-generate] Chapter ${firstChapter.id} failed:`, error);
        admin.from('chapters').update({ status: 'failed' }).eq('id', firstChapter.id).then(() => {});
      }

      currentProgress = Math.round(PROGRESS_MILESTONES.GENERATING_START + progressPerChapter);
      await updateQuizProgress(admin, courseId, {
        progress: currentProgress,
        questionsGenerated: totalQuestionsGenerated,
        currentStep: 'generating_content',
      });
    }

    // PHASE 2: Process remaining chapters in parallel batches
    const remainingChapters = chaptersToProcess.slice(1);

    for (let i = 0; i < remainingChapters.length; i += PARALLEL_CHAPTER_BATCH_SIZE) {
      const batch = remainingChapters.slice(i, i + PARALLEL_CHAPTER_BATCH_SIZE);
      const globalStartIndex = i + 1; // +1 because first chapter already done

      // Calculate progress
      const batchProgress = Math.round(PROGRESS_MILESTONES.GENERATING_START + ((globalStartIndex + 1) * progressPerChapter));
      currentProgress = Math.max(currentProgress, batchProgress);

      await updateQuizProgress(admin, courseId, {
        progress: currentProgress,
        currentStep: 'generating_content',
        questionsGenerated: totalQuestionsGenerated,
      });

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map((chapter, idx) =>
          processChapter(chapter, globalStartIndex + idx + 1).catch(error => {
            console.error(`[quiz-generate] Chapter ${chapter.id} failed:`, error);
            admin.from('chapters').update({ status: 'failed' }).eq('id', chapter.id).then(() => {});
            return { questionsGenerated: 0, chapterId: chapter.id };
          })
        )
      );

      // Aggregate results
      for (const result of batchResults) {
        totalQuestionsGenerated += result.questionsGenerated;
      }

      // Update progress after batch
      const completedChapters = globalStartIndex + batch.length + 1; // +1 for first chapter
      currentProgress = Math.round(PROGRESS_MILESTONES.GENERATING_START + (completedChapters * progressPerChapter));
      currentProgress = Math.min(currentProgress, PROGRESS_MILESTONES.VALIDATING - 1);

      await updateQuizProgress(admin, courseId, {
        progress: currentProgress,
        questionsGenerated: totalQuestionsGenerated,
        currentStep: 'generating_content',
      });

      console.log(`[quiz-generate] Batch complete: ${batch.length} chapters in parallel, ${totalQuestionsGenerated} total questions`);
    }

    // RETRY LOOP: Keep retrying chapters with 0 questions until all succeed
    const MAX_RETRY_PASSES = 3;
    const RETRY_DELAYS = [3000, 5000, 8000]; // Increasing delays between passes

    for (let retryPass = 0; retryPass < MAX_RETRY_PASSES; retryPass++) {
      const { data: chaptersWithQuestions } = await admin
        .from('questions')
        .select('chapter_id')
        .in('chapter_id', chaptersToProcess.map(ch => ch.id));

      const chapterIdsWithQuestions = new Set((chaptersWithQuestions || []).map(q => q.chapter_id));
      const failedChapters = chaptersToProcess.filter(ch => !chapterIdsWithQuestions.has(ch.id));

      if (failedChapters.length === 0) {
        console.log(`[quiz-generate] All chapters have questions, no retry needed`);
        break;
      }

      console.log(`[quiz-generate] RETRY PASS ${retryPass + 1}/${MAX_RETRY_PASSES}: ${failedChapters.length} chapters have 0 questions`);

      // Wait before retry with increasing delay
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryPass]));

      // During retry, progress should stay high (we're past the main generation)
      // Use at least 85% to show we're in the final phase
      const retryProgress = Math.max(currentProgress, 85);
      await updateQuizProgress(admin, courseId, {
        progress: retryProgress,
        currentStep: 'retrying_failed',
        questionsGenerated: totalQuestionsGenerated,
      });

      // Retry failed chapters sequentially to avoid rate limits
      for (const chapter of failedChapters) {
        console.log(`[quiz-generate] RETRY ${retryPass + 1}: Processing chapter "${chapter.title}"...`);

        try {
          const result = await processChapter(chapter, chaptersToProcess.indexOf(chapter) + 1);
          totalQuestionsGenerated += result.questionsGenerated;

          if (result.questionsGenerated > 0) {
            console.log(`[quiz-generate] RETRY SUCCESS: Chapter "${chapter.title}" now has ${result.questionsGenerated} questions`);
          }
        } catch (error) {
          console.error(`[quiz-generate] RETRY ERROR for chapter "${chapter.title}":`, error);
        }

        // Delay between chapters within a retry pass
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // VALIDATING phase
    currentProgress = PROGRESS_MILESTONES.VALIDATING;
    await updateQuizProgress(admin, courseId, {
      progress: currentProgress,
      currentStep: 'verifying_content',
      questionsGenerated: totalQuestionsGenerated,
    });

    // SAVING phase
    currentProgress = PROGRESS_MILESTONES.SAVING;
    await updateQuizProgress(admin, courseId, {
      progress: currentProgress,
      currentStep: 'saving_content',
      questionsGenerated: totalQuestionsGenerated,
    });

    // Final check: any chapters still missing questions after all retries?
    const { data: finalQuestionCheck } = await admin
      .from('questions')
      .select('chapter_id')
      .in('chapter_id', chaptersToProcess.map(ch => ch.id));

    const finalChapterIdsWithQuestions = new Set((finalQuestionCheck || []).map(q => q.chapter_id));
    let stillFailedChapters = chaptersToProcess.filter(ch => !finalChapterIdsWithQuestions.has(ch.id));

    // FALLBACK: Generate basic questions for chapters that still have 0 questions
    // This is a last resort to ensure every chapter has at least some questions
    if (stillFailedChapters.length > 0) {
      const failedNames = stillFailedChapters.map(ch => ch.title).join(', ');
      console.warn(`[quiz-generate] FALLBACK TRIGGERED: ${stillFailedChapters.length} chapters still have 0 questions after ${MAX_RETRY_PASSES} retries: ${failedNames}`);

      await updateQuizProgress(admin, courseId, {
        progress: currentProgress,
        currentStep: 'generating_fallback',
      });

      for (const ch of stillFailedChapters) {
        const fallbackCount = await generateFallbackQuestions(admin, ch, modelLanguage);
        if (fallbackCount > 0) {
          totalQuestionsGenerated += fallbackCount;
          // Mark chapter as ready since it now has questions
          await admin.from('chapters').update({ status: 'ready' }).eq('id', ch.id);
          console.log(`[quiz-generate] FALLBACK SUCCESS: Chapter "${ch.title}" now has ${fallbackCount} fallback questions`);
        } else {
          // Only mark as failed if fallback also failed
          await admin.from('chapters').update({ status: 'failed' }).eq('id', ch.id);
          console.error(`[quiz-generate] FALLBACK FAILED: Could not generate any questions for chapter "${ch.title}"`);
        }
      }

      // Re-check which chapters still have no questions
      const { data: postFallbackCheck } = await admin
        .from('questions')
        .select('chapter_id')
        .in('chapter_id', chaptersToProcess.map(ch => ch.id));

      const postFallbackChapterIds = new Set((postFallbackCheck || []).map(q => q.chapter_id));
      stillFailedChapters = chaptersToProcess.filter(ch => !postFallbackChapterIds.has(ch.id));

      if (stillFailedChapters.length > 0) {
        console.error(`[quiz-generate] CRITICAL: ${stillFailedChapters.length} chapters still have 0 questions after fallback: ${stillFailedChapters.map(ch => ch.title).join(', ')}`);
      } else {
        console.log(`[quiz-generate] SUCCESS: All chapters now have questions after fallback`);
      }
    }

    // Update course quiz status
    const { data: readyChapters } = await admin
      .from('chapters')
      .select('id')
      .eq('course_id', courseId)
      .eq('status', 'ready');

    // Determine final status:
    // - 'ready' if all chapters have questions
    // - 'partial' if some chapters have questions (user can still use the quiz)
    // - 'failed' if no questions were generated at all
    const hasAnyQuestions = totalQuestionsGenerated > 0;
    const allReady = readyChapters?.length === chapters.length && stillFailedChapters.length === 0;

    let finalStatus: 'ready' | 'partial' | 'failed';
    if (allReady) {
      finalStatus = 'ready';
    } else if (hasAnyQuestions) {
      finalStatus = 'partial';
    } else {
      finalStatus = 'failed';
    }

    await admin
      .from('courses')
      .update({
        quiz_status: finalStatus,
        chapter_count: readyChapters?.length || 0,
        quiz_progress: 100,
        quiz_questions_generated: totalQuestionsGenerated,
        quiz_current_step: 'complete',
        quiz_completed_at: new Date().toISOString(),
        quiz_error_message: finalStatus === 'failed'
          ? 'Impossible de générer des questions. Veuillez réessayer.'
          : stillFailedChapters.length > 0
            ? `${stillFailedChapters.length} chapitre(s) sans questions`
            : null,
      })
      .eq('id', courseId);

    console.log(`[quiz-generate] Course ${courseId} quiz generation complete. Status: ${finalStatus}, ${totalQuestionsGenerated} questions generated.`);

  } catch (error: any) {
    console.error('[quiz-generate] Generation error:', error);

    await admin
      .from('courses')
      .update({
        quiz_status: 'failed',
        quiz_error_message: error.message || 'Erreur lors de la génération du quiz',
        quiz_current_step: 'error',
      })
      .eq('id', courseId);
  }
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
    let course;
    let courseError;

    if (auth) {
      const result = await supabase
        .from('courses')
        .select('id, title, content_language, quiz_status, user_id')
        .eq('id', courseId)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      course = result.data;
      courseError = result.error;
    } else {
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

    // STRICT CHECK: Block if already generating to prevent duplicate generations
    if (course.quiz_status === 'generating') {
      console.log(`[quiz-generate] Quiz already generating, BLOCKING duplicate request`);
      return NextResponse.json({
        error: 'Quiz generation already in progress',
        status: 'generating',
        courseId,
      }, { status: 409 }); // 409 Conflict
    }

    // ALWAYS delete old questions AND reset quiz attempts before regenerating
    console.log(`[quiz-generate] Resetting quiz data before regeneration (current status: ${course.quiz_status})...`);

    const { data: courseChapters } = await admin
      .from('chapters')
      .select('id')
      .eq('course_id', courseId);

    if (courseChapters && courseChapters.length > 0) {
      const chapterIds = courseChapters.map(ch => ch.id);
      console.log(`[quiz-generate] Found ${chapterIds.length} chapters to clean`);

      // OPTIMIZED: Batch delete all quiz attempts for chapters in parallel
      const deleteAttemptsPromise = Promise.all([
        admin.from('quiz_attempts').delete().in('chapter_id', chapterIds),
        admin.from('quiz_attempts').delete().eq('course_id', courseId),
      ]);

      // OPTIMIZED: Get all question IDs in one query, then batch delete
      const { data: allQuestions } = await admin
        .from('questions')
        .select('id')
        .in('chapter_id', chapterIds);

      if (allQuestions && allQuestions.length > 0) {
        const questionIds = allQuestions.map(q => q.id);
        console.log(`[quiz-generate] Deleting ${questionIds.length} questions and their concept links`);

        // OPTIMIZED: Batch delete concept links and questions in parallel
        await Promise.all([
          admin.from('question_concepts').delete().in('question_id', questionIds),
          deleteAttemptsPromise,
        ]);

        // Now delete questions (after concept links are deleted)
        await admin.from('questions').delete().in('chapter_id', chapterIds);
      } else {
        await deleteAttemptsPromise;
      }

      console.log(`[quiz-generate] Batch cleanup complete`);
    }

    // Mark quiz as generating + save config + reset progress
    const updateData: Record<string, unknown> = {
      quiz_status: 'generating',
      quiz_progress: 0,
      quiz_questions_generated: 0,
      quiz_total_questions: 0,
      quiz_current_step: 'starting',
      quiz_error_message: null,
      quiz_started_at: new Date().toISOString(),
      quiz_completed_at: null,
    };

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
    // IMPORTANT: Use admin client for guests to bypass RLS
    const chaptersClient = auth ? supabase : admin;
    const { data: chapters, error: chaptersError } = await chaptersClient
      .from('chapters')
      .select('id, title, summary, order_index, difficulty, source_text, status')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true });

    if (chaptersError || !chapters || chapters.length === 0) {
      console.error('[quiz-generate] No chapters found:', chaptersError?.message);
      await admin.from('courses').update({ quiz_status: 'failed' }).eq('id', courseId);
      return NextResponse.json({ error: 'No chapters found' }, { status: 400 });
    }

    console.log(`[quiz-generate] Found ${chapters.length} chapters for course`);

    // Get concepts for each chapter
    // IMPORTANT: Use admin client for guests to bypass RLS
    const { data: concepts } = await chaptersClient
      .from('concepts')
      .select('id, chapter_id, title, description, importance')
      .eq('course_id', courseId);

    const modelLanguage = toModelLanguageCode(course.content_language || 'en');

    // SYNCHRONOUS GENERATION - no setTimeout because Vercel kills the function after response
    // This runs within the same request, respecting the 300s timeout
    console.log('[quiz-generate] Starting SYNCHRONOUS quiz generation...');
    console.log(`[quiz-generate] MISTRAL env var present: ${!!process.env.MISTRAL}`);
    console.log(`[quiz-generate] MISTRAL env var length: ${process.env.MISTRAL?.length || 0}`);
    console.log(`[quiz-generate] Chapters count: ${chapters.length}`);
    console.log(`[quiz-generate] Quiz config:`, JSON.stringify(quizConfig));

    try {
      await runQuizGeneration(courseId, quizConfig, modelLanguage, chapters, concepts);

      // Get final stats
      const { data: finalCourse } = await admin
        .from('courses')
        .select('quiz_status, quiz_questions_generated')
        .eq('id', courseId)
        .single();

      console.log('[quiz-generate] Generation completed successfully');

      return NextResponse.json({
        success: true,
        message: 'Quiz generation completed',
        courseId,
        status: finalCourse?.quiz_status || 'ready',
        questionsGenerated: finalCourse?.quiz_questions_generated || 0,
      });
    } catch (genError: any) {
      console.error('[quiz-generate] Generation failed:', genError);

      // Mark as failed in DB
      await admin.from('courses').update({
        quiz_status: 'failed',
        quiz_error_message: genError.message || 'Quiz generation failed',
      }).eq('id', courseId);

      return NextResponse.json({
        success: false,
        error: genError.message || 'Quiz generation failed',
        courseId,
        status: 'failed',
      }, { status: 500 });
    }

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
