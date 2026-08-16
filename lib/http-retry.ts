// Outbound HTTP with a deadline and bounded retries.
//
// Travel providers fail in ways a single fetch can't survive: a request that
// hangs past the route's own timeout, a 429 when several searches land at once,
// a transient 5xx. Retrying those (and only those) turns most of them into a
// slightly slower success instead of an error on screen.

export interface RetryOptions {
  timeoutMs?: number;   // per attempt
  retries?: number;     // extra attempts after the first
  backoffMs?: number;   // base delay, doubled each retry
  label?: string;       // used in the thrown message
}

/** Status codes worth trying again — everything else is the answer. */
function retriable(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch() with a per-attempt timeout and exponential backoff on transient
 * failures. Resolves with the Response for any non-retriable status — callers
 * still decide what a 4xx means.
 */
export async function fetchWithRetry(url: string, init: RequestInit = {}, opts: RetryOptions = {}): Promise<Response> {
  const { timeoutMs = 12_000, retries = 2, backoffMs = 400, label = "request" } = opts;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (retriable(res.status) && attempt < retries) {
        // Honour Retry-After when the provider tells us how long to wait.
        const after = Number(res.headers.get("retry-after"));
        await wait(Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 4000) : backoffMs * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      // Timeouts and network drops land here.
      lastError = err as Error;
      if (attempt < retries) { await wait(backoffMs * 2 ** attempt); continue; }
    }
  }

  const reason = lastError?.name === "TimeoutError" ? `timed out after ${timeoutMs}ms` : lastError?.message ?? "network error";
  throw new Error(`${label} ${reason}`);
}
