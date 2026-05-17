import { getRandomTips } from "@/lib/tips";

const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  prompting: "Prompting",
  tools: "Tools",
  workflow: "Workflow",
  cost: "Cost",
  models: "Models",
};

const CATEGORY_COLOR: Record<string, string> = {
  general: "#6B6258",
  prompting: "#3B5C7F",
  tools: "#7B5BA2",
  workflow: "#4D6B3A",
  cost: "#8B6A47",
  models: "#9A3B2A",
};

export default async function ClaudeTipCard() {
  const tips = await getRandomTips(3);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 22 }}>
          Claude <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>tips</span>
        </h2>
        <span style={{ fontSize: 10, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          rotating
        </span>
      </div>

      {tips.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "30px 0", textAlign: "center" }}>
          No tips available yet
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {tips.map((tip, idx) => (
            <div
              key={tip.id}
              style={{
                padding: "12px 0",
                borderTop: idx === 0 ? undefined : "1px solid var(--color-rule-soft)",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: CATEGORY_COLOR[tip.category] ?? "var(--color-ink-3)",
                    minWidth: 60,
                  }}
                >
                  {CATEGORY_LABEL[tip.category] ?? tip.category}
                </span>
                <span style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500, lineHeight: 1.4 }}>
                  {tip.title}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginLeft: 70, lineHeight: 1.5 }}>
                {tip.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-rule)",
  borderRadius: 12,
  padding: "20px 24px",
  boxShadow: "var(--shadow-card)",
  minHeight: 220,
};
