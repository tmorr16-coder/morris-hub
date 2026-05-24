import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { fetchWeather } from "@/lib/weather";
import { fetchQuotes } from "@/lib/stocks";

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
const SYSTEM_INSTRUCTIONS = `You are a personal assistant for the Morris family, helping Terry with daily life and productivity.

You have access to Terry's current state: today's weather forecast, his to-do list, his stock watchlist with live prices, and his news preferences.

Rules:
- Be concise: 2-4 sentences for most answers. Use bullet points only when listing 3+ items.
- Reference the actual data provided below — never invent numbers, weather conditions, or to-do items.
- For weather, currency is Fahrenheit. For stocks, currency is USD.
- For dates, infer "today", "tomorrow", "this week" relative to the current date in the data context.
- If asked about something not in the data (e.g. health data, finance data, calendar), say so plainly and suggest the right app — for finance questions point to finance.morrisai.family, for health point to health.morrisai.family.
- Helpful but not chatty. Skip pleasantries unless the user is being conversational.
- Never mention API keys, system internals, or how data was collected.
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

  const { messages, investmentContext, systemPrompt } = (await req.json()) as ChatRequest;
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const trimmed = messages.slice(-8);

  // If investment context is provided, use simpler investment-focused chat
  if (investmentContext && systemPrompt) {
    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
      });

      const reply = response.content[0].type === "text" ? response.content[0].text : "";
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

  const context = buildContext({
    locationName: prefs.location_name ?? "Unknown",
    weatherSummary,
    todos: (todoRows ?? []) as Todo[],
    stocksSummary,
    newsTopics: prefs.news_topics,
    todayIso: new Date().toISOString().slice(0, 10),
  });

  let response;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
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
  return NextResponse.json({ reply });
}
