"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      router.push(`/plans/${planId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setGenerating(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontFamily: "var(--font-instrument-serif, serif)", fontSize: 28, fontWeight: 400, margin: "0 0 8px" }}>
        ✨ Generate a reading plan
      </h1>
      <p style={{ color: "var(--color-ink-3)", fontSize: 14, marginBottom: 32 }}>
        Describe your goal and let AI craft a personalized plan.
      </p>

      {/* Focus */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", display: "block", marginBottom: 8 }}>
          What would you like to study?
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FOCUS_OPTIONS.map((opt) => (
            <button key={opt} onClick={() => setFocus(opt)}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 13,
                border: `1px solid ${focus === opt ? "var(--color-accent)" : "var(--color-rule)"}`,
                background: focus === opt ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                color: focus === opt ? "var(--color-accent)" : "var(--color-ink-2)",
                cursor: "pointer", fontWeight: focus === opt ? 600 : 400,
              }}>
              {opt}
            </button>
          ))}
        </div>
        {focus === "Custom topic…" && (
          <input
            value={customFocus}
            onChange={(e) => setCustomFocus(e.target.value)}
            placeholder="e.g. David's life, Faith and works, End times…"
            style={{ marginTop: 10, width: "100%", padding: "10px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
          />
        )}
      </div>

      {/* Duration */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", display: "block", marginBottom: 8 }}>
          Duration
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {DURATION_OPTIONS.map((d) => (
            <button key={d} onClick={() => setDuration(d)}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 13,
                border: `1px solid ${duration === d ? "var(--color-accent)" : "var(--color-rule)"}`,
                background: duration === d ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                color: duration === d ? "var(--color-accent)" : "var(--color-ink-2)",
                cursor: "pointer", fontWeight: duration === d ? 600 : 400,
              }}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Goal */}
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", display: "block", marginBottom: 8 }}>
          Personal goal (optional)
        </label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. I want to strengthen my faith, prepare for a sermon series, understand the context of the letters…"
          style={{
            width: "100%", minHeight: 80, padding: "10px 12px",
            border: "1px solid var(--color-rule)", borderRadius: 8,
            fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
          }}
        />
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(154,59,42,0.08)", border: "1px solid var(--color-red)", borderRadius: 8, fontSize: 13, color: "var(--color-red)", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <button onClick={generate} disabled={generating}
        style={{
          width: "100%", padding: "14px", background: generating ? "#ccc" : "var(--color-accent)",
          color: "#fff", border: "none", borderRadius: 10, fontSize: 15,
          fontWeight: 600, cursor: generating ? "not-allowed" : "pointer", fontFamily: "inherit",
        }}>
        {generating ? "Generating your plan…" : "Generate plan"}
      </button>

      {generating && (
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-ink-3)", marginTop: 16 }}>
          Claude is crafting your reading plan — this takes about 10–15 seconds.
        </p>
      )}
    </div>
  );
}
