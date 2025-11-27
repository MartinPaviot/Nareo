import posthog from 'posthog-js';

export const initPosthog = () => {
  if (typeof window !== 'undefined') {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (key && host) {
      posthog.init(key, {
        api_host: host,
        loaded: (posthog) => {
          if (process.env.NODE_ENV === 'development') {
            posthog.opt_out_capturing();
          }
        },
      });
    }
  }
};

export interface TrackEventProps {
  userId?: string;
  courseId?: string;
  chapterId?: string;
  questionId?: string;
  [key: string]: any;
}

export const trackEvent = (eventName: string, properties?: TrackEventProps) => {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
      $set: properties?.userId ? { user_id: properties.userId } : undefined,
    });
  }
};

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.identify(userId, traits);
  }
};

export const resetUser = () => {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.reset();
  }
};

export { posthog };
