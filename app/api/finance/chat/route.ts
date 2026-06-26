import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

// ── Rate limit ────────────────────────────────────────────────────────────
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

setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of rateLimiter) if (now > entry.resetAt) rateLimiter.delete(k);
}, WINDOW_MS * 5);

// ── Stable system instructions ────────────────────────────────────────────
// IMPORTANT: keep this 100% deterministic — any change invalidates the cache.
// Never interpolate timestamps, user names, or per-request IDs in here.
const SYSTEM_INSTRUCTIONS = `You are a personal finance assistant for the Morris family.
You answer questions about their spending, accounts, and financial habits using the real data provided below.

Rules:
- Be concise: 2-4 sentences for most answers. Use bullet points only when listing 3+ items.
- Use the user's actual data — never invent numbers or merchants.
- Cite specific transactions or amounts when relevant.
- Currency is USD. Format amounts as $X,XXX.XX.
- Amount sign convention: positive amounts are money OUT (spending, debits), negative amounts are money IN (income, deposits, refunds).
- For "last month" questions, infer the calendar month from the dates in the data — do not ask the user what date it is.
- If the data doesn't contain enough to answer, say so plainly — don't speculate.
- Never mention API keys, access tokens, system internals, or how the data was collected.
`;

// ── Context builder ───────────────────────────────────────────────────────

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  current_balance: number | null;
  iso_currency_code: string;
}

interface Transaction {
  id: string;
  account_id: string;
  date: string;
  amount: number;
  merchant_name: string | null;
  name: string;
  pending: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  personal_finance_category: any;
}

function fmt(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function buildFinanceContext(accounts: Account[], transactions: Transaction[]): string {
  // Accounts table
  const accountsBlock = accounts
    .map((a) => {
      const bal = a.current_balance ?? 0;
      const isLiability = a.type === "credit" || a.type === "loan";
      const display = isLiability ? -bal : bal;
      return `- [${a.id.slice(0, 8)}] ${a.name} (${a.type}/${a.subtype ?? "?"}, ····${a.mask ?? "??"}): ${fmt(display)}`;
    })
    .join("\n");

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // Sort transactions deterministically (oldest → newest, then by id) for stable caching
  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  // Transactions list — compact format, one per line
  const txnsBlock = sorted
    .map((t) => {
      const acct = accountById.get(t.account_id);
      const acctTag = acct ? `${acct.name.split(" ")[0]}····${acct.mask ?? ""}` : "?";
      const cat = t.personal_finance_category?.primary
        ?.toLowerCase()
        ?.split("_")
        ?.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        ?.join(" ") ?? "Uncategorized";
      const merchant = t.merchant_name ?? t.name;
      const pending = t.pending ? " [pending]" : "";
      return `${t.date} | ${fmt(t.amount).padStart(10)} | ${cat.padEnd(20)} | ${merchant.slice(0, 40).padEnd(40)} | ${acctTag}${pending}`;
    })
    .join("\n");

  // Spending summary by category (last 30 days, outflows only)
  const today = sorted.length > 0 ? sorted[sorted.length - 1].date : "";
  const thirtyAgo = today
    ? new Date(new Date(today + "T12:00:00").getTime() - 30 * 86400_000).toISOString().slice(0, 10)
    : "";
  const last30 = sorted.filter((t) => t.date >= thirtyAgo && t.amount > 0);
  const byCategory = new Map<string, number>();
  for (const t of last30) {
    const cat = t.personal_finance_category?.primary
      ?.toLowerCase()
      ?.split("_")
      ?.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      ?.join(" ") ?? "Uncategorized";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + t.amount);
  }
  const categoryList = [...byCategory.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([cat, total]) => `- ${cat}: ${fmt(total)}`)
    .join("\n");

  const totalOut = last30.reduce((s, t) => s + t.amount, 0);
  const totalIn = sorted.filter((t) => t.date >= thirtyAgo && t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return `# Financial state

## Accounts (${accounts.length})
${accountsBlock}

## Spending summary (last 30 days, by category)
${categoryList || "(no spending recorded)"}

Total outflow: ${fmt(totalOut)}
Total inflow:  ${fmt(totalIn)}

## All recent transactions (${sorted.length} total, oldest first)
Format: DATE | AMOUNT | CATEGORY | MERCHANT | ACCOUNT

${txnsBlock}`;
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured." }, { status: 503 });
  }

  // Auth guard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit
  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: "Too many requests — slow down a bit." }, { status: 429 });
  }

  const { messages } = (await req.json()) as ChatRequest;
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Fetch context server-side using the user's own RLS scope
  // (use service client because schema is finance.*; manually filter by user_id)
  const service = createServiceClient();

  // First find the user's plaid_item ids, then their accounts, then their transactions.
  const { data: itemRows } = await service
    .schema("finance")
    .from("plaid_items")
    .select("id")
    .eq("user_id", user.id);
  const itemIds = (itemRows ?? []).map((r) => r.id);

  if (itemIds.length === 0) {
    return NextResponse.json({
      reply: "No connected accounts yet. Connect a bank from the dashboard and I'll be able to help.",
    });
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);

  const [{ data: accountRows }, { data: txRows }] = await Promise.all([
    service
      .schema("finance")
      .from("accounts")
      .select("id, item_id, name, type, subtype, mask, current_balance, iso_currency_code")
      .in("item_id", itemIds),
    service
      .schema("finance")
      .from("transactions")
      .select("id, account_id, date, amount, merchant_name, name, pending, personal_finance_category")
      .gte("date", ninetyDaysAgo)
      .order("date", { ascending: false })
      .limit(500),
  ]);

  // Defensive: filter transactions to only those whose account belongs to this user
  const validAccountIds = new Set((accountRows ?? []).map((a) => a.id));
  const transactions = (txRows ?? []).filter((t) => validAccountIds.has(t.account_id));

  const financeContext = buildFinanceContext(
    (accountRows ?? []) as Account[],
    transactions as Transaction[]
  );

  // Trim conversation history to keep tokens manageable
  const trimmed = messages.slice(-8);

  let response;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: [
        // Stable header — no cache_control, will be cached as part of the next block's prefix
        { type: "text", text: SYSTEM_INSTRUCTIONS },
        // Financial context — cache breakpoint here. Changes when txn data changes,
        // otherwise reused across messages in the same conversation.
        { type: "text", text: financeContext, cache_control: { type: "ephemeral" } },
      ],
      messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (err: unknown) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Anthropic rate limit hit — try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[finance-chat]", err.status, err.message);
      return NextResponse.json({ error: "AI service error." }, { status: 502 });
    }
    console.error("[finance-chat] unexpected", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const reply = response.content[0].type === "text" ? response.content[0].text : "";

  // Audit log (privacy-respecting: no question/response content, only metadata)
  service
    .schema("finance")
    .from("audit_log")
    .insert({
      user_id: user.id,
      action: "ai_query",
      metadata: {
        model: response.model,
        question_chars: trimmed[trimmed.length - 1]?.content?.length ?? 0,
        reply_chars: reply.length,
        tokens_in: response.usage?.input_tokens,
        tokens_out: response.usage?.output_tokens,
        cache_read_tokens: response.usage?.cache_read_input_tokens,
        cache_write_tokens: response.usage?.cache_creation_input_tokens,
      },
    })
    .then(({ error }: { error: unknown }) => {
      if (error) console.error("[finance-chat] audit log failed", error);
    });

  return NextResponse.json({ reply });
}
