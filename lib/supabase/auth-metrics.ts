/**
 * Auth Metrics & Observability Utility
 *
 * Tracks authentication performance within request lifecycle:
 * - Total API calls made
 * - Cache hits (calls saved by caching)
 * - Rate limit errors caught and retried
 * - Total time spent in auth operations
 *
 * Usage:
 * ```typescript
 * const metrics = authMetrics();
 * // ... perform auth operations ...
 * metrics.summary(); // Logs: "[Auth] 3 calls total (2 cache hits, 1 rate-limited+retried) in 245ms"
 * ```
 */

interface AuthMetricsSnapshot {
  totalApiCalls: number;
  cacheHits: number;
  rateLimitErrors: number;
  retriesAttempted: number;
  startTime: number;
}

let metricsStack: AuthMetricsSnapshot[] = [];

/**
 * Start tracking auth metrics for this request
 * Returns a metrics instance with logging methods
 */
export function authMetrics() {
  const startTime = performance.now();
  const snapshot: AuthMetricsSnapshot = {
    totalApiCalls: 0,
    cacheHits: 0,
    rateLimitErrors: 0,
    retriesAttempted: 0,
    startTime,
  };

  metricsStack.push(snapshot);

  return {
    /**
     * Record an API call to Supabase auth endpoint
     */
    recordApiCall() {
      if (metricsStack.length > 0) {
        metricsStack[metricsStack.length - 1].totalApiCalls++;
      }
    },

    /**
     * Record a cache hit (call prevented by caching)
     */
    recordCacheHit() {
      if (metricsStack.length > 0) {
        metricsStack[metricsStack.length - 1].cacheHits++;
      }
    },

    /**
     * Record a rate limit error
     */
    recordRateLimitError() {
      if (metricsStack.length > 0) {
        metricsStack[metricsStack.length - 1].rateLimitErrors++;
      }
    },

    /**
     * Record a retry attempt
     */
    recordRetryAttempt() {
      if (metricsStack.length > 0) {
        metricsStack[metricsStack.length - 1].retriesAttempted++;
      }
    },

    /**
     * Log a summary of auth metrics for this request
     */
    summary() {
      if (metricsStack.length === 0) return;

      const current = metricsStack[metricsStack.length - 1];
      const elapsed = Math.round(performance.now() - current.startTime);

      const parts = [];

      // Build main message
      if (current.totalApiCalls > 0) {
        parts.push(`${current.totalApiCalls} calls`);
      }

      // Add details if there are any
      const details = [];
      if (current.cacheHits > 0) {
        details.push(`${current.cacheHits} cache hits`);
      }
      if (current.rateLimitErrors > 0) {
        details.push(`${current.rateLimitErrors} rate-limited+retried`);
      }
      if (current.retriesAttempted > 0) {
        details.push(`${current.retriesAttempted} retries`);
      }

      const message = parts.length > 0
        ? `[Auth] ${parts[0]}${details.length > 0 ? ` (${details.join(", ")})` : ""} in ${elapsed}ms`
        : `[Auth] completed in ${elapsed}ms`;

      // Log only if DEBUG_AUTH enabled
      if (typeof process !== "undefined" && process.env.DEBUG_AUTH === "true") {
        console.log(message);
      }

      // Also return for programmatic use
      return { message, elapsed, ...current };
    },

    /**
     * End tracking (cleanup)
     */
    end() {
      metricsStack.pop();
      return this.summary();
    },
  };
}

/**
 * Get current metrics instance (if in request)
 */
export function getCurrentMetrics() {
  if (metricsStack.length === 0) return null;
  return metricsStack[metricsStack.length - 1];
}

/**
 * Browser console debug output when DEBUG_AUTH enabled
 */
export function debugAuthMetrics(label: string, data: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof process !== "undefined") {
    // Client-side
    if (localStorage?.getItem("DEBUG_AUTH") === "true") {
      console.debug(`[Auth Debug] ${label}`, data);
    }
  } else if (typeof process !== "undefined" && process.env.DEBUG_AUTH === "true") {
    // Server-side
    console.debug(`[Auth Debug] ${label}`, data);
  }
}
