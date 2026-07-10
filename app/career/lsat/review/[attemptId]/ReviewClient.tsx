"use client";

import { useState, useRef } from "react";

interface Choice { id: string; label: string; body: string; is_correct: boolean; trap_type: string | null; }

const TRAP_LABELS: Record<string, string> = {
  out_of_scope: "Out of scope",
  too_strong: "Too strong / extreme",
  reverses_logic: "Reverses the logic",
  half_right: "Half right — misses part of the condition",
  true_but_irrelevant: "True but irrelevant",
  opposite: "Opposite of what's needed",
  premise_restatement: "Merely restates a premise",
  unsupported_comparison: "Unsupported comparison",
};

const CONFIDENCE_LABELS = ["", "Very Unsure", "Unsure", "Neutral", "Confident", "Very Confident"];

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

export default function ReviewClient({
  attempt,
  question,
  choices,
  existingReview,
}: {
  attempt: { id: string; is_correct: boolean; confidence: number; selected_choice_id: string; time_spent_s: number | null };
  question: { id: string; stem: string; lsat_question_types?: { section: string; category: string; subcategory: string | null } };
  choices: Choice[];
  existingReview: { user_note: string | null; ai_explanation: string | null; error_pattern: string | null } | null;
}) {
  const [revealed, setRevealed] = useState(!!existingReview);
  const [userNote, setUserNote] = useState(existingReview?.user_note ?? "");
  const [explanation, setExplanation] = useState(existingReview?.ai_explanation ?? "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedChoice = choices.find((c) => c.id === attempt.selected_choice_id);

  async function getExplanation() {
    setLoading(true);
    setErrorMsg(null);
    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/student-support/lsat/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id, userNote: userNote.trim() || null }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error("Failed to get explanation");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      setExplanation("");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setExplanation((p) => p + decoder.decode(value, { stream: true }));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 8, paddingBottom: 20 }}>
      {/* Attempt meta */}
      <div className="ios-footnote" style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "var(--ios-label-2)" }}>
        <span>Confidence: <strong style={{ color: "var(--ios-label)" }}>{CONFIDENCE_LABELS[attempt.confidence]}</strong></span>
        {attempt.time_spent_s != null && (
          <span>Time: <strong className="ios-num" style={{ color: "var(--ios-label)" }}>{Math.floor(attempt.time_spent_s / 60)}:{String(attempt.time_spent_s % 60).padStart(2, "0")}</strong></span>
        )}
        <span style={{ fontWeight: 700, color: attempt.is_correct ? "var(--ios-green)" : "var(--ios-red)" }}>
          {attempt.is_correct ? "Was correct" : "Was incorrect"}
        </span>
      </div>

      {/* Question stem */}
      <div className="ios-list" style={{ margin: 0, padding: "18px 18px" }}>
        <div className="ios-body" style={{ lineHeight: 1.7, color: "var(--ios-label)", whiteSpace: "pre-line" }}>
          {question.stem}
        </div>
      </div>

      {/* Choices — hidden until revealed */}
      {!revealed ? (
        <div className="ios-list" style={{ margin: 0, padding: "26px 20px", textAlign: "center" }}>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginBottom: 8 }}>
            This is a <strong>blind review</strong> — you flagged this question to re-examine without seeing the answer first.
          </div>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginBottom: 20 }}>
            Your original answer was <strong>({selectedChoice?.label})</strong>. Think through the question again before revealing.
          </div>
          <button type="button" onClick={() => setRevealed(true)} className="ios-btn ios-btn--primary">
            Reveal Answer &amp; Choices
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {choices.map((c) => {
            const isCorrect = c.is_correct;
            const wasSelected = c.id === attempt.selected_choice_id;
            const accent = isCorrect ? "var(--ios-green)" : wasSelected && !isCorrect ? "var(--ios-red)" : "var(--ios-separator)";
            const filled = isCorrect || (wasSelected && !isCorrect);
            return (
              <div key={c.id} style={{
                padding: "14px 16px", borderRadius: 12,
                border: `1.5px solid ${accent}`,
                background: isCorrect ? "color-mix(in srgb, var(--ios-green) 9%, var(--ios-cell))" : wasSelected && !isCorrect ? "color-mix(in srgb, var(--ios-red) 9%, var(--ios-cell))" : "var(--ios-cell)",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                  background: filled ? accent : "var(--ios-fill)",
                  color: filled ? "#fff" : "var(--ios-label-2)",
                }}>
                  {c.label}
                </span>
                <div style={{ flex: 1 }}>
                  <div className="ios-subhead" style={{ lineHeight: 1.5, color: "var(--ios-label)" }}>{c.body}</div>
                  {isCorrect && <div className="ios-caption" style={{ color: "var(--ios-green)", fontWeight: 600, marginTop: 4 }}>Correct answer</div>}
                  {wasSelected && !isCorrect && (
                    <div className="ios-caption" style={{ color: "var(--ios-red)", marginTop: 4 }}>
                      Your answer{c.trap_type ? ` · Trap: ${TRAP_LABELS[c.trap_type] ?? c.trap_type}` : ""}
                    </div>
                  )}
                  {!isCorrect && !wasSelected && c.trap_type && (
                    <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 4 }}>
                      Trap: {TRAP_LABELS[c.trap_type] ?? c.trap_type}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User reflection + AI explanation */}
      {revealed && (
        <div className="ios-list" style={{ margin: 0, padding: "18px 18px" }}>
          <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Your Reflection</div>
          <textarea
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            placeholder="What did you miss? What will you do differently? (optional — this gets sent to the AI tutor)"
            rows={3}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, marginBottom: 12 }}
          />

          {explanation ? (
            <div>
              <div className="ios-group-header" style={{ padding: "0 0 8px", color: "var(--ios-tint)" }}>
                AI Tutor Explanation
              </div>
              <div className="ios-subhead" style={{ lineHeight: 1.7, color: "var(--ios-label)", whiteSpace: "pre-line" }}>
                {explanation}
              </div>
              <button type="button" onClick={getExplanation} disabled={loading} className="ios-btn--plain" style={{ marginTop: 12, fontSize: 14, padding: 0 }}>
                {loading ? "Regenerating…" : "Regenerate explanation"}
              </button>
            </div>
          ) : (
            <div>
              {errorMsg && <div className="ios-footnote" style={{ color: "var(--ios-red)", marginBottom: 10 }}>{errorMsg}</div>}
              <button
                type="button"
                onClick={getExplanation}
                disabled={loading}
                className="ios-btn ios-btn--primary"
                style={{ opacity: loading ? 0.5 : 1 }}
              >
                {loading ? "Generating explanation…" : "Get AI Explanation"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
