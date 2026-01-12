import { getServiceSupabase } from '@/lib/supabase';

export type AnalyticsEventName =
  | 'upload_started'
  | 'upload_success'
  | 'upload_failed'
  | 'vision_success'
  | 'vision_failed'
  | 'course_ready'
  | 'course_failed'
  | 'course_viewed'
  | 'chapter_opened'
  | 'quiz_started'
  | 'quiz_completed'
  | 'signup_started'
  | 'signup_completed'
  | 'paywall_viewed'
  | 'payment_success'
  | 'payment_failed'
  | 'content_language_detected'
  | 'guest_courses_linked'
  | 'guest_courses_link_failed'
  | 'flashcards_generated'
  | 'flashcards_generation_failed'
  | 'graphics_extracted'
  | 'graphics_extraction_failed';

interface LogPayload {
  userId?: string;
  sessionId?: string;
  courseId?: string;
  chapterId?: string;
  payload?: Record<string, any>;
}

/**
 * Lightweight logger to persist analytics in Supabase (log_events table).
 * This keeps a single source of truth even if Posthog is not configured.
 */
export async function logEvent(eventName: AnalyticsEventName, data: LogPayload = {}) {
  try {
    const client = getServiceSupabase();
    const { userId, sessionId, courseId, chapterId, payload } = data;

    await client.from('log_events').insert({
      event_name: eventName,
      user_id: userId ?? null,
      session_id: sessionId ?? null,
      course_id: courseId ?? null,
      chapter_id: chapterId ?? null,
      payload: payload ?? {},
    });
  } catch (error) {
    // Non-blocking: analytics failure should never break user flows.
    console.error('logEvent failed', eventName, error);
  }
}
