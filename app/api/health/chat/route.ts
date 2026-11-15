import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/usage";
import { MODEL_FAST } from "@/lib/models";
import { CONTEXT_RULE, withAppContext } from "@/lib/ai/context";

const client = new Anthropic();

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Which coach. The instructions for each live here, not in the browser. */
  coach?: "nutrition" | "training" | "general";
  /** What the screen knows — recent workouts, the profile. Data, not instructions. */
  context?: string;
}

const RULES = "Keep replies concise, two to four sentences unless the question genuinely needs more. Be specific, encouraging and direct; never preachy. You are not a doctor: for symptoms, injuries, medication or anything urgent, say so plainly and suggest a professional. Stay on health, fitness and nutrition.";
const COACHES: Record<NonNullable<ChatRequest["coach"]>, string> = {
  nutrition: `You are a nutrition coach. Give practical, evidence-based advice about meals, macros, calorie estimates and healthy eating. If asked to estimate calories for a food, give a reasonable estimate with a brief explanation. ${RULES}`,
  training: `You are an expert personal trainer and strength coach. Give specific, actionable advice about programming, form, progressive overload and recovery, using the user's recent workouts when they are given. ${RULES}`,
  general: `You are a friendly health and fitness coach. ${RULES}`,
};

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

  const { messages, coach, context } = (await req.json()) as ChatRequest;
  const role = coach && coach in COACHES ? coach : "general";

  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Trim to the last 8 messages to cap token usage on long threads
  const trimmed = messages.slice(-8);

  const response = await client.messages.create({
    model: MODEL_FAST,
    max_tokens: 512,
    // This route used to take its entire system prompt from the request,
    // which made it an open model proxy for anyone signed in.
    system: `${COACHES[role]}\n\n${CONTEXT_RULE}`,
    messages: withAppContext(
      trimmed.filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
      typeof context === "string" ? context : "",
      { max: 8000 },
    ),
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
