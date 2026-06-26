import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/usage";

const client = new Anthropic();

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  systemContext: string;
}

// In-memory rate limiter — 10 requests per IP per 60s window
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Keep map from growing unboundedly between deploys
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimiter) {
    if (now > entry.resetAt) rateLimiter.delete(key);
  }
}, WINDOW_MS * 5);

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 503 }
    );
  }

  // Auth guard — must be signed in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit by user ID (more reliable than IP for authenticated routes)
  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many requests — please wait a moment and try again." },
      { status: 429 }
    );
  }

  const { messages, systemContext } = (await req.json()) as ChatRequest;

  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Trim to the last 8 messages to cap token usage on long threads
  const trimmed = messages.slice(-8);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: systemContext,
    messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
  });

  const reply =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Fire-and-forget usage log
  logEvent({
    eventType: "chat",
    userId: user.id,
    tokensIn: response.usage?.input_tokens,
    tokensOut: response.usage?.output_tokens,
    metadata: { model: response.model },
  });

  return NextResponse.json({ reply });
}
