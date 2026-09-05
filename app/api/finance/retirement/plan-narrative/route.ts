import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPlan } from "@/app/finance/retirement/actions";
import { buildPlanReport, planReportBrief } from "@/app/finance/retirement/_lib/plan-report";
import { MODEL_BALANCED } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic();

// The brief is built server-side from the saved plan, never taken from the
// request body: the summary must describe the plan on the page, not whatever a
// caller chose to send.

const SYSTEM = `You write the summary section of a household's retirement plan document. The reader is the household and the people they share it with — a spouse, a parent, a financial advisor. Some of them have not seen the app.

Write in plain, direct English. No hype, no hedging boilerplate, no "as an AI". Use the numbers in the brief exactly; never invent or round beyond what is given. When you cite the nest egg, use the nominal figure as the headline and give the today's-dollars figure once, labelled.

Structure — use these exact headings, as markdown ### headings:
### Where the plan stands
Two or three sentences: the retirement date, the projected nest egg, whether the deterministic path lasts, and the Monte Carlo success rate with what the failures look like.
### What carries it
The three or four inputs the outcome most depends on (savings rate, the biggest account, Social Security timing, the chosen spending level, a large debt or lease). One bullet each, with the figure.
### What could go wrong
The two or three real risks visible in the numbers: the market-shock result, concentration in one employer's stock, healthcare or long-term-care costs, a debt running into retirement, a legacy goal not met. One bullet each, specific.
### Questions to discuss
Four to six short questions the household should talk through with each other or an advisor, each anchored to a number or a setting in this plan.

Total length: 250–400 words. Do not add a closing paragraph or disclaimer; the document has its own.`;

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Summary writing is not configured on this server." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await loadPlan();
  if (!plan.profile || !plan.scenario) {
    return NextResponse.json({ error: "Set up the retirement plan first." }, { status: 400 });
  }

  const report = buildPlanReport({
    profile: plan.profile,
    accounts: plan.accounts,
    incomes: plan.incomes,
    expenses: plan.expenses,
    debts: plan.debts,
    scenario: plan.scenario,
  });
  const brief = planReportBrief(report);

  try {
    const response = await client.messages.create({
      model: MODEL_BALANCED,
      max_tokens: 1200,
      system: [
        { type: "text", text: SYSTEM },
        { type: "text", text: brief, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: "Write the summary section for this plan." }],
    });
    const narrative = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!narrative) return NextResponse.json({ error: "The model returned nothing." }, { status: 502 });
    return NextResponse.json({ narrative });
  } catch (err: unknown) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limit hit — try again in a minute." }, { status: 429 });
    }
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[plan-narrative]", msg);
    return NextResponse.json({ error: "Could not write the summary right now." }, { status: 500 });
  }
}
