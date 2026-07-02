import type { DomainCardData } from "../_lib/domains";

const DOMAIN_EMOJI: Record<string, string> = {
  career: "💼", health: "🏃", mind: "🧠", spirit: "🕊️",
};

export default function DomainCard({ domain }: { domain: DomainCardData }) {
  return (
    <div style={{
      background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
      borderRadius: 14, padding: "18px 20px", boxShadow: "var(--shadow-card)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>{DOMAIN_EMOJI[domain.key]}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif",
          }}>
            {domain.label}
          </span>
        </div>
        <a href={domain.href} style={{
          fontSize: 11, color: "var(--color-accent)", textDecoration: "none",
          fontFamily: "var(--font-geist, system-ui), sans-serif", fontWeight: 600,
        }}>
          Open →
        </a>
      </div>

      {domain.disclaimer && (
        <div style={{
          fontSize: 11, color: "var(--color-ink-3)", marginBottom: 12, lineHeight: 1.5,
          fontFamily: "var(--font-geist, system-ui), sans-serif",
        }}>
          {domain.disclaimer}
        </div>
      )}

      {/* Recommended action — dominant element on the card */}
      <div className="serif" style={{ fontSize: 20, color: "var(--color-ink)", marginBottom: 6, lineHeight: 1.3 }}>
        {domain.recommendedAction.fitAdjustedText}
      </div>
      {domain.recommendedAction.fitStatus !== "deferred" && (
        <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginBottom: 12, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          ~{domain.recommendedAction.estimatedMinutes} minutes
        </div>
      )}
      {domain.recommendedAction.fitStatus === "deferred" && (
        <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginBottom: 12, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
          Your next couple hours look busy
        </div>
      )}

      {/* Goal + progress — secondary, text-only */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, paddingTop: 10,
        borderTop: "1px solid var(--color-rule-soft)", fontSize: 12, color: "var(--color-ink-3)",
        fontFamily: "var(--font-geist, system-ui), sans-serif",
      }}>
        <span style={{ flex: 1 }}>{domain.goal ?? "No goal set"}</span>
        <span>{domain.progressLabel}</span>
      </div>
    </div>
  );
}
