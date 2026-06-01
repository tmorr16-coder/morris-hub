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

  const qtype = question.lsat_question_types;
  const correctChoice = choices.find((c) => c.is_correct);
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
    <div>
      {/* Header */}
      <div style={{ marginTop: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
          {qtype?.section} · {qtype?.category}{qtype?.subcategory ? ` (${qtype.subcategory})` : ""}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--color-ink-3)" }}>
          <span>Confidence: <strong style={{ color: "var(--color-ink)" }}>{CONFIDENCE_LABELS[attempt.confidence]}</strong></span>
          {attempt.time_spent_s && <span>Time: <strong style={{ color: "var(--color-ink)" }}>{Math.floor(attempt.time_spent_s / 60)}:{String(attempt.time_spent_s % 60).padStart(2, "0")}</strong></span>}
          <span style={{ fontWeight: 700, color: attempt.is_correct ? "var(--color-green)" : "var(--color-red)" }}>
            {attempt.is_correct ? "✓ Was correct" : "✗ Was incorrect"}
          </span>
        </div>
      </div>

      {/* Question stem */}
      <div style={{
        background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
        borderRadius: 14, padding: "22px 24px", marginBottom: 20, boxShadow: "var(--shadow-card)",
      }}>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-ink)", whiteSpace: "pre-line" }}>
          {question.stem}
        </div>
      </div>

      {/* Choices — hidden until revealed */}
      {!revealed ? (
        <div style={{ textAlign: "center", padding: "32px", background: "var(--color-bg-deep)", borderRadius: 14, border: "2px dashed var(--color-rule)", marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 8 }}>
            This is a <strong>blind review</strong> — you flagged this question to re-examine without seeing the answer first.
          </div>
          <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 20 }}>
            Your original answer was <strong>({selectedChoice?.label})</strong>. Think through the question again before revealing.
          </div>
          <button onClick={() => setRevealed(true)} style={{
            padding: "10px 24px", borderRadius: 8, background: "var(--color-accent)",
            color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>
            Reveal Answer &amp; Choices
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {choices.map((c) => {
            const isCorrect = c.is_correct;
            const wasSelected = c.id === attempt.selected_choice_id;
            return (
              <div key={c.id} style={{
                padding: "14px 18px", borderRadius: 10,
                border: `2px solid ${isCorrect ? "var(--color-green)" : wasSelected && !isCorrect ? "var(--color-red)" : "var(--color-rule)"}`,
                background: isCorrect ? "rgba(74,107,58,0.06)" : wasSelected && !isCorrect ? "rgba(154,59,42,0.06)" : "var(--color-bg-card)",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  background: isCorrect ? "var(--color-green)" : wasSelected && !isCorrect ? "var(--color-red)" : "var(--color-bg-deep)",
                  color: (isCorrect || (wasSelected && !isCorrect)) ? "#fff" : "var(--color-ink-3)",
                }}>
                  {c.label}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-ink)" }}>{c.body}</div>
                  {isCorrect && <div style={{ fontSize: 11, color: "var(--color-green)", fontWeight: 600, marginTop: 4 }}>✓ Correct answer</div>}
                  {wasSelected && !isCorrect && (
                    <div style={{ fontSize: 11, color: "var(--color-red)", marginTop: 4 }}>
                      ✗ Your answer{c.trap_type ? ` · Trap: ${TRAP_LABELS[c.trap_type] ?? c.trap_type}` : ""}
                    </div>
                  )}
                  {!isCorrect && !wasSelected && c.trap_type && (
                    <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 4 }}>
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
        <div style={{
          background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
          borderRadius: 14, padding: "22px 24px", boxShadow: "var(--shadow-card)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 12 }}>
            Your Reflection
          </div>
          <textarea
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            placeholder="What did you miss? What will you do differently? (optional — this gets sent to the AI tutor)"
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 8,
              border: "1px solid var(--color-rule)", fontSize: 13, fontFamily: "inherit",
              resize: "vertical", boxSizing: "border-box", marginBottom: 12,
              background: "var(--color-bg)",
            }}
          />

          {explanation ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-accent)", marginBottom: 10 }}>
                AI Tutor Explanation
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--color-ink)", whiteSpace: "pre-line" }}>
                {explanation}
              </div>
              <button onClick={getExplanation} disabled={loading} style={{
                marginTop: 12, fontSize: 12, color: "var(--color-accent)", background: "none",
                border: "none", cursor: "pointer", textDecoration: "underline",
              }}>
                {loading ? "Regenerating…" : "Regenerate explanation"}
              </button>
            </div>
          ) : (
            <div>
              {errorMsg && <div style={{ fontSize: 13, color: "var(--color-red)", marginBottom: 10 }}>{errorMsg}</div>}
              <button onClick={getExplanation} disabled={loading} style={{
                padding: "10px 22px", borderRadius: 8, background: loading ? "var(--color-rule)" : "var(--color-accent)",
                color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: loading ? "default" : "pointer",
                fontFamily: "inherit",
              }}>
                {loading ? "Generating explanation…" : "Get AI Explanation →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
