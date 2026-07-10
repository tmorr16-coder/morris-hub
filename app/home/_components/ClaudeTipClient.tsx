"use client";

import { useState } from "react";
import type { ClaudeTip } from "@/lib/tips";
import { IconBadge, Icons } from "@/components/ios";

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
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px 6px" }}>
        <span className="ios-headline">Morris tips</span>
        {tips.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>{idx + 1} / {tips.length}</span>
            <button
              onClick={() => setIdx((i) => (i - 1 + tips.length) % tips.length)}
              style={navBtn}
              aria-label="Previous tip"
            ><Icons.ChevronLeft width={15} height={15} /></button>
            <button
              onClick={() => setIdx((i) => (i + 1) % tips.length)}
              style={navBtn}
              aria-label="Next tip"
            ><Icons.ChevronRight width={15} height={15} /></button>
          </span>
        )}
      </div>

      {tip ? (
        <div className="ios-cell" style={{ alignItems: "flex-start" }}>
          <span className="ios-cell-lead" style={{ marginTop: 2 }}>
            <IconBadge color={CATEGORY_COLOR[tip.category] ?? "var(--ios-tint)"}>
              <Icons.SparkleIcon />
            </IconBadge>
          </span>
          <span className="ios-cell-body">
            <span
              className="ios-caption"
              style={{
                fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                color: CATEGORY_COLOR[tip.category] ?? "var(--ios-label-2)",
              }}
            >
              {CATEGORY_LABEL[tip.category] ?? tip.category}
            </span>
            <span className="ios-headline" style={{ marginTop: 2 }}>{tip.title}</span>
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.6, marginTop: 4 }}>
              {tip.body}
            </span>
          </span>
        </div>
      ) : (
        <p className="ios-footnote" style={{ color: "var(--ios-label-3)", padding: "24px 16px", textAlign: "center" }}>
          No tips yet
        </p>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "var(--ios-fill)",
  border: "none",
  color: "var(--ios-label-2)",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
