import Anthropic from "@anthropic-ai/sdk";
import { unstable_cache } from "next/cache";

interface Props {
  currentMonthSpend: number;
  prevMonthSpend: number;
  recurringMonthly: number;
  topCategories: { category: string; amount: number; prevAmount: number }[];
  topMerchants: { merchant: string; total: number; count: number }[];
}

async function generateRecs(props: Props): Promise<string[]> {
  const { currentMonthSpend, prevMonthSpend, recurringMonthly, topCategories, topMerchants } = props;

  const pctChange = prevMonthSpend > 0
    ? (((currentMonthSpend - prevMonthSpend) / prevMonthSpend) * 100).toFixed(0)
    : null;

  const catSummary = topCategories
    .slice(0, 8)
    .map((c) => {
      const delta = c.prevAmount > 0 ? (((c.amount - c.prevAmount) / c.prevAmount) * 100).toFixed(0) : null;
      return `${c.category}: $${c.amount.toFixed(0)}${delta ? ` (${Number(delta) > 0 ? "+" : ""}${delta}% vs last month)` : ""}`;
    })
    .join("\n");

  const merchantSummary = topMerchants
    .slice(0, 5)
    .map((m) => `${m.merchant}: $${m.total.toFixed(0)} (${m.count}×)`)
    .join(", ");

  const prompt = `You are a personal finance advisor. Analyze this spending data and provide 4 specific, actionable recommendations.

SPENDING SUMMARY (current month):
- Total spend: $${currentMonthSpend.toFixed(0)}${pctChange ? ` (${Number(pctChange) > 0 ? "+" : ""}${pctChange}% vs last month)` : ""}
- Recurring subscriptions/bills: ~$${recurringMonthly.toFixed(0)}/month

TOP CATEGORIES:
${catSummary}

TOP MERCHANTS THIS MONTH:
${merchantSummary}

Provide exactly 4 recommendations as a JSON array. Each should be specific to this actual data — not generic advice. Focus on:
- Subscriptions that might be consolidatable or cancellable
- Categories with significant month-over-month increases
- Opportunities to negotiate or find alternatives
- Quick wins based on the merchant data

Format: ["Rec 1 (1-2 sentences, specific dollar amounts)", "Rec 2", "Rec 3", "Rec 4"]
Return ONLY the JSON array, no other text.`;

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as string[];
  } catch {
    return [];
  }
}

// Cache per unique spending fingerprint — refreshes when numbers change meaningfully
const getCachedRecs = unstable_cache(
  generateRecs,
  ["spending-recs"],
  { revalidate: 3600 }
);

export default async function SpendingRecommendations(props: Props) {
  const recs = await getCachedRecs(props);

  if (recs.length === 0) return null;

  return (
    <div style={{
      background: "var(--color-paper-card)",
      border: "1px solid var(--color-rule)",
      borderRadius: 12,
      padding: "20px 24px",
      boxShadow: "var(--shadow-card)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="serif" style={{ fontSize: 20 }}>
          Recommendations
        </h2>
        <span style={{ fontSize: 10, color: "var(--color-bronze-dark)", background: "rgba(139,106,71,0.08)", padding: "3px 9px", borderRadius: 20, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
          AI · refreshes hourly
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {recs.map((rec, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: "var(--color-bronze)", color: "#fff",
              fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </div>
            <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.6, margin: 0 }}>{rec}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
