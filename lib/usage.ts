import { createServiceClient } from "@/lib/supabase/server";

type EventType =
  | "chat"
  | "email"
  | "signup"
  | "oura_sync"
  | "withings_sync"
  | "apple_sync"
  | "support_ticket"
  | "integration_request"
  | "reminder_created"
  | "plaid_sync"
  | "ai_query";

interface LogEventOptions {
  eventType: EventType;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  tokensIn?: number;
  tokensOut?: number;
}

export async function logEvent(opts: LogEventOptions): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any;
    await db.from("usage_logs").insert({
      event_type: opts.eventType,
      user_id: opts.userId ?? null,
      metadata: opts.metadata ?? {},
      tokens_in: opts.tokensIn ?? null,
      tokens_out: opts.tokensOut ?? null,
    });
  } catch {
    // Non-fatal — never block the main request
  }
}
