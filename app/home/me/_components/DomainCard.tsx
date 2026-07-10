import { IconBadge, Icons } from "@/components/ios";
import type { DomainCardData } from "../_lib/domains";

const DOMAIN_ICON: Record<string, { icon: React.ReactNode; color: string }> = {
  career:  { icon: <Icons.BriefcaseIcon />, color: "var(--ios-tint)" },
  health:  { icon: <Icons.HeartIcon />, color: "var(--ios-green)" },
  mind:    { icon: <Icons.SparkleIcon />, color: "#6B5B95" },
  spirit:  { icon: <Icons.MoonIcon />, color: "#7B5EA7" },
  courses: { icon: <Icons.BookIcon />, color: "var(--ios-orange)" },
};

export default function DomainCard({ domain }: { domain: DomainCardData }) {
  const meta = DOMAIN_ICON[domain.key];
  return (
    <div style={{
      background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "16px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {meta && <IconBadge color={meta.color}>{meta.icon}</IconBadge>}
          <span className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
            {domain.label}
          </span>
        </div>
        <a href={domain.href} className="ios-subhead" style={{ color: "var(--ios-tint)", fontWeight: 500 }}>
          Open
        </a>
      </div>

      {domain.disclaimer && (
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 12, lineHeight: 1.5 }}>
          {domain.disclaimer}
        </div>
      )}

      {/* Recommended action — dominant element on the card */}
      {domain.recommendedAction.href ? (
        <a href={domain.recommendedAction.href} className="ios-title-3" style={{
          display: "block", color: "var(--ios-label)", marginBottom: 6, lineHeight: 1.3,
        }}>
          {domain.recommendedAction.fitAdjustedText}
        </a>
      ) : (
        <div className="ios-title-3" style={{ color: "var(--ios-label)", marginBottom: 6, lineHeight: 1.3 }}>
          {domain.recommendedAction.fitAdjustedText}
        </div>
      )}
      {domain.recommendedAction.fitStatus !== "deferred" && (
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginBottom: 12 }}>
          ~{domain.recommendedAction.estimatedMinutes} minutes
        </div>
      )}
      {domain.recommendedAction.fitStatus === "deferred" && (
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginBottom: 12 }}>
          Your next couple hours look busy
        </div>
      )}

      {/* Goal + progress — secondary, text-only */}
      <div className="ios-footnote" style={{
        display: "flex", alignItems: "center", gap: 10, paddingTop: 10,
        borderTop: "var(--ios-hair) solid var(--ios-separator)", color: "var(--ios-label-2)",
      }}>
        <span style={{ flex: 1 }}>{domain.goal ?? "No goal set"}</span>
        <span className="ios-num">{domain.progressLabel}</span>
      </div>

      {domain.secondaryLink && (
        <a href={domain.secondaryLink.href} className="ios-footnote" style={{
          display: "inline-block", marginTop: 10, color: "var(--ios-tint)", fontWeight: 500,
        }}>
          {domain.secondaryLink.text}
        </a>
      )}
    </div>
  );
}
