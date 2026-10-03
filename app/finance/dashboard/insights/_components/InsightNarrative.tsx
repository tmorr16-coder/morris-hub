import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { unstable_cache } from "next/cache";
import { MODEL_DEEP } from "@/lib/models";
import { withDeadline } from "@/lib/deadline";
import type { InsightReport } from "@/lib/finance/insights";

// The narrative on top of the facts.
//
// The old version was handed eight category totals and asked to think of four
// recommendations. It produced the advice that fits any household: cancel a
// subscription, cook more, negotiate the phone bill. Nothing it said could be
// checked, because nothing it was given was specific enough to check.
//
// This one is handed the whole computed report — every insight with its id and
// its dollar figure, the windows, the pace, the recurring series — and told to
// use only what is there. It ranks and connects; it does not count. Every point
// it makes names the insight it rests on, so the screen can show the number
// beside the sentence and a reader can see where the sentence came from.

interface Narrative {
  headline: string;
  points: { insightId: string | null; text: string }[];
  caveat: string | null;
}

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One sentence on the month, under 120 characters, with the number that matters most." },
    points: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          insightId: { type: ["string", "null"], description: "The id of the insight this point rests on, or null when it connects several." },
          text: { type: "string", description: "One or two sentences, specific, with dollars from the report. No generic advice." },
        },
        required: ["insightId", "text"],
        additionalProperties: false,
      },
    },
    caveat: { type: ["string", "null"], description: "One sentence on what the data cannot show, if anything material. Otherwise null." },
  },
  required: ["headline", "points", "caveat"],
  additionalProperties: false,
} as const;

const SYSTEM = `You write the short narrative at the top of a family's spending insights screen.

You are given a computed report: windows of income and spending, the month's projected total, every recurring charge with what changed about it, and a ranked list of insights, each with an id and the dollar figures behind it.

Rules:
- Use only numbers that appear in the report. Never estimate, extrapolate or round into a different figure. If you cannot say something with a number from the report, do not say it.
- Rank by consequence in dollars. A new $10 subscription is not worth a point when dining is up $600.
- Connect facts where they explain each other: a merchant spike that accounts for a category's rise is one point, not two.
- No generic advice. Nothing a reader could have been told without looking at their data. "Consider cooking at home more" is forbidden; "Fancy dining ran $900 this month against $300 usually; those six charges are the whole rise" is the standard.
- Plain, direct sentences. No exclamation marks, no cheerleading, no "great job".
- Point to what is going right when it is, in the same register.
- When the comparison is against under three months of history, say so once in the caveat.`;

async function generate(payload: string): Promise<Narrative | null> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: MODEL_DEEP,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: jsonSchemaOutputFormat(SCHEMA) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Today's report, as JSON:\n\n${payload}` }],
  });
  if (response.stop_reason === "refusal") return null;
  const out = response.parsed_output as Narrative | null | undefined;
  if (!out || !Array.isArray(out.points)) return null;
  return out;
}

// The fingerprint is part of the key, so the narrative is regenerated the
// moment the facts move and served from cache while they hold.
const cached = unstable_cache(
  async (fingerprint: string, payload: string) => {
    void fingerprint;
    try { return await generate(payload); } catch { return null; }
  },
  ["insight-narrative-v2"],
  { revalidate: 3600 },
);

/** Only what the model needs, in a stable shape, so equal facts cache equal. */
function payloadFor(report: InsightReport): string {
  const r = report;
  return JSON.stringify({
    today: r.today,
    history_days: r.span?.days ?? 0,
    last_30_days: { spend: r.last30.spend, income: r.last30.income, net: r.last30.net, savings_rate: r.last30.savingsRate, transfers_excluded: r.last30.transfers },
    prior_30_days: { spend: r.prior30.spend, income: r.prior30.income },
    baseline_per_30_days: r.baseline30 ? { spend: r.baseline30.spend, income: r.baseline30.income } : null,
    this_month: { day: r.pace.dayOfMonth, of: r.pace.daysInMonth, spent_so_far: r.pace.spentSoFar, projected: r.pace.projected, usual_full_month: r.pace.baseline },
    recurring_monthly_total: r.recurringMonthly,
    recurring: r.recurring.slice(0, 25).map((s) => ({ merchant: s.merchant, cadence: s.cadence, amount: s.amount, per_month: s.monthlyCost, status: s.status, new: s.isNew, price_change: s.priceChange, varies: s.variable })),
    insights: r.insights.map((i) => ({ id: i.id, level: i.level, kind: i.kind, title: i.title, detail: i.detail, amount: i.amount, delta: i.delta })),
  });
}

export default async function InsightNarrative({ report }: { report: InsightReport }) {
  if (!process.env.ANTHROPIC_API_KEY || report.insights.length === 0) return null;
  // Streamed in its own boundary, but still bounded: a slow model answer must
  // not hold the page open — the computed list below it is the product.
  const narrative = await withDeadline(cached(report.fingerprint, payloadFor(report)), 20_000, null, "insight-narrative");
  if (!narrative) return null;
  const byId = new Map(report.insights.map((i) => [i.id, i]));
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="ios-list" style={{ margin: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span className="ios-caption" style={{ color: "var(--ios-finance)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>The month, in short</span>
          <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>From the figures below</span>
        </div>
        <p className="ios-headline" style={{ margin: "6px 0 0", lineHeight: 1.35 }}>{narrative.headline}</p>
      </div>
      {narrative.points.slice(0, 5).map((p, i) => {
        const ref = p.insightId ? byId.get(p.insightId) : null;
        return (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 16px", boxShadow: "inset 0 0.5px 0 0 var(--ios-separator)" }}>
            <span className="ios-num" style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--ios-fill)", color: "var(--ios-label-2)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            <p className="ios-footnote" style={{ color: "var(--ios-label)", lineHeight: 1.5, margin: 0, flex: 1 }}>
              {p.text}
              {ref && ref.amount != null && (
                <span style={{ color: "var(--ios-label-3)" }}> · {ref.delta != null && ref.delta !== 0 ? `${ref.delta > 0 ? "+" : "−"}${fmt(Math.abs(ref.delta))}` : fmt(ref.amount)}</span>
              )}
            </p>
          </div>
        );
      })}
      {narrative.caveat && (
        <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "8px 16px 12px", margin: 0, boxShadow: "inset 0 0.5px 0 0 var(--ios-separator)" }}>{narrative.caveat}</p>
      )}
    </div>
  );
}
