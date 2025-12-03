/**
 * LLM Logger
 *
 * Structured logging for LLM API calls to enable monitoring,
 * debugging, and cost tracking.
 */

export interface LLMLogEntry {
  timestamp: Date;
  requestId: string;
  function: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  errorCode?: string | number;
  fallbackUsed: boolean;
  cacheHit: boolean;
  retryCount: number;
  metadata?: Record<string, any>;
}

export interface LLMLoggerOptions {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  includeMetadata: boolean;
  onLog?: (entry: LLMLogEntry) => void;
}

const DEFAULT_OPTIONS: LLMLoggerOptions = {
  enabled: true,
  logLevel: 'info',
  includeMetadata: true,
};

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `llm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * LLM Logger class for structured logging
 */
class LLMLoggerClass {
  private options: LLMLoggerOptions;
  private logs: LLMLogEntry[] = [];
  private maxLogsInMemory: number = 1000;

  constructor(options: Partial<LLMLoggerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Create a new log context for tracking a request
   */
  createContext(functionName: string, model: string): LLMLogContext {
    return new LLMLogContext(this, functionName, model);
  }

  /**
   * Log an entry
   */
  log(entry: LLMLogEntry): void {
    if (!this.options.enabled) return;

    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs.shift();
    }

    // Format and output
    const message = this.formatLogMessage(entry);

    if (entry.success) {
      if (this.options.logLevel === 'debug') {
        console.log(message);
      }
    } else {
      console.error(message);
    }

    // Call custom handler if provided
    this.options.onLog?.(entry);
  }

  /**
   * Format a log entry as a string
   */
  private formatLogMessage(entry: LLMLogEntry): string {
    const status = entry.success ? '✅' : '❌';
    const cache = entry.cacheHit ? '(cached)' : '';
    const fallback = entry.fallbackUsed ? '(fallback)' : '';
    const retry = entry.retryCount > 0 ? `(${entry.retryCount} retries)` : '';

    const tokens = entry.totalTokens
      ? `[${entry.inputTokens || '?'}→${entry.outputTokens || '?'} tokens]`
      : '';

    let message = `[llm] ${status} ${entry.function} ${cache}${fallback}${retry} ${tokens} ${entry.latencyMs}ms`;

    if (!entry.success && entry.error) {
      message += ` - Error: ${entry.error}`;
    }

    return message;
  }

  /**
   * Get aggregated statistics
   */
  getStats(since?: Date): LLMStats {
    const relevantLogs = since
      ? this.logs.filter(l => l.timestamp >= since)
      : this.logs;

    const successful = relevantLogs.filter(l => l.success);
    const failed = relevantLogs.filter(l => !l.success);

    const totalTokens = relevantLogs.reduce((sum, l) => sum + (l.totalTokens || 0), 0);
    const totalLatency = relevantLogs.reduce((sum, l) => sum + l.latencyMs, 0);

    const byFunction = new Map<string, { count: number; tokens: number; errors: number }>();
    for (const log of relevantLogs) {
      const existing = byFunction.get(log.function) || { count: 0, tokens: 0, errors: 0 };
      existing.count++;
      existing.tokens += log.totalTokens || 0;
      if (!log.success) existing.errors++;
      byFunction.set(log.function, existing);
    }

    return {
      totalCalls: relevantLogs.length,
      successfulCalls: successful.length,
      failedCalls: failed.length,
      successRate: relevantLogs.length > 0 ? successful.length / relevantLogs.length : 0,
      totalTokens,
      averageTokensPerCall: relevantLogs.length > 0 ? totalTokens / relevantLogs.length : 0,
      averageLatencyMs: relevantLogs.length > 0 ? totalLatency / relevantLogs.length : 0,
      cacheHitRate: relevantLogs.length > 0
        ? relevantLogs.filter(l => l.cacheHit).length / relevantLogs.length
        : 0,
      fallbackRate: relevantLogs.length > 0
        ? relevantLogs.filter(l => l.fallbackUsed).length / relevantLogs.length
        : 0,
      byFunction: Object.fromEntries(byFunction),
      errorBreakdown: this.getErrorBreakdown(failed),
    };
  }

  /**
   * Get breakdown of error types
   */
  private getErrorBreakdown(failedLogs: LLMLogEntry[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const log of failedLogs) {
      const errorType = log.errorCode?.toString() || log.error?.split(':')[0] || 'unknown';
      breakdown[errorType] = (breakdown[errorType] || 0) + 1;
    }
    return breakdown;
  }

  /**
   * Clear logs from memory
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs
   */
  exportLogs(): LLMLogEntry[] {
    return [...this.logs];
  }
}

/**
 * Log context for tracking a single request
 */
export class LLMLogContext {
  private logger: LLMLoggerClass;
  private entry: Partial<LLMLogEntry>;
  private startTime: number;

  constructor(logger: LLMLoggerClass, functionName: string, model: string) {
    this.logger = logger;
    this.startTime = Date.now();
    this.entry = {
      requestId: generateRequestId(),
      function: functionName,
      model,
      timestamp: new Date(),
      retryCount: 0,
      cacheHit: false,
      fallbackUsed: false,
    };
  }

  /**
   * Set token counts from response
   */
  setTokens(usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }): this {
    this.entry.inputTokens = usage.prompt_tokens;
    this.entry.outputTokens = usage.completion_tokens;
    this.entry.totalTokens = usage.total_tokens;
    return this;
  }

  /**
   * Mark as cache hit
   */
  setCacheHit(hit: boolean = true): this {
    this.entry.cacheHit = hit;
    return this;
  }

  /**
   * Mark as using fallback
   */
  setFallbackUsed(used: boolean = true): this {
    this.entry.fallbackUsed = used;
    return this;
  }

  /**
   * Increment retry count
   */
  incrementRetry(): this {
    this.entry.retryCount = (this.entry.retryCount || 0) + 1;
    return this;
  }

  /**
   * Add metadata
   */
  setMetadata(metadata: Record<string, any>): this {
    this.entry.metadata = { ...this.entry.metadata, ...metadata };
    return this;
  }

  /**
   * Complete the log with success
   */
  success(): void {
    this.entry.success = true;
    this.entry.latencyMs = Date.now() - this.startTime;
    this.logger.log(this.entry as LLMLogEntry);
  }

  /**
   * Complete the log with failure
   */
  failure(error: Error | string, errorCode?: string | number): void {
    this.entry.success = false;
    this.entry.error = typeof error === 'string' ? error : error.message;
    this.entry.errorCode = errorCode;
    this.entry.latencyMs = Date.now() - this.startTime;
    this.logger.log(this.entry as LLMLogEntry);
  }
}

export interface LLMStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  totalTokens: number;
  averageTokensPerCall: number;
  averageLatencyMs: number;
  cacheHitRate: number;
  fallbackRate: number;
  byFunction: Record<string, { count: number; tokens: number; errors: number }>;
  errorBreakdown: Record<string, number>;
}

/**
 * Global LLM logger instance
 */
export const llmLogger = new LLMLoggerClass({
  enabled: true,
  logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  includeMetadata: true,
});

/**
 * Convenience function to wrap an LLM call with logging
 */
export async function withLogging<T>(
  functionName: string,
  model: string,
  fn: (context: LLMLogContext) => Promise<T>
): Promise<T> {
  const context = llmLogger.createContext(functionName, model);

  try {
    const result = await fn(context);
    context.success();
    return result;
  } catch (error: any) {
    context.failure(error, error?.status || error?.code);
    throw error;
  }
}
