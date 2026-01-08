import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { createSSEStream, createSSEResponse } from '@/lib/sse-utils';
import type { SSEProgressEvent, SSEQuestionEvent, SSECompleteEvent, SSEErrorEvent } from '@/lib/generation-steps';

// Polling interval for checking database updates (ms)
const DB_POLL_INTERVAL = 500;

// Maximum time to keep the stream open (5 minutes)
const MAX_STREAM_DURATION = 5 * 60 * 1000;

// Helper to extract guestSessionId from cookies
function getGuestSessionIdFromRequest(request: NextRequest): string | null {
  const cookies = request.cookies;
  return cookies.get('guestSessionId')?.value || null;
}

interface QuizProgressState {
  status: string | null;
  progress: number;
  questionsGenerated: number;
  totalQuestions: number;
  currentStep: string | null;
  errorMessage: string | null;
}

interface QuestionRow {
  id: string;
  chapter_id: string;
  type: string;
  question_text: string;
  options: string[] | null;
  correct_option_index: number | null;
  answer_text: string | null;
  explanation: string | null;
  question_number: number;
  created_at: string;
}

/**
 * GET /api/courses/[courseId]/quiz/stream
 *
 * SSE endpoint that streams quiz generation progress in real-time.
 * Replaces polling from the frontend with server-side polling of the database.
 *
 * Events sent:
 * - progress: { type: 'progress', progress: number, step: string, questionsGenerated: number, totalQuestions: number }
 * - question: { type: 'question', data: { chapterId, question: {...} }, questionsGenerated: number }
 * - complete: { type: 'complete', progress: 100, totalItems: number }
 * - error: { type: 'error', message: string }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  // Auth check (user or guest)
  const auth = await authenticateRequest(request);
  const guestSessionId = getGuestSessionIdFromRequest(request);
  const admin = getServiceSupabase();

  // Verify course access
  const { data: course, error: courseError } = await admin
    .from('courses')
    .select('id, user_id, guest_session_id, is_public')
    .eq('id', courseId)
    .maybeSingle();

  if (courseError || !course) {
    return new Response(JSON.stringify({ error: 'Course not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check access
  const isOwner = auth && course.user_id === auth.user.id;
  const isGuest = !course.user_id && course.guest_session_id === guestSessionId;
  const isPublic = course.is_public;
  const hasAccess = isOwner || isGuest || isPublic;

  if (!hasAccess) {
    return new Response(JSON.stringify({ error: 'Access denied' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create SSE stream
  const { stream, send, close, isClosed } = createSSEStream();
  const startTime = Date.now();

  // Track last sent state to avoid duplicate events
  let lastState: QuizProgressState = {
    status: null,
    progress: -1,
    questionsGenerated: -1,
    totalQuestions: -1,
    currentStep: null,
    errorMessage: null,
  };
  let lastQuestionCount = 0;
  let sentQuestionIds = new Set<string>();

  // Function to fetch current quiz state from database
  async function fetchQuizState(): Promise<QuizProgressState | null> {
    const { data, error } = await admin
      .from('courses')
      .select(`
        quiz_status,
        quiz_progress,
        quiz_questions_generated,
        quiz_total_questions,
        quiz_current_step,
        quiz_error_message
      `)
      .eq('id', courseId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      status: data.quiz_status,
      progress: data.quiz_progress ?? 0,
      questionsGenerated: data.quiz_questions_generated ?? 0,
      totalQuestions: data.quiz_total_questions ?? 0,
      currentStep: data.quiz_current_step,
      errorMessage: data.quiz_error_message,
    };
  }

  // Function to fetch new questions
  async function fetchNewQuestions(): Promise<QuestionRow[]> {
    // Get chapter IDs for this course
    const { data: chapters } = await admin
      .from('chapters')
      .select('id')
      .eq('course_id', courseId);

    if (!chapters || chapters.length === 0) return [];

    const chapterIds = chapters.map(ch => ch.id);

    // Get questions not yet sent
    const { data: questions } = await admin
      .from('questions')
      .select(`
        id,
        chapter_id,
        type,
        question_text,
        options,
        correct_option_index,
        answer_text,
        explanation,
        question_number,
        created_at
      `)
      .in('chapter_id', chapterIds)
      .order('created_at', { ascending: true });

    if (!questions) return [];

    // Filter out already sent questions
    return questions.filter(q => !sentQuestionIds.has(q.id));
  }

  // Polling function
  async function pollAndStream() {
    if (isClosed()) return;

    // Check for timeout
    if (Date.now() - startTime > MAX_STREAM_DURATION) {
      send({ type: 'error', message: 'Stream timeout - please refresh' } as SSEErrorEvent);
      close();
      return;
    }

    try {
      const state = await fetchQuizState();
      if (!state) {
        send({ type: 'error', message: 'Failed to fetch quiz state' } as SSEErrorEvent);
        close();
        return;
      }

      // Check if progress changed - send progress event
      const progressChanged =
        state.progress !== lastState.progress ||
        state.currentStep !== lastState.currentStep ||
        state.questionsGenerated !== lastState.questionsGenerated;

      if (progressChanged && state.status === 'generating') {
        const progressEvent: SSEProgressEvent = {
          type: 'progress',
          progress: state.progress,
          step: state.currentStep as any,
          message: getStepMessage(state.currentStep),
          itemsGenerated: state.questionsGenerated,
          totalItems: state.totalQuestions,
        };
        send(progressEvent);
      }

      // Fetch and send new questions
      if (state.questionsGenerated > lastQuestionCount) {
        const newQuestions = await fetchNewQuestions();

        for (const question of newQuestions) {
          if (sentQuestionIds.has(question.id)) continue;

          sentQuestionIds.add(question.id);

          const questionEvent: SSEQuestionEvent = {
            type: 'question',
            data: {
              chapterId: question.chapter_id,
              chapterTitle: '', // Could fetch if needed
              question: {
                id: question.id,
                type: question.type,
                questionText: question.question_text,
                options: question.options,
                correctOptionIndex: question.correct_option_index,
                answerText: question.answer_text,
                explanation: question.explanation,
                questionNumber: question.question_number,
              },
            },
            questionsGenerated: sentQuestionIds.size,
            progress: state.progress,
          };
          send(questionEvent);
        }

        lastQuestionCount = sentQuestionIds.size;
      }

      // Check for completion
      if (state.status === 'ready' || state.status === 'partial') {
        const completeEvent: SSECompleteEvent = {
          type: 'complete',
          progress: 100,
          message: state.status === 'ready' ? 'Quiz generation complete' : 'Quiz partially generated',
          totalItems: state.questionsGenerated,
        };
        send(completeEvent);
        close();
        return;
      }

      // Check for error
      if (state.status === 'failed') {
        const errorEvent: SSEErrorEvent = {
          type: 'error',
          message: state.errorMessage || 'Quiz generation failed',
        };
        send(errorEvent);
        close();
        return;
      }

      // Check if not generating (pending state)
      if (state.status !== 'generating') {
        // Send current state and keep connection open for a bit
        // in case generation starts soon
        if (lastState.status !== state.status) {
          send({
            type: 'progress',
            progress: 0,
            message: 'Waiting for generation to start...',
          });
        }
      }

      // Update last state
      lastState = state;

      // Schedule next poll
      if (!isClosed()) {
        setTimeout(pollAndStream, DB_POLL_INTERVAL);
      }
    } catch (error) {
      console.error('[quiz-stream] Error polling:', error);
      if (!isClosed()) {
        send({ type: 'error', message: 'Stream error' } as SSEErrorEvent);
        close();
      }
    }
  }

  // Handle client disconnect
  request.signal.addEventListener('abort', () => {
    console.log('[quiz-stream] Client disconnected');
    close();
  });

  // Start polling
  pollAndStream();

  // Return SSE response
  return createSSEResponse(stream);
}

// Helper to convert step key to human-readable message
function getStepMessage(step: string | null): string {
  const messages: Record<string, string> = {
    'analyzing_document': 'Analyzing document...',
    'extracting_chapter': 'Extracting chapter content...',
    'identifying_concepts': 'Identifying key concepts...',
    'generating_content': 'Generating questions...',
    'verifying_content': 'Verifying and deduplicating...',
    'saving_content': 'Saving questions...',
    'finalizing': 'Finalizing...',
  };
  return messages[step || ''] || 'Processing...';
}
