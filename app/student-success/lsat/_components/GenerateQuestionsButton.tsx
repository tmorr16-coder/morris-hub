"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QuestionType {
  id: string;
  section: string;
  category: string;
  subcategory: string | null;
}

export default function GenerateQuestionsButton({ questionTypes }: { questionTypes: QuestionType[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ generated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!selectedTypeId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/student-support/lsat/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeId: selectedTypeId, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  const lrTypes = questionTypes.filter((t) => t.section === "LR");
  const rcTypes = questionTypes.filter((t) => t.section === "RC");

  return (
    <div>
      <button
        onClick={() => { setOpen(!open); setResult(null); setError(null); }}
        style={{
          padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
          border: "1px solid var(--color-rule)", background: open ? "var(--color-accent-soft)" : "var(--color-bg-card)",
          color: open ? "var(--color-accent)" : "var(--color-ink-2)", cursor: "pointer",
        }}
      >
        ✨ Generate Questions
      </button>

      {open && (
        <div style={{
          marginTop: 12, padding: "20px 22px",
          background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
          borderRadius: 14, boxShadow: "var(--shadow-card)",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>
            AI Question Generator
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 16, lineHeight: 1.5 }}>
            Claude Opus writes realistic LSAT-style questions, tags trap types on each wrong answer, and stores them in the database. Questions are marked <code style={{ fontSize: 10, background: "var(--color-bg-deep)", padding: "1px 5px", borderRadius: 4 }}>AI-generated</code> — distinct from any official PrepTest questions you add manually.
          </div>

          {/* Question type picker */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", marginBottom: 8 }}>
              Question Type
            </div>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                border: "1px solid var(--color-rule)", fontSize: 13,
                background: "var(--color-bg)", color: "var(--color-ink)", fontFamily: "inherit",
              }}
            >
              <option value="">Select a question type…</option>
              <optgroup label="Logical Reasoning (LR)">
                {lrTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.category}{t.subcategory ? ` (${t.subcategory})` : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Reading Comprehension (RC)">
                {rcTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.category}{t.subcategory ? ` (${t.subcategory})` : ""}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Count picker */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", marginBottom: 8 }}>
              How many?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[3, 5, 10].map((n) => (
                <button key={n} onClick={() => setCount(n)} style={{
                  padding: "6px 16px", borderRadius: 7, fontSize: 13,
                  border: `1px solid ${count === n ? "var(--color-accent)" : "var(--color-rule)"}`,
                  background: count === n ? "var(--color-accent-soft)" : "transparent",
                  color: count === n ? "var(--color-accent)" : "var(--color-ink-2)",
                  cursor: "pointer", fontWeight: count === n ? 600 : 400,
                }}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 6 }}>
              Each question takes ~5–10 seconds. Generating {count} will take ~{count * 7}s.
            </div>
          </div>

          {error && (
            <div style={{ padding: "8px 12px", background: "rgba(154,59,42,0.08)", border: "1px solid var(--color-red)", borderRadius: 8, fontSize: 12, color: "var(--color-red)", marginBottom: 12 }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ padding: "8px 12px", background: "rgba(74,107,58,0.08)", border: "1px solid var(--color-green)", borderRadius: 8, fontSize: 12, color: "var(--color-green)", marginBottom: 12 }}>
              ✓ Generated {result.generated} question{result.generated !== 1 ? "s" : ""} — they&apos;re now available in your practice sessions.
            </div>
          )}

          <button
            onClick={generate}
            disabled={!selectedTypeId || loading}
            style={{
              width: "100%", padding: "11px", borderRadius: 8, border: "none",
              background: selectedTypeId && !loading ? "var(--color-accent)" : "var(--color-rule)",
              color: selectedTypeId && !loading ? "#fff" : "var(--color-ink-4)",
              fontSize: 14, fontWeight: 600, cursor: selectedTypeId && !loading ? "pointer" : "default",
              fontFamily: "inherit",
            }}
          >
            {loading ? `Generating ${count} questions with Claude Opus… (may take ~${count * 7}s)` : `Generate ${count} Questions`}
          </button>
        </div>
      )}
    </div>
  );
}
