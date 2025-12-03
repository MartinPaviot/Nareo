/**
 * LLM Retry Utilities
 *
 * Provides robust retry mechanisms with exponential backoff
 * for OpenAI API calls to handle transient failures.
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  onRetry: (attempt, error, delayMs) => {
    console.warn(`[llm-retry] Attempt ${attempt} failed, retrying in ${delayMs}ms:`, error.message);
  },
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff: base * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);

  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Check if an error is retryable based on status code
 */
function isRetryableError(error: any, retryableStatusCodes: number[]): boolean {
  // OpenAI SDK errors typically have a status property
  const status = error?.status || error?.response?.status || error?.code;

  if (typeof status === 'number') {
    return retryableStatusCodes.includes(status);
  }

  // Retry on network errors
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
    return true;
  }

  // Retry on rate limit messages
  if (error?.message?.toLowerCase().includes('rate limit')) {
    return true;
  }

  // Retry on timeout errors
  if (error?.message?.toLowerCase().includes('timeout')) {
    return true;
  }

  return false;
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryableError(error, opts.retryableStatusCodes)) {
        throw error;
      }

      // Calculate delay with backoff
      const delayMs = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);

      // Call retry callback
      opts.onRetry?.(attempt + 1, error, delayMs);

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Create a retryable wrapper for a function
 *
 * @param fn - The async function to wrap
 * @param options - Retry configuration options
 * @returns A new function that will retry on failure
 */
export function makeRetryable<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: Partial<RetryOptions> = {}
): (...args: TArgs) => Promise<TReturn> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Retry options preset for critical operations (more retries, longer waits)
 */
export const CRITICAL_RETRY_OPTIONS: Partial<RetryOptions> = {
  maxRetries: 5,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
};

/**
 * Retry options preset for fast operations (fewer retries, shorter waits)
 */
export const FAST_RETRY_OPTIONS: Partial<RetryOptions> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};
