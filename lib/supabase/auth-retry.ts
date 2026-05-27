/**
 * Auth retry utility with exponential backoff.
 *
 * Wraps async operations that may encounter Supabase rate limits (429 errors)
 * and automatically retries with exponential backoff delays.
 *
 * Usage:
 * ```typescript
 * const user = await withAuthRetry(() =>
 *   supabase.auth.getUser()
 * );
 * ```
 *
 * On rate limit (429):
 * - Attempt 1: immediate fail → wait 100ms
 * - Attempt 2: retry → if fails, wait 200ms
 * - Attempt 3: retry → if fails, wait 400ms
 * - Attempt 4: final retry → throw error if all fail
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  onRetry?: (attempt: number, delayMs: number, error: Error) => void;
}

/**
 * Execute an async function with exponential backoff retry on 429 errors.
 *
 * @param fn - The async function to execute
 * @param options - Configuration options
 * @returns The result of the function if successful
 * @throws The original error if all retries fail
 *
 * Example:
 * ```typescript
 * const user = await withAuthRetry(
 *   async () => {
 *     const client = await createClient();
 *     const { data: { user } } = await client.auth.getUser();
 *     return user;
 *   },
 *   { maxAttempts: 3, initialDelayMs: 100 }
 * );
 * ```
 */
export async function withAuthRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelayMs = 100, onRetry } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is a 429 rate limit error
      const isRateLimitError =
        lastError.message.includes("request_rate_limit") ||
        lastError.message.includes("429") ||
        lastError.message.includes("Request rate limit");

      // Only retry on rate limit errors, not on other auth errors
      if (!isRateLimitError || attempt === maxAttempts) {
        throw lastError;
      }

      // Calculate exponential backoff delay
      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);

      // Call optional retry callback for logging
      if (onRetry) {
        onRetry(attempt, delayMs, lastError);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error("Auth retry failed without error");
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with a simple success/failure pattern.
 * Returns null on all failures instead of throwing.
 *
 * Useful for graceful degradation scenarios.
 *
 * Example:
 * ```typescript
 * const user = await withAuthRetrySafe(() =>
 *   supabase.auth.getUser().then(({ data: { user } }) => user)
 * );
 * // user is User | null
 * ```
 */
export async function withAuthRetrySafe<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T | null> {
  try {
    return await withAuthRetry(fn, options);
  } catch {
    return null;
  }
}
