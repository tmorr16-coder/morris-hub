import { getTodaysTip } from "@/lib/tips";

const CATEGORY_LABEL: Record<string, string> = {
  general: "General",
  prompting: "Prompting",
  tools: "Tools",
  workflow: "Workflow",
};

export default async function ClaudeTipCard() {
  const tip = await getTodaysTip();

  if (!tip) {
    return (
      <div style={card}>
        <h2 className="serif" style={{ fontSize: 22 }}>Claude tip</h2>
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0", textAlign: "center" }}>
          No tip available yet
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 22 }}>
          Claude <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>tip</span>
        </h2>
        <span
          style={{
            fontSize: 10,
            color: "var(--color-accent-dark)",
            background: "var(--color-accent-soft)",
            padding: "3px 9px",
            borderRadius: 20,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {CATEGORY_LABEL[tip.category] ?? tip.category}
        </span>
      </div>

      <div className="serif" style={{ fontSize: 22, lineHeight: 1.25, color: "var(--color-ink)", marginBottom: 12 }}>
        {tip.title}
      </div>

      <p style={{ fontSize: 14, color: "var(--color-ink-2)", lineHeight: 1.6 }}>{tip.body}</p>
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
