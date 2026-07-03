"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chip, IconBadge, Icons } from "@/components/ios";

interface QuestionType {
  id: string;
  section: string;
  category: string;
  subcategory: string | null;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 16,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  colorScheme: "light dark",
};

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
  const canGenerate = !!selectedTypeId && !loading;

  return (
    <>
      <button
        type="button"
        className="ios-btn ios-btn--primary"
        onClick={() => { setOpen(!open); setResult(null); setError(null); }}
      >
        <Icons.SparkleIcon style={{ width: 18, height: 18 }} aria-hidden="true" />
        Generate Questions
      </button>

      {open && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Generate LSAT questions">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setOpen(false)} disabled={loading}>Cancel</button>
              <span className="ios-headline">Generate Questions</span>
              <span style={{ width: 52 }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 16px" }}>
              <IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>
              <div>
                <div className="ios-headline">AI Question Generator</div>
                <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Realistic LSAT-style questions with trap tags</div>
              </div>
            </div>

            <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: "0 0 4px", lineHeight: 1.5 }}>
              Morris generates realistic LSAT-style questions, tags trap types on each wrong answer, and stores them in the database. Questions are marked{" "}
              <span className="ios-num" style={{ background: "var(--ios-fill)", padding: "1px 6px", borderRadius: 5, fontSize: 12 }}>AI-generated</span>{" "}
              — distinct from any official PrepTest questions you add manually.
            </p>

            {/* Question type picker */}
            <div className="ios-group-header" style={{ padding: "16px 0 8px" }}>Question Type</div>
            <select value={selectedTypeId} onChange={(e) => setSelectedTypeId(e.target.value)} style={inputStyle}>
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

            {/* Count picker */}
            <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>How many?</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[3, 5, 10].map((n) => (
                <Chip key={n} small selected={count === n} onClick={() => setCount(n)}>{n}</Chip>
              ))}
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 8 }}>
              Each question takes ~3–5 seconds. Generating {count} will take ~{count * 4}s.
            </div>

            {error && (
              <p className="ios-footnote" style={{ color: "var(--ios-red)", padding: "14px 0 0" }}>{error}</p>
            )}
            {result && (
              <p className="ios-footnote" style={{ color: "var(--ios-green)", padding: "14px 0 0" }}>
                Generated {result.generated} question{result.generated !== 1 ? "s" : ""} — they&apos;re now available in your practice sessions.
              </p>
            )}

            <button
              type="button"
              className="ios-btn ios-btn--primary"
              style={{ marginTop: 22, opacity: canGenerate ? 1 : 0.5 }}
              onClick={generate}
              disabled={!canGenerate}
            >
              {loading ? `Generating ${count} questions… (may take ~${count * 7}s)` : `Generate ${count} Questions`}
            </button>
          </div>
        </>
      )}
    </>
  );
}
