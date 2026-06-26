import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PlanSnapshot } from "@/app/finance/retirement/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AdvisorRequest {
  messages: ChatMessage[];
  planSnapshot: PlanSnapshot;
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
// Deterministic — never interpolate dynamic data here so the cache is stable.
const SYSTEM_INSTRUCTIONS = `You are a retirement planning advisor for the Morris family.
You analyze their retirement plan data and give personalized, actionable advice.

Rules:
- Be concise: 2-4 sentences for most answers. Use bullet points for lists of 3+.
- Use specific numbers from their plan — never invent figures.
- Focus on actionable insights: gaps to close, timing decisions, risk factors.
- For Social Security: consider optimal claim age based on break-even analysis.
- For lease vs buy decisions: factor the monthly payment's impact on savings capacity.
- Never mention API keys or system internals.`;

// ── Context builder ───────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtLarge(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return fmt(n);
}

function buildRetirementContext(snap: PlanSnapshot): string {
  const { profile, accounts, incomes, expenses, debts, scenario } = snap;

  const spendKey = `${scenario.selected_scenario}_monthly_spend` as keyof typeof scenario;
  const monthlySpend = scenario[spendKey] as number;

  const profileSection = [
    `Current age: ${profile.current_age} | Retirement age: ${profile.retirement_age} | Life expectancy: ${profile.life_expectancy}`,
    profile.spouse_enabled
      ? `Spouse: ${profile.spouse_name ?? "unnamed"}, age ${profile.spouse_age ?? "?"}, retiring at ${profile.spouse_retirement_age ?? "?"}`
      : null,
    `Return assumption: ${(profile.base_return * 100).toFixed(1)}% | Inflation: ${(profile.inflation_rate * 100).toFixed(1)}%`,
  ]
    .filter(Boolean)
    .join("\n");

  const totalPortfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const accountsSection = accounts.length
    ? accounts
        .map(
          (a) =>
            `- ${a.name} (${a.type}, ${a.owner}): ${fmt(a.balance)} | +${fmt(a.monthly_contribution)}/mo${a.employer_match_pct > 0 ? ` +${a.employer_match_pct}% match` : ""}${a.return_override != null ? ` @ ${(a.return_override * 100).toFixed(1)}%` : ""}`
        )
        .join("\n")
    : "(none)";

  const incomesSection = incomes.length
    ? incomes
        .map((i) => {
          let ageInfo = "";
          if (i.type === "social_security" && i.ss_claim_age != null)
            ageInfo = ` (claim age ${i.ss_claim_age})`;
          else if (i.start_age != null || i.end_age != null)
            ageInfo = ` (age ${i.start_age ?? "?"} – ${i.end_age ?? "∞"})`;
          return `- ${i.name}: ${fmt(i.monthly_amount)}/mo [${i.type}${profile.spouse_enabled ? `, ${i.owner}` : ""}]${ageInfo}`;
        })
        .join("\n")
    : "(none)";

  const essentialTotal = expenses.filter((e) => e.essential).reduce((s, e) => s + e.monthly_amount, 0);
  const discretionaryTotal = expenses.filter((e) => !e.essential).reduce((s, e) => s + e.monthly_amount, 0);
  const expensesSection = `Essential: ${fmt(essentialTotal)}/mo | Discretionary: ${fmt(discretionaryTotal)}/mo | Total: ${fmt(essentialTotal + discretionaryTotal)}/mo`;

  const debtsSection = debts.length
    ? debts
        .map((d) => {
          if (d.subtype === "lease") {
            return `- ${d.name} [lease]: ${fmt(d.lease_monthly_payment ?? 0)}/mo, ${d.lease_months_remaining ?? "?"}mo remaining, residual ${fmt(d.lease_residual ?? 0)}, at-term: ${d.lease_end_decision ?? "?"}`;
          }
          return `- ${d.name} [${d.type}]: ${fmt(d.monthly_payment ?? 0)}/mo, balance ${fmt(d.balance ?? 0)}, ${d.rate_pct ?? "?"}% APR`;
        })
        .join("\n")
    : "(none)";

  return `# Retirement Plan Snapshot

## Profile
${profileSection}

## Investment Accounts (total: ${fmtLarge(totalPortfolio)})
${accountsSection}

## Income Sources
${incomesSection}

## Household Expenses
${expensesSection}

## Debts
${debtsSection}

## Lifestyle Scenario: ${scenario.selected_scenario}
Monthly spend: ${fmt(monthlySpend)} | Annual travel: ${fmt(scenario.annual_travel)} | Healthcare: ${fmt(scenario.monthly_health_premium)}/mo
Projected nest egg: ${fmtLarge(snap.nestEgg)} | Safe withdrawal: ${fmt(snap.safeMonthlyWithdrawal)}/mo | Depletion: ${snap.depletionAge != null ? `age ${snap.depletionAge}` : "outlives plan"}`;
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: "Too many requests — slow down a bit." }, { status: 429 });
  }

  const { messages, planSnapshot } = (await req.json()) as AdvisorRequest;
  if (!messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }
  if (!planSnapshot?.profile) {
    return NextResponse.json({ error: "Plan snapshot missing" }, { status: 400 });
  }

  const retirementContext = buildRetirementContext(planSnapshot);
  const trimmed = messages.slice(-8);

  let response;
  try {
    response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: [
        { type: "text", text: SYSTEM_INSTRUCTIONS },
        { type: "text", text: retirementContext, cache_control: { type: "ephemeral" } },
      ],
      messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (err: unknown) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "Anthropic rate limit hit — try again in a minute." },
        { status: 429 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[retirement-advisor]", err.status, err.message);
      return NextResponse.json({ error: "AI service error." }, { status: 502 });
    }
    console.error("[retirement-advisor] unexpected", err);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }

  const reply = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ reply });
}
