"use client";

import { useState } from "react";
import type { ClaudeTip } from "@/lib/tips";

const CATEGORY_LABEL: Record<string, string> = {
  general: "General", prompting: "Prompting", tools: "Tools",
  workflow: "Workflow", cost: "Cost", models: "Models",
};
const CATEGORY_COLOR: Record<string, string> = {
  general: "#6B6258", prompting: "#3B5C7F", tools: "#7B5BA2",
  workflow: "#4D6B3A", cost: "#8B6A47", models: "#9A3B2A",
};

export default function ClaudeTipClient({ tips }: { tips: ClaudeTip[] }) {
  const [idx, setIdx] = useState(0);
  const tip = tips[idx];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 className="serif" style={{ fontSize: 22 }}>
          Morris <span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>tips</span>
        </h2>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>{idx + 1} / {tips.length}</span>
          <button
            onClick={() => setIdx((i) => (i - 1 + tips.length) % tips.length)}
            style={navBtn}
            title="Previous tip"
          >‹</button>
          <button
            onClick={() => setIdx((i) => (i + 1) % tips.length)}
            style={navBtn}
            title="Next tip"
          >›</button>
        </span>
      </div>

      {tip ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
              color: CATEGORY_COLOR[tip.category] ?? "var(--color-ink-3)", minWidth: 60,
            }}>
              {CATEGORY_LABEL[tip.category] ?? tip.category}
            </span>
            <span style={{ fontSize: 14, color: "var(--color-ink)", fontWeight: 600, lineHeight: 1.4 }}>
              {tip.title}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.65, margin: 0, marginLeft: 70 }}>
            {tip.body}
          </p>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "30px 0", textAlign: "center" }}>
          No tips yet
        </p>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--color-rule)",
  borderRadius: 5,
  width: 22,
  height: 22,
  fontSize: 14,
  lineHeight: "1",
  cursor: "pointer",
  color: "var(--color-ink-3)",
  padding: 0,
  fontFamily: "inherit",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
