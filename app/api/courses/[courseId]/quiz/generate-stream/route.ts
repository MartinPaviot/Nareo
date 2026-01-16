/**
 * Quiz Generation with SSE Streaming
 *
 * This endpoint streams quiz questions as they are generated,
 * allowing users to start answering questions immediately.
 *
 * Similar to flashcard streaming, but for quiz questions.
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { createSSEStream, createSSEResponse } from '@/lib/sse-utils';
import { generateMixedQuizStreaming } from '@/lib/openai-vision';
import { QuizConfig, DEFAULT_QUIZ_CONFIG } from '@/types/quiz-personnalisation';
import { CourseDeduplicationTracker, isAdministrativeQuestion } from '@/lib/llm/question-validator';

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

export async function POST(
  request: NextRequest,
  context: { params: { courseId: string } } | { params: Promise<{ courseId: string }> }
) {
  const auth = await authenticateRequest(request);
  const supabase = await createSupabaseServerClient();
  const admin = getServiceSupabase();
  const userId = auth?.user.id || null;
  const guestSessionId = getGuestSessionIdFromRequest(request);
  const resolvedParams = "then" in context.params ? await context.params : context.params;
  const courseId = resolvedParams.courseId;

  // Parse request body
  let quizConfig: QuizConfig = DEFAULT_QUIZ_CONFIG;
  let chapterId: string | null = null;

  try {
    const body = await request.json();
    if (body.config) {
      quizConfig = { ...DEFAULT_QUIZ_CONFIG, ...body.config };
    }
    chapterId = body.chapterId || null;
  } catch {
    // Use defaults
  }

  // Create SSE stream
  const { stream, send, close, isClosed } = createSSEStream();

  // Start async generation
  (async () => {
    try {
      // Initial progress
      send({
        type: 'progress',
        progress: 5,
        step: 'starting',
        message: 'Démarrage de la génération...',
        questionsGenerated: 0,
      });

      // Get course info
      const { data: course, error: courseError } = await admin
        .from('courses')
        .select('id, title, content_language, user_id')
        .eq('id', courseId)
        .single();

      if (courseError || !course) {
        send({ type: 'error', message: 'Course not found' });
        close();
        return;
      }

      // Check access
      const isOwner = !!userId && course.user_id === userId;
      const isGuestCourse = !course.user_id;
      if (!isOwner && !isGuestCourse) {
        send({ type: 'error', message: 'Unauthorized' });
        close();
        return;
      }

      // Get chapters
      let chaptersQuery = admin
        .from('chapters')
        .select('id, title, order_index, source_text, summary, difficulty')
        .eq('course_id', courseId)
        .order('order_index');

      if (chapterId) {
        chaptersQuery = chaptersQuery.eq('id', chapterId);
      }

      const { data: chapters, error: chaptersError } = await chaptersQuery;

      if (chaptersError) {
        console.error(`[quiz-stream] Error fetching chapters for course ${courseId}:`, chaptersError);
        send({ type: 'error', message: `Erreur lors de la récupération des chapitres: ${chaptersError.message}` });
        close();
        return;
      }

      if (!chapters || chapters.length === 0) {
        console.error(`[quiz-stream] No chapters found for course ${courseId}. Course status may be incorrect or extraction failed.`);
        send({
          type: 'error',
          message: 'Aucun chapitre trouvé pour ce cours. L\'extraction du document a peut-être échoué. Veuillez réessayer ou télécharger un autre document.'
        });
        close();
        return;
      }

      console.log(`[quiz-stream] Found ${chapters.length} chapters for course ${courseId}`);

      // Filter chapters with sufficient content for question generation
      const chaptersWithContent = chapters.filter(
        ch => ch.source_text && ch.source_text.length >= 50
      );

      if (chaptersWithContent.length === 0) {
        send({
          type: 'error',
          message: 'Aucun chapitre ne contient suffisamment de contenu pour générer des questions.',
        });
        close();
        return;
      }

      console.log(`[quiz-stream] Found ${chaptersWithContent.length}/${chapters.length} chapters with sufficient content`);

      send({
        type: 'progress',
        progress: 10,
        step: 'analyzing',
        message: `Analyse de ${chaptersWithContent.length} chapitre(s)...`,
        questionsGenerated: 0,
        totalChapters: chaptersWithContent.length,
      });

      const language = (course.content_language?.toUpperCase() as 'EN' | 'FR' | 'DE') || 'FR';
      const deduplicationTracker = new CourseDeduplicationTracker(0.70);

      let totalQuestionsGenerated = 0;
      let questionNumber = 1;
      const totalChapters = chaptersWithContent.length;

      // Process chapters with content one by one
      for (let chapterIndex = 0; chapterIndex < chaptersWithContent.length; chapterIndex++) {
        if (isClosed()) break;

        const chapter = chaptersWithContent[chapterIndex];
        const chapterProgress = 10 + Math.floor((chapterIndex / totalChapters) * 80);

        send({
          type: 'progress',
          progress: chapterProgress,
          step: 'generating',
          message: `Génération pour "${chapter.title}"...`,
          questionsGenerated: totalQuestionsGenerated,
          currentChapter: chapterIndex + 1,
          totalChapters,
        });

        try {
          // Generate questions for this chapter using STREAMING version
          // Questions are sent to client AS SOON AS each type (QCM, Vrai/Faux, etc.) completes
          console.log(`[quiz-stream] Starting STREAMING generation for chapter "${chapter.title}" (${chapter.source_text?.length || 0} chars)`);

          await generateMixedQuizStreaming(
            {
              title: chapter.title,
              short_summary: chapter.summary,
              difficulty: chapter.difficulty,
              learning_objectives: [],
              key_concepts: [],
            },
            chapter.source_text,
            language,
            quizConfig,
            // This callback is called IMMEDIATELY when each batch of questions is ready
            async (batchQuestions) => {
              console.log(`[quiz-stream] Received batch of ${batchQuestions.length} questions - streaming immediately`);

              // Deduplicate this batch
              const { filtered: questions, duplicatesRemoved } = deduplicationTracker.filterQuestions(
                batchQuestions,
                chapterIndex
              );

              if (duplicatesRemoved > 0) {
                console.log(`[quiz-stream] Removed ${duplicatesRemoved} duplicates from batch`);
              }

              // Insert and stream each question IMMEDIATELY
              for (const question of questions) {
                if (isClosed()) break;

                // FILTER: Skip administrative questions
                const questionText = question.prompt || question.question || '';
                const adminCheck = isAdministrativeQuestion(questionText);
                if (adminCheck.isAdmin) {
                  console.log(`[quiz-stream] FILTERED administrative question: "${questionText.substring(0, 60)}..." (${adminCheck.reason}: ${adminCheck.matchedKeyword})`);
                  continue; // Skip this question
                }

                // Normalize true/false questions - convert statement + correct_answer to options format
                let normalizedOptions = question.options || [];
                let normalizedCorrectIndex = question.correct_option_index;
                let normalizedQuestionText = question.prompt || question.question || question.statement || '';
                let phase = question.phase || 'mcq';

                if (question.type === 'true_false') {
                  // Use language-appropriate True/False labels
                  normalizedOptions = language === 'FR'
                    ? ['Vrai', 'Faux']
                    : language === 'DE'
                      ? ['Wahr', 'Falsch']
                      : ['True', 'False'];
                  // correct_answer is a boolean: true = index 0, false = index 1
                  normalizedCorrectIndex = question.correct_answer === true ? 0 : 1;
                  normalizedQuestionText = question.statement || normalizedQuestionText;
                  phase = 'true_false';
                }

                const questionData = {
                  chapter_id: chapter.id,
                  question_number: questionNumber,
                  question_text: normalizedQuestionText,
                  answer_text: question.correctAnswer || '',
                  options: normalizedOptions,
                  type: question.type === 'true_false' ? 'mcq' : question.type === 'fill_blank' ? 'open' : 'mcq',
                  points: question.points || 10,
                  explanation: question.explanation || '',
                  correct_option_index: normalizedCorrectIndex,
                  source_excerpt: question.source_reference || '',
                  page_number: question.page_number || null,
                  phase: phase,
                };

                const { data: insertedQuestion, error: insertError } = await admin
                  .from('questions')
                  .insert(questionData)
                  .select('id, chapter_id, question_text, options, type, correct_option_index, explanation, points, source_excerpt, page_number')
                  .single();

                if (insertError) {
                  console.error(`[quiz-stream] Error inserting question:`, insertError);
                  continue;
                }

                totalQuestionsGenerated++;
                questionNumber++;

                // Stream the question to client IMMEDIATELY
                send({
                  type: 'question',
                  data: {
                    id: insertedQuestion.id,
                    chapterId: chapter.id,
                    chapterTitle: chapter.title,
                    chapterIndex: chapterIndex + 1,
                    questionNumber: totalQuestionsGenerated,
                    questionText: insertedQuestion.question_text,
                    options: insertedQuestion.options,
                    type: insertedQuestion.type,
                    correctOptionIndex: insertedQuestion.correct_option_index,
                    explanation: insertedQuestion.explanation,
                    points: insertedQuestion.points,
                    phase: question.phase || 'mcq',
                    sourceExcerpt: insertedQuestion.source_excerpt || null,
                    pageNumber: insertedQuestion.page_number || null,
                  },
                  questionsGenerated: totalQuestionsGenerated,
                  progress: chapterProgress + Math.floor((totalQuestionsGenerated % 10) * 2),
                });

                console.log(`[quiz-stream] Streamed question #${totalQuestionsGenerated} to client`);
              }
            }
          );

          console.log(`[quiz-stream] Chapter "${chapter.title}" complete - ${totalQuestionsGenerated} total questions so far`);
        } catch (error) {
          console.error(`[quiz-stream] Error generating for chapter "${chapter.title}":`, error);
          // Continue to next chapter
        }
      }

      // Update course quiz status
      await admin
        .from('courses')
        .update({
          quiz_status: totalQuestionsGenerated > 0 ? 'ready' : 'failed',
          quiz_questions_generated: totalQuestionsGenerated,
        })
        .eq('id', courseId);

      // Send completion
      send({
        type: 'complete',
        progress: 100,
        questionsGenerated: totalQuestionsGenerated,
        message: `${totalQuestionsGenerated} questions générées !`,
      });

      close();
    } catch (error) {
      console.error('[quiz-stream] Fatal error:', error);
      send({
        type: 'error',
        message: 'Une erreur est survenue pendant la génération',
      });
      close();
    }
  })();

  // Return SSE response immediately
  return createSSEResponse(stream);
}
