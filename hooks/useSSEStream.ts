'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { SSEEvent, parseSSEEvent } from '@/lib/generation-steps';

export interface SSEStreamState<T = SSEEvent> {
  /** Whether the stream is currently active */
  isStreaming: boolean;
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current step/status message */
  message: string;
  /** All events received so far */
  events: T[];
  /** Any error that occurred */
  error: string | null;
  /** Whether the stream completed successfully */
  isComplete: boolean;
  /** Accumulated content for text streaming */
  streamedContent: string;
}

export interface UseSSEStreamOptions {
  /** Called for each event received */
  onEvent?: (event: SSEEvent) => void;
  /** Called when stream completes */
  onComplete?: (events: SSEEvent[]) => void;
  /** Called when an error occurs */
  onError?: (error: string) => void;
  /** Called for each text chunk (for streaming content) */
  onChunk?: (content: string, accumulated: string) => void;
  /** Called for each question received */
  onQuestion?: (question: SSEEvent) => void;
  /** Called for each flashcard received */
  onFlashcard?: (flashcard: SSEEvent) => void;
}

export function useSSEStream(options: UseSSEStreamOptions = {}) {
  const [state, setState] = useState<SSEStreamState>({
    isStreaming: false,
    progress: 0,
    message: '',
    events: [],
    error: null,
    isComplete: false,
    streamedContent: '',
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const eventsRef = useRef<SSEEvent[]>([]);
  const streamedContentRef = useRef<string>('');

  /**
   * Start streaming from a URL
   */
  const startStream = useCallback(async (
    url: string,
    fetchOptions: RequestInit = {}
  ) => {
    // Cancel any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    eventsRef.current = [];
    streamedContentRef.current = '';

    // Reset state
    setState({
      isStreaming: true,
      progress: 0,
      message: '',
      events: [],
      error: null,
      isComplete: false,
      streamedContent: '',
    });

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to start generation';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          // Use default error message
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          const event = parseSSEEvent(line.trim());
          if (!event) continue;

          eventsRef.current.push(event);

          // Handle different event types
          switch (event.type) {
            case 'progress':
              setState(prev => ({
                ...prev,
                progress: event.progress ?? prev.progress,
                message: event.message ?? prev.message,
                events: [...eventsRef.current],
              }));
              break;

            case 'chunk':
              streamedContentRef.current += event.content;
              setState(prev => ({
                ...prev,
                streamedContent: streamedContentRef.current,
                events: [...eventsRef.current],
              }));
              options.onChunk?.(event.content, streamedContentRef.current);
              break;

            case 'question':
              setState(prev => ({
                ...prev,
                progress: event.progress ?? prev.progress,
                events: [...eventsRef.current],
              }));
              options.onQuestion?.(event);
              break;

            case 'flashcard':
              setState(prev => ({
                ...prev,
                progress: event.progress ?? prev.progress,
                events: [...eventsRef.current],
              }));
              options.onFlashcard?.(event);
              break;

            case 'complete':
              setState(prev => ({
                ...prev,
                isStreaming: false,
                isComplete: true,
                progress: 100,
                message: event.message ?? 'Complete',
                events: [...eventsRef.current],
                streamedContent: event.content ?? prev.streamedContent,
              }));
              options.onComplete?.(eventsRef.current);
              break;

            case 'error':
              setState(prev => ({
                ...prev,
                isStreaming: false,
                error: event.message,
                events: [...eventsRef.current],
              }));
              options.onError?.(event.message);
              break;
          }

          options.onEvent?.(event);
        }
      }

      // Handle case where stream ends without explicit complete event
      setState(prev => {
        if (prev.isStreaming && !prev.isComplete && !prev.error) {
          return {
            ...prev,
            isStreaming: false,
            isComplete: true,
            progress: 100,
          };
        }
        return prev;
      });

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was cancelled
        setState(prev => ({
          ...prev,
          isStreaming: false,
        }));
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Stream failed';
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: errorMessage,
      }));
      options.onError?.(errorMessage);
    }
  }, [options]);

  /**
   * Stop the current stream
   */
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  /**
   * Reset the stream state
   */
  const reset = useCallback(() => {
    stopStream();
    eventsRef.current = [];
    streamedContentRef.current = '';
    setState({
      isStreaming: false,
      progress: 0,
      message: '',
      events: [],
      error: null,
      isComplete: false,
      streamedContent: '',
    });
  }, [stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    startStream,
    stopStream,
    reset,
  };
}

/**
 * Helper hook for consuming streaming quiz generation
 */
export function useQuizStream(courseId: string, options: UseSSEStreamOptions = {}) {
  const stream = useSSEStream(options);

  const startGeneration = useCallback(async (config?: object) => {
    await stream.startStream(`/api/courses/${courseId}/quiz/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
  }, [courseId, stream]);

  return {
    ...stream,
    startGeneration,
  };
}

/**
 * Helper hook for consuming streaming flashcard generation
 */
export function useFlashcardStream(courseId: string, options: UseSSEStreamOptions = {}) {
  const stream = useSSEStream(options);

  const startGeneration = useCallback(async (niveau?: string) => {
    await stream.startStream(`/api/courses/${courseId}/flashcards/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niveau }),
    });
  }, [courseId, stream]);

  return {
    ...stream,
    startGeneration,
  };
}

/**
 * Helper hook for consuming streaming note generation
 */
export function useNoteStream(courseId: string, options: UseSSEStreamOptions = {}) {
  const stream = useSSEStream(options);

  const startGeneration = useCallback(async (config?: object) => {
    await stream.startStream(`/api/courses/${courseId}/note/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
  }, [courseId, stream]);

  return {
    ...stream,
    startGeneration,
  };
}
