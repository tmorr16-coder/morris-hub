"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Group, Chip, Icons } from "@/components/ios";

const FOCUS_OPTIONS = [
  "Entire Bible", "Old Testament", "New Testament", "Psalms & Proverbs",
  "The Gospels", "Paul's Letters", "Prophecy", "Wisdom Literature",
  "Acts & Early Church", "Revelation", "Custom topic…",
];

const DURATION_OPTIONS = [7, 14, 21, 30, 60, 90, 180, 365];

export default function PlanGenerator({ userId }: { userId: string }) {
  const router = useRouter();
  const [focus, setFocus] = useState("New Testament");
  const [customFocus, setCustomFocus] = useState("");
  const [duration, setDuration] = useState(30);
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/bible/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focus: focus === "Custom topic…" ? customFocus : focus,
          duration,
          goal,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { planId } = await res.json();
      router.push(`/bible/plans/${planId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setGenerating(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", boxSizing: "border-box",
    background: "var(--ios-cell)", color: "var(--ios-label)",
    border: "1px solid var(--ios-separator)", borderRadius: "var(--ios-radius-card)",
    fontSize: 16, fontFamily: "inherit", outline: "none",
  };

  return (
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>
      <h1 className="ios-large-title" style={{ padding: "8px var(--ios-gutter) 2px", display: "flex", alignItems: "center", gap: 8 }}>
        <Icons.SparkleIcon style={{ width: 30, height: 30, color: "var(--ios-orange)" }} aria-hidden />
        Generate a reading plan
      </h1>
      <p className="ios-subhead" style={{ color: "var(--ios-label-2)", margin: 0, padding: "0 var(--ios-gutter) 12px" }}>
        Describe your goal and let AI craft a personalized plan.
      </p>

      {/* Focus */}
      <Group header="What would you like to study?">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12 }}>
          {FOCUS_OPTIONS.map((opt) => (
            <Chip key={opt} selected={focus === opt} onClick={() => setFocus(opt)}>
              {opt}
            </Chip>
          ))}
        </div>
        {focus === "Custom topic…" && (
          <div style={{ padding: "0 12px 12px" }}>
            <input
              value={customFocus}
              onChange={(e) => setCustomFocus(e.target.value)}
              placeholder="e.g. David's life, Faith and works, End times…"
              style={inputStyle}
            />
          </div>
        )}
      </Group>

      {/* Duration */}
      <Group header="Duration">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 12 }}>
          {DURATION_OPTIONS.map((d) => (
            <Chip key={d} selected={duration === d} onClick={() => setDuration(d)}>
              {d} days
            </Chip>
          ))}
        </div>
      </Group>

      {/* Goal */}
      <Group header="Personal goal (optional)">
        <div style={{ padding: 12 }}>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. I want to strengthen my faith, prepare for a sermon series, understand the context of the letters…"
            style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
          />
        </div>
      </Group>

      {error && (
        <div style={{ margin: "0 var(--ios-gutter)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: "var(--ios-radius-card)",
            background: "var(--ios-fill)", color: "var(--ios-red)", fontSize: 14,
          }}>
            {error}
          </div>
        </div>
      )}

      <div style={{ padding: "16px var(--ios-gutter) 0" }}>
        <button className="ios-btn ios-btn--primary" onClick={generate} disabled={generating}>
          {generating ? "Generating your plan…" : "Generate plan"}
        </button>
      </div>

      {generating && (
        <p className="ios-footnote" style={{ textAlign: "center", color: "var(--ios-label-2)", marginTop: 12 }}>
          Claude is crafting your reading plan — this takes about 10–15 seconds.
        </p>
      )}
    </div>
  );
}
