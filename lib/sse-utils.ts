/**
 * Server-Sent Events (SSE) Utilities
 *
 * Shared utilities for creating SSE streams in API routes.
 * Used by quiz, flashcards, and note generation endpoints.
 */

export interface SSEStreamController {
  /** The readable stream to return in the Response */
  stream: ReadableStream<Uint8Array>;
  /** Send an event to the client */
  send: (data: object) => void;
  /** Close the stream */
  close: () => void;
  /** Check if the stream is closed */
  isClosed: () => boolean;
}

/**
 * Create an SSE stream for streaming events to the client.
 *
 * Usage:
 * ```typescript
 * const { stream, send, close } = createSSEStream();
 *
 * // Send events
 * send({ type: 'progress', progress: 50 });
 * send({ type: 'complete', progress: 100 });
 *
 * // Close when done
 * close();
 *
 * // Return the stream in the response
 * return new Response(stream, {
 *   headers: {
 *     'Content-Type': 'text/event-stream',
 *     'Cache-Control': 'no-cache',
 *     'Connection': 'keep-alive',
 *   },
 * });
 * ```
 */
export function createSSEStream(): SSEStreamController {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
    },
  });

  const send = (data: object) => {
    if (!closed && controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      } catch (error) {
        // Stream may have been closed by client
        closed = true;
      }
    }
  };

  const close = () => {
    if (!closed && controller) {
      try {
        closed = true;
        controller.close();
      } catch {
        // Already closed
      }
    }
  };

  const isClosed = () => closed;

  return { stream, send, close, isClosed };
}

/**
 * Standard SSE response headers
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no', // Disable nginx buffering
} as const;

/**
 * Create an SSE Response with proper headers
 */
export function createSSEResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, { headers: SSE_HEADERS });
}
