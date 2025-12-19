import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { authenticateRequest } from '@/lib/api-auth';
import { generateConceptChapterQuestions } from '@/lib/openai-vision';
import { CourseDeduplicationTracker } from '@/lib/llm';

// Parallel processing configuration
const MAX_CONCURRENT_CHAPTERS = 3;

function toModelLanguageCode(language: string): 'EN' | 'FR' | 'DE' {
  const lower = (language || '').toLowerCase();
  return lower === 'fr' ? 'FR' : lower === 'de' ? 'DE' : 'EN';
}

/**
 * Background quiz generation function
 * This runs independently of the HTTP connection, so navigation won't cancel it
 */
async function generateQuizInBackground(
  courseId: string,
  userId: string,
  chapters: any[],
  concepts: any[],
  modelLanguage: 'EN' | 'FR' | 'DE'
) {
  const admin = getServiceSupabase();

  try {
    const conceptsByChapter = new Map<string, typeof concepts>();
    (concepts || []).forEach(concept => {
      const chapterConcepts = conceptsByChapter.get(concept.chapter_id) || [];
      chapterConcepts.push(concept);
      conceptsByChapter.set(concept.chapter_id, chapterConcepts);
    });

    // Initialize course-level deduplication tracker
    const deduplicationTracker = new CourseDeduplicationTracker(0.65);

    // Process chapters that are ready but don't have questions yet
    const chaptersToProcess = chapters.filter(ch => ch.status === 'ready');

    for (let i = 0; i < chaptersToProcess.length; i += MAX_CONCURRENT_CHAPTERS) {
      const batch = chaptersToProcess.slice(i, i + MAX_CONCURRENT_CHAPTERS);

      await Promise.all(
        batch.map(async (chapter) => {
          try {
            // Mark chapter as processing
            await admin
              .from('chapters')
              .update({ status: 'processing' })
              .eq('id', chapter.id);

            const chapterConcepts = conceptsByChapter.get(chapter.id) || [];
            const chapterText = chapter.source_text || '';

            if (!chapterText) {
              console.warn(`Chapter ${chapter.id} has no source text, skipping`);
              await admin.from('chapters').update({ status: 'ready' }).eq('id', chapter.id);
              return;
            }

            const coverageMap = new Map<string, number>();
            chapterConcepts.forEach(c => coverageMap.set(c.id, 0));

            // Up to two passes to reach 95% coverage
            let pass = 0;
            let finalCoverage = 0;
            let finalImportantCovered = false;

            while (pass < 2) {
              console.log(`[quiz-generate] Chapter ${chapter.order_index + 1} pass ${pass + 1}`);

              const generated = await generateConceptChapterQuestions(
                {
                  index: chapter.order_index + 1,
                  title: chapter.title,
                  short_summary: chapter.summary || '',
                  difficulty: chapter.difficulty === 'hard' ? 3 : chapter.difficulty === 'medium' ? 2 : 1,
                },
                chapterText,
                modelLanguage,
                { enableSemanticValidation: true }
              );

              const rawQuestions: any[] = Array.isArray(generated)
                ? generated
                : (generated as any).questions || [];

              // Apply cross-chapter deduplication
              const dedupeResult = deduplicationTracker.filterQuestions(
                rawQuestions.map(q => ({ prompt: q.prompt || q.question, ...q })),
                chapter.order_index
              );
              const questions: any[] = dedupeResult.filtered as any[];

              if (dedupeResult.duplicatesRemoved > 0) {
                console.log(`[quiz-generate] Removed ${dedupeResult.duplicatesRemoved} duplicate questions from chapter ${chapter.order_index + 1}`);
              }

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

                const { error: questionInsertError } = await admin.from('questions').insert({
                  id: questionId,
                  chapter_id: chapter.id,
                  concept_id: null,
                  question_number: q.questionNumber ?? q.order ?? idx + 1,
                  question_text: q.prompt || q.question,
                  answer_text: q.expected_answer || correctOption || q.correctAnswer || q.answer || null,
                  options: fixedOptions,
                  type: 'mcq',
                  difficulty: q.phase === 'mcq' ? 2 : 3,
                  phase: q.phase || 'mcq',
                  points: q.points ?? (q.type === 'mcq' ? 10 : 35),
                  correct_option_index: correctIndex,
                  explanation: q.explanation || null,
                  source_excerpt: q.source_reference || null,
                  cognitive_level: q.cognitive_level || null,
                });

                if (questionInsertError) {
                  console.error('Question insert failed', questionInsertError);
                  continue;
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
              finalImportantCovered = chapterConcepts
                .filter(c => c.importance >= 3)
                .every(c => (coverageMap.get(c.id) ?? 0) >= 2);

              await admin
                .from('chapters')
                .update({
                  concept_count: chapterConcepts.length,
                  covered_concepts: covered,
                  coverage_ratio: finalCoverage,
                })
                .eq('id', chapter.id);

              if (finalCoverage >= 0.95 && finalImportantCovered) {
                break;
              }
              pass += 1;
            }

            // Mark chapter as ready
            await admin
              .from('chapters')
              .update({ status: 'ready' })
              .eq('id', chapter.id);

            console.log(`[quiz-generate] Chapter ${chapter.order_index + 1} (${chapter.title}) quiz generated`);

          } catch (chapterError: any) {
            console.error(`Chapter ${chapter.id} quiz generation failed:`, chapterError);
            await admin
              .from('chapters')
              .update({ status: 'failed' })
              .eq('id', chapter.id);
          }
        })
      );
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

    console.log(`[quiz-generate] Course ${courseId} quiz generation complete. Status: ${allReady ? 'ready' : 'partial'}`);

  } catch (error: any) {
    console.error('[quiz-generate] Background generation error:', error);

    await admin
      .from('courses')
      .update({ quiz_status: 'failed' })
      .eq('id', courseId);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  // Authenticate user
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const admin = getServiceSupabase();

  try {
    // Get course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, title, content_language, quiz_status, user_id')
      .eq('id', courseId)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Check if quiz already generated or generating
    if (course.quiz_status === 'ready') {
      return NextResponse.json({
        message: 'Quiz already generated',
        status: 'ready'
      });
    }

    if (course.quiz_status === 'generating') {
      return NextResponse.json({
        message: 'Quiz generation already in progress',
        status: 'generating'
      });
    }

    // Mark quiz as generating BEFORE returning response
    await admin
      .from('courses')
      .update({ quiz_status: 'generating' })
      .eq('id', courseId);

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
    const { data: concepts, error: conceptsError } = await supabase
      .from('concepts')
      .select('id, chapter_id, title, description, importance')
      .eq('course_id', courseId);

    if (conceptsError) {
      console.error('Error fetching concepts:', conceptsError);
    }

    const modelLanguage = toModelLanguageCode(course.content_language || 'en');

    // FIRE AND FORGET: Start background generation without awaiting
    // This ensures the generation continues even if the client navigates away
    generateQuizInBackground(
      courseId,
      auth.user.id,
      chapters,
      concepts || [],
      modelLanguage
    ).catch(err => {
      console.error('[quiz-generate] Unhandled background error:', err);
    });

    // Return immediately - client can poll for status
    return NextResponse.json({
      success: true,
      message: 'Quiz generation started',
      status: 'generating',
      chaptersToProcess: chapters.filter(ch => ch.status === 'ready').length,
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
