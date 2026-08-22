import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { fetchWeather } from "@/lib/weather";
import { fetchQuotes } from "@/lib/stocks";
import { getAllUpcomingReminders } from "@/lib/reminders";
import { logEvent } from "@/lib/usage";
import { ASK_MORRIS_MODEL, type Router } from "@/lib/ask-morris";
import { AUTO_MODEL, askModel, openrouterConfigured } from "@/lib/openrouter";
import { MODEL_FAST } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface InvestmentContext {
  ideasCount: number;
  ideas: Array<{ title: string; category: string; status: string }>;
  filters: {
    category: string;
    status: string;
    favorites: boolean;
    capitalRange: [number, number];
    returnsRange: [number, number];
  };
}

interface ChatRequest {
  messages: ChatMessage[];
  investmentContext?: InvestmentContext;
  systemPrompt?: string;
  router?: Router; // "auto" hands the turn to OpenRouter's Auto Router
}

const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Stable instructions — cached as part of the prefix.
const SYSTEM_INSTRUCTIONS = `You are Morris, the AI at the center of morrisai.family — Terry's personal & family platform. You are the single assistant that spans everything in the app: his day, to-dos & reminders, family circle, health & fitness, finances & net worth, investments, career & goals, Bible reading, and news.

You have access to a live snapshot of Terry's state across these areas, provided below. Use it to answer anything he asks about his life in the app.

Rules:
- Be concise: 2-4 sentences for most answers. Use bullet points only when listing 3+ items.
- Reference the actual data provided below — never invent numbers, weather, to-dos, reminders, balances, or health figures.
- You cover the WHOLE platform. Don't tell Terry to "go to another app" — you are that app. If a detail isn't in the snapshot, say what you do know and point him to the relevant section in-app (e.g. Health, Finance, Career, Bible, Tasks) by name.
- Weather is Fahrenheit; money is USD. Infer "today/tomorrow/this week" from the current date in the snapshot.
- Helpful but not chatty. Skip pleasantries unless Terry is being conversational.
- Never mention API keys, system internals, models, or how data was collected.
`;

interface Todo {
  title: string;
  completed: boolean;
  priority: string | null;
  due_date: string | null;
}

function buildContext(args: {
  locationName: string;
  weatherSummary: string;
  todos: Todo[];
  stocksSummary: string;
  newsTopics: string[];
  todayIso: string;
  remindersSummary: string;
  financeSummary: string;
  healthSummary: string;
  careerSummary: string;
  familySummary: string;
}): string {
  const openTodos = args.todos.filter((t) => !t.completed);
  const todoLines = openTodos.length === 0
    ? "  (no open todos)"
    : openTodos
        .map((t) => {
          const parts: string[] = [];
          if (t.priority) parts.push(`[${t.priority.toUpperCase()}]`);
          parts.push(t.title);
          if (t.due_date) parts.push(`(due ${t.due_date})`);
          return `  - ${parts.join(" ")}`;
        })
        .join("\n");

  const completedCount = args.todos.filter((t) => t.completed).length;

  return `# Current state

Today's date: ${args.todayIso}
Terry's location: ${args.locationName}

## Weather
${args.weatherSummary}

## To-dos
Open (${openTodos.length}):
${todoLines}

Recently completed: ${completedCount}

## Reminders (upcoming)
${args.remindersSummary}

## Family
${args.familySummary}

## Health & fitness
${args.healthSummary}

## Finances
${args.financeSummary}

## Career & goals
${args.careerSummary}

## Stocks (today's quotes)
${args.stocksSummary}

## News topics Terry follows
${args.newsTopics.join(", ")}`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: "Too many requests — wait a moment." }, { status: 429 });
  }

  const { messages, investmentContext, systemPrompt, router } = (await req.json()) as ChatRequest;
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Keep enough of the thread that follow-ups ("what about the other one?")
  // still resolve — 8 messages was only four exchanges. The system context block
  // is cached, so the extra turns are the only added cost.
  const trimmed = messages.slice(-20);

  // If investment context is provided, use simpler investment-focused chat
  if (investmentContext && systemPrompt) {
    try {
      const response = await client.messages.create({
        model: MODEL_FAST,
        max_tokens: 1024,
        system: systemPrompt,
        messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
      });

      const reply = response.content[0].type === "text" ? response.content[0].text : "";
      logEvent({ eventType: "chat", userId: user.id, tokensIn: response.usage?.input_tokens ?? 0, tokensOut: response.usage?.output_tokens ?? 0, metadata: { model: MODEL_FAST, source: "investments" } });
      return NextResponse.json({ reply });
    } catch (err: unknown) {
      if (err instanceof Anthropic.RateLimitError) {
        return NextResponse.json({ error: "Anthropic rate limit — try again." }, { status: 429 });
      }
      if (err instanceof Anthropic.APIError) {
        console.error("[investment-chat]", err.status, err.message);
        return NextResponse.json({ error: "AI service error" }, { status: 502 });
      }
      console.error("[investment-chat] unexpected", err);
      return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
  }

  // Fetch all context in parallel
  const prefs = await getPreferences(user.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const [{ data: todoRows }, weatherResult, stockResult] = await Promise.all([
    service
      .schema("hub")
      .from("todos")
      .select("title, completed, priority, due_date")
      .eq("user_id", user.id)
      .order("completed", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50),
    prefs.latitude && prefs.longitude
      ? fetchWeather(prefs.latitude, prefs.longitude).catch(() => null)
      : Promise.resolve(null),
    prefs.stock_tickers.length > 0 ? fetchQuotes(prefs.stock_tickers).catch(() => []) : Promise.resolve([]),
  ]);

  // Broader cross-app snapshot — each source is independently defensive so a
  // missing table/module never breaks the chat.
  const [reminders, netRow, stepsRows, weightRow, careerGoals, familyRows] = await Promise.all([
    getAllUpcomingReminders(user.id).catch(() => []),
    service.schema("finance").from("net_position_snapshots")
      .select("net_position, captured_at").eq("user_id", user.id)
      .order("captured_at", { ascending: false }).limit(1).maybeSingle()
      .then((r: { data: unknown }) => r.data).catch(() => null),
    service.from("apple_health_metrics")
      .select("value").eq("user_id", user.id)
      .in("metric_name", ["step_count", "steps", "Step Count", "Steps"])
      .gte("timestamp", new Date(Date.now() - 26 * 3_600_000).toISOString())
      .then((r: { data: unknown[] }) => r.data ?? []).catch(() => []),
    service.from("apple_health_metrics")
      .select("value, timestamp").eq("user_id", user.id)
      .in("metric_name", ["body_mass", "weight", "Weight", "Body Mass"])
      .order("timestamp", { ascending: false }).limit(1).maybeSingle()
      .then((r: { data: unknown }) => r.data).catch(() => null),
    service.schema("career").from("career_goals")
      .select("title, status, progress_pct, target_date").eq("user_id", user.id).eq("status", "active").limit(8)
      .then((r: { data: unknown[] }) => r.data ?? []).catch(() => []),
    service.schema("hub").from("family_members")
      .select("display_name, nickname, role").eq("user_id", user.id).limit(20)
      .then((r: { data: unknown[] }) => r.data ?? []).catch(() => []),
  ]);

  // Build summaries for the LLM
  let weatherSummary = "(weather unavailable)";
  if (weatherResult) {
    const w = weatherResult;
    const upcoming = w.periods
      .slice(0, 5)
      .map((p) => `  - ${p.name}: ${p.temperature}°F, ${p.shortForecast}`)
      .join("\n");
    weatherSummary = `Current: ${w.current.temperature ?? "—"}°F, ${w.current.description}\nUpcoming:\n${upcoming}`;
  }

  const stocksSummary =
    stockResult.length === 0
      ? "(stocks unavailable)"
      : stockResult
          .map(
            (q) =>
              `  - ${q.symbol} (${q.shortName}): $${q.price.toFixed(2)}, ${q.changePercent > 0 ? "+" : ""}${q.changePercent.toFixed(2)}% today`
          )
          .join("\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remindersSummary = (reminders as any[]).length === 0
    ? "  (no upcoming reminders)"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (reminders as any[]).slice(0, 8).map((r) => `  - ${r.title}${r.category ? ` [${r.category}]` : ""}${r.due_at ? ` (due ${new Date(r.due_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })})` : ""}`).join("\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const net = (netRow as any)?.net_position;
  const financeSummary = typeof net === "number"
    ? `Net worth: ${net.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} (latest snapshot).`
    : "(no net-worth snapshot yet)";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stepsToday = (stepsRows as any[]).reduce((s, r) => s + (Number(r.value) || 0), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weightVal = (weightRow as any)?.value;
  const healthParts: string[] = [];
  if (stepsToday > 0) healthParts.push(`Steps today: ${Math.round(stepsToday).toLocaleString()}`);
  if (typeof weightVal === "number") healthParts.push(`Latest weight: ${weightVal.toFixed(1)} lb`);
  const healthSummary = healthParts.length > 0 ? healthParts.join(". ") + "." : "(no recent health data)";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const careerSummary = (careerGoals as any[]).length === 0
    ? "(no active goals)"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (careerGoals as any[]).map((g) => `  - ${g.title}${typeof g.progress_pct === "number" ? ` (${g.progress_pct}%)` : ""}${g.target_date ? ` — target ${g.target_date}` : ""}`).join("\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const familySummary = (familyRows as any[]).length === 0
    ? "(no family members added)"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (familyRows as any[]).map((m) => `${m.display_name ?? m.nickname ?? "Member"}${m.role === "child" ? " (child)" : ""}`).join(", ");

  const context = buildContext({
    locationName: prefs.location_name ?? "Unknown",
    weatherSummary,
    todos: (todoRows ?? []) as Todo[],
    stocksSummary,
    newsTopics: prefs.news_topics,
    todayIso: new Date().toISOString().slice(0, 10),
    remindersSummary,
    financeSummary,
    healthSummary,
    careerSummary,
    familySummary,
  });

  // Auto Router: OpenRouter picks the model for this turn. Morris's whole
  // system context goes along, so it answers with the same knowledge — only the
  // brain changes. Falls back to the default if there's no OpenRouter key.
  if (router === "auto" && openrouterConfigured()) {
    try {
      const out = await askModel(
        AUTO_MODEL,
        [
          { role: "system", content: `${SYSTEM_INSTRUCTIONS}\n\n${context}` },
          ...trimmed.map((m) => ({ role: m.role, content: m.content })),
        ],
        1024,
      );
      logEvent({
        eventType: "chat",
        userId: user.id,
        metadata: { model: out.served ?? AUTO_MODEL, source: "hub", router: "auto", cost: out.cost },
      });
      return NextResponse.json({ reply: out.content, model: out.served ?? AUTO_MODEL, router: "auto", cost: out.cost });
    } catch (err) {
      console.error("[hub-chat] auto router", err);
      return NextResponse.json({ error: `Auto Router failed: ${(err as Error).message}` }, { status: 502 });
    }
  }

  let response;
  try {
    response = await client.messages.create({
      model: ASK_MORRIS_MODEL,
      max_tokens: 1024,
      system: [
        { type: "text", text: SYSTEM_INSTRUCTIONS },
        { type: "text", text: context, cache_control: { type: "ephemeral" } },
      ],
      messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (err: unknown) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Anthropic rate limit — try again." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[hub-chat]", err.status, err.message);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }
    console.error("[hub-chat] unexpected", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  // Log usage for cost tracking (fire-and-forget)
  logEvent({
    eventType: "chat",
    userId: user.id,
    tokensIn: response.usage?.input_tokens ?? 0,
    tokensOut: response.usage?.output_tokens ?? 0,
    metadata: { model: ASK_MORRIS_MODEL, source: "hub" },
  });

  return NextResponse.json({ reply, model: ASK_MORRIS_MODEL, router: "default" });
}
