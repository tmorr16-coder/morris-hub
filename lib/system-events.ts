import { createServiceClient } from "@/lib/supabase/server";

/**
 * The platform's shared failure log.
 *
 * Every integration used to report failures somewhere different — one to a
 * column, two to console.error, the crons nowhere — so answering "what is
 * broken?" meant opening each one and inferring from stale timestamps. These
 * two functions are the whole contract: record on failure, clear on success.
 *
 * Both are best-effort and never throw. A logger that can break the thing it is
 * logging about is worse than no logger.
 */

export type EventSource = "simplefin" | "oura" | "withings" | "apple-health" | "cron" | "openrouter";

export interface RecordFailureInput {
  source: EventSource;
  /** What this concerns — an item id, an integration name. Groups the history. */
  subject?: string | null;
  /** Null for platform work that belongs to no single person. */
  userId?: string | null;
  message: string;
  severity?: "error" | "warning";
  detail?: Record<string, unknown>;
}

/** Record a failure. Truncated, because a message is a summary, not a dump. */
export async function recordFailure(input: RecordFailureInput): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any;
    await db.schema("hub").from("system_events").insert({
      source: input.source,
      subject: input.subject ?? null,
      user_id: input.userId ?? null,
      severity: input.severity ?? "error",
      message: input.message.slice(0, 500),
      detail: input.detail ?? {},
    });
  } catch {
    // Logging must never take down the caller.
  }
}

/**
 * Close every open failure for one source+subject.
 *
 * Called on success, which is what makes "unresolved" mean "still broken now"
 * rather than "failed at some point" — the distinction that decides whether the
 * status page is worth looking at.
 */
export async function clearFailures(source: EventSource, subject?: string | null): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any;
    let q = db
      .schema("hub")
      .from("system_events")
      .update({ resolved_at: new Date().toISOString() })
      .eq("source", source)
      .is("resolved_at", null);
    q = subject == null ? q.is("subject", null) : q.eq("subject", subject);
    await q;
  } catch {
    // As above.
  }
}
