/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by temporarily disabling calls
 * to a failing service after a threshold of failures.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
  onStateChange?: (from: CircuitState, to: CircuitState, reason: string) => void;
  onFailure?: (error: Error, failureCount: number) => void;
  onSuccess?: () => void;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  halfOpenMaxAttempts: 3,
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount: number = 0;
  private lastFailureTime?: number;
  private halfOpenAttempts: number = 0;
  private options: CircuitBreakerOptions;
  private name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    this.checkStateTransition();
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): {
    name: string;
    state: CircuitState;
    failureCount: number;
    lastFailureTime?: Date;
    timeSinceLastFailure?: number;
  } {
    return {
      name: this.name,
      state: this.getState(),
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime) : undefined,
      timeSinceLastFailure: this.lastFailureTime ? Date.now() - this.lastFailureTime : undefined,
    };
  }

  /**
   * Check if circuit should transition states
   */
  private checkStateTransition(): void {
    if (this.state === 'open' && this.lastFailureTime) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.options.resetTimeoutMs) {
        this.transitionTo('half-open', 'Reset timeout elapsed');
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState, reason: string): void {
    const oldState = this.state;
    if (oldState !== newState) {
      console.log(`[circuit-breaker:${this.name}] ${oldState} -> ${newState}: ${reason}`);
      this.state = newState;

      if (newState === 'half-open') {
        this.halfOpenAttempts = 0;
      }

      this.options.onStateChange?.(oldState, newState, reason);
    }
  }

  /**
   * Record a successful call
   */
  private recordSuccess(): void {
    if (this.state === 'half-open') {
      this.transitionTo('closed', 'Successful call in half-open state');
    }
    this.failureCount = 0;
    this.options.onSuccess?.();
  }

  /**
   * Record a failed call
   */
  private recordFailure(error: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.options.onFailure?.(error, this.failureCount);

    if (this.state === 'half-open') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
        this.transitionTo('open', `${this.halfOpenAttempts} failures in half-open state`);
      }
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.transitionTo('open', `Failure threshold reached (${this.failureCount})`);
    }
  }

  /**
   * Check if circuit allows calls
   */
  isCallAllowed(): boolean {
    this.checkStateTransition();
    return this.state !== 'open';
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async call<T>(fn: () => Promise<T>, fallback?: T | (() => T | Promise<T>)): Promise<T> {
    this.checkStateTransition();

    if (this.state === 'open') {
      console.warn(`[circuit-breaker:${this.name}] Circuit is OPEN, using fallback`);

      if (fallback !== undefined) {
        return typeof fallback === 'function' ? (fallback as () => T | Promise<T>)() : fallback;
      }

      throw new CircuitOpenError(this.name, this.options.resetTimeoutMs);
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error: any) {
      this.recordFailure(error);

      // If we have a fallback and circuit is now open, use it
      if (fallback !== undefined && !this.isCallAllowed()) {
        console.warn(`[circuit-breaker:${this.name}] Call failed, circuit opened, using fallback`);
        return typeof fallback === 'function' ? (fallback as () => T | Promise<T>)() : fallback;
      }

      throw error;
    }
  }

  /**
   * Force the circuit to a specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state, 'Forced by admin');
    if (state === 'closed') {
      this.failureCount = 0;
    }
  }

  /**
   * Reset the circuit to initial state
   */
  reset(): void {
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = undefined;
    this.transitionTo('closed', 'Manual reset');
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(circuitName: string, resetTimeoutMs: number) {
    super(
      `Circuit breaker '${circuitName}' is open. ` +
      `Service unavailable. Will retry after ${resetTimeoutMs / 1000}s.`
    );
    this.name = 'CircuitOpenError';
  }
}

/**
 * Global circuit breakers for different services
 */
export const openaiCircuitBreaker = new CircuitBreaker('openai', {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxAttempts: 2,
  onStateChange: (from, to, reason) => {
    if (to === 'open') {
      console.error(`[ALERT] OpenAI circuit breaker OPENED: ${reason}`);
    }
  },
});

export const openaiVisionCircuitBreaker = new CircuitBreaker('openai-vision', {
  failureThreshold: 3,
  resetTimeoutMs: 120000, // 2 minutes for vision (more expensive)
  halfOpenMaxAttempts: 1,
});

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
  fallback?: T | (() => T | Promise<T>)
): Promise<T> {
  return breaker.call(fn, fallback);
}
