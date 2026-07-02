"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Choice { id: string; label: string; body: string; }
interface Question {
  id: string; stem: string; difficulty: number; type_id: string;
  lsat_question_types?: { section: string; category: string; subcategory: string | null };
}

const CONFIDENCE_LABELS = ["", "Very Unsure", "Unsure", "Neutral", "Confident", "Very Confident"];
const CONFIDENCE_COLORS = ["", "var(--color-red)", "var(--color-amber)", "var(--color-ink-3)", "var(--color-green)", "var(--color-green)"];

export default function SessionClient({
  session,
  nextQuestion,
  nextChoices,
  totalAnswered,
  answeredRows,
}: {
  session: { id: string; mode: string; section: string | null; is_timed: boolean; time_limit_s: number | null; started_at: string };
  nextQuestion: Question | null;
  nextChoices: Choice[];
  totalAnswered: number;
  answeredRows: { question_id: string; is_correct: boolean; flagged: boolean }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(3);
  const [flagged, setFlagged] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; correctId: string; attemptId: string } | null>(null);
  const [startTime] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState<number | null>(
    session.is_timed && session.time_limit_s
      ? session.time_limit_s - Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
      : null
  );

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { endSession(); return; }
    const t = setInterval(() => setTimeLeft((p) => (p !== null && p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  function endSession() {
    startTransition(async () => {
      await fetch(`/api/student-support/lsat/sessions?id=${session.id}`, { method: "PATCH" });
      router.push("/career/lsat");
    });
  }

  function submit() {
    if (!selectedId || submitted) return;
    const timeSpentS = Math.floor((Date.now() - startTime) / 1000);

    startTransition(async () => {
      const res = await fetch("/api/student-support/lsat/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          questionId: nextQuestion?.id,
          selectedChoiceId: selectedId,
          confidence,
          flagged,
          timeSpentS,
        }),
      });
      const data = await res.json();
      setResult({ isCorrect: data.isCorrect, correctId: data.correctChoiceId, attemptId: data.attemptId });
      setSubmitted(true);
    });
  }

  function next() {
    router.refresh();
    setSelectedId(null);
    setConfidence(3);
    setFlagged(false);
    setSubmitted(false);
    setResult(null);
  }

  const sessionComplete = !nextQuestion;
  const modeLabel = { drill: "Drill", timed_section: "Timed", blind_review: "Blind Review" }[session.mode] ?? session.mode;

  if (sessionComplete) {
    const correct = answeredRows.filter((a) => a.is_correct).length;
    const total = answeredRows.length;
    return (
      <div style={{ textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, marginBottom: 8 }}>
          Session Complete
        </h1>
        <div style={{ fontSize: 16, color: "var(--color-ink-2)", marginBottom: 4 }}>
          {correct} / {total} correct — {total > 0 ? Math.round(correct / total * 100) : 0}%
        </div>
        {answeredRows.filter((a) => a.flagged).length > 0 && (
          <div style={{ fontSize: 14, color: "var(--color-amber)", marginBottom: 24 }}>
            🚩 {answeredRows.filter((a) => a.flagged).length} questions flagged for blind review
          </div>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
          <Link href="/career/lsat/review" style={{
            padding: "10px 22px", borderRadius: 8, border: "1px solid var(--color-rule)",
            textDecoration: "none", fontSize: 14, color: "var(--color-ink-2)",
          }}>
            Review Flagged
          </Link>
          <Link href="/career/lsat" style={{
            padding: "10px 22px", borderRadius: 8, background: "var(--color-accent)",
            textDecoration: "none", fontSize: 14, fontWeight: 600, color: "#fff",
          }}>
            Back to LSAT Prep
          </Link>
        </div>
      </div>
    );
  }

  const qtype = nextQuestion?.lsat_question_types;

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/career/lsat" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>← Exit</Link>
          <span style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
            {modeLabel}{session.section ? ` · ${session.section}` : ""} · Q{totalAnswered + 1}
          </span>
          {qtype && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-accent-soft)", padding: "2px 8px", borderRadius: 10 }}>
              {qtype.category}{qtype.subcategory ? ` (${qtype.subcategory})` : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {timeLeft !== null && (
            <span style={{
              fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)",
              color: timeLeft < 300 ? "var(--color-red)" : "var(--color-ink-2)",
            }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          )}
          <button onClick={endSession} disabled={isPending} style={{
            padding: "5px 12px", borderRadius: 6, border: "1px solid var(--color-rule)",
            background: "transparent", fontSize: 12, cursor: "pointer", color: "var(--color-ink-3)",
          }}>
            End Session
          </button>
        </div>
      </div>

      {/* Question stem */}
      <div style={{
        background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
        borderRadius: 14, padding: "24px 28px", marginBottom: 20, boxShadow: "var(--shadow-card)",
      }}>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-ink)", whiteSpace: "pre-line" }}>
          {nextQuestion?.stem}
        </div>
        {session.mode === "blind_review" && (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--color-amber)", fontWeight: 500 }}>
            🚩 This was flagged during a previous session — choose what you believe is correct before revealing the answer.
          </div>
        )}
      </div>

      {/* Answer choices */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {nextChoices.map((c) => {
          const isSelected = selectedId === c.id;
          const isCorrect = submitted && result?.correctId === c.id;
          const isWrong = submitted && isSelected && !result?.isCorrect;

          return (
            <button
              key={c.id}
              onClick={() => !submitted && setSelectedId(c.id)}
              style={{
                padding: "14px 18px", borderRadius: 10, textAlign: "left", cursor: submitted ? "default" : "pointer",
                border: `2px solid ${isCorrect ? "var(--color-green)" : isWrong ? "var(--color-red)" : isSelected ? "var(--color-accent)" : "var(--color-rule)"}`,
                background: isCorrect ? "rgba(74,107,58,0.08)" : isWrong ? "rgba(154,59,42,0.08)" : isSelected ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                display: "flex", gap: 12, alignItems: "flex-start",
                transition: "border-color 120ms, background 120ms",
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                border: `2px solid ${isCorrect ? "var(--color-green)" : isWrong ? "var(--color-red)" : isSelected ? "var(--color-accent)" : "var(--color-rule)"}`,
                background: isCorrect ? "var(--color-green)" : isWrong ? "var(--color-red)" : isSelected ? "var(--color-accent)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                color: isCorrect || isWrong || isSelected ? "#fff" : "var(--color-ink-3)",
              }}>
                {c.label}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-ink)", paddingTop: 3 }}>
                {c.body}
              </span>
              {isCorrect && <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 18, paddingTop: 2 }}>✓</span>}
              {isWrong && <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 18, paddingTop: 2 }}>✗</span>}
            </button>
          );
        })}
      </div>

      {/* Pre-submit controls */}
      {!submitted && (
        <div style={{
          background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
          borderRadius: 12, padding: "18px 20px", marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            {/* Confidence */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", marginBottom: 8 }}>
                Confidence
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setConfidence(n)} style={{
                    width: 36, height: 36, borderRadius: "50%", border: `2px solid ${confidence === n ? CONFIDENCE_COLORS[n] : "var(--color-rule)"}`,
                    background: confidence === n ? CONFIDENCE_COLORS[n] : "transparent",
                    color: confidence === n ? "#fff" : "var(--color-ink-3)",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}>{n}</button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: CONFIDENCE_COLORS[confidence], marginTop: 4, fontWeight: 500 }}>
                {CONFIDENCE_LABELS[confidence]}
              </div>
            </div>

            {/* Flag + Submit */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                onClick={() => setFlagged(!flagged)}
                style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 13,
                  border: `1px solid ${flagged ? "var(--color-amber)" : "var(--color-rule)"}`,
                  background: flagged ? "rgba(184,138,46,0.1)" : "transparent",
                  color: flagged ? "var(--color-amber)" : "var(--color-ink-3)",
                  cursor: "pointer", fontWeight: flagged ? 600 : 400,
                }}
              >
                {flagged ? "🚩 Flagged" : "🏳 Flag"}
              </button>
              <button
                onClick={submit}
                disabled={!selectedId || isPending}
                style={{
                  padding: "10px 24px", borderRadius: 8, border: "none",
                  background: selectedId ? "var(--color-accent)" : "var(--color-rule)",
                  color: selectedId ? "#fff" : "var(--color-ink-4)",
                  fontWeight: 600, fontSize: 14, cursor: selectedId ? "pointer" : "default",
                  fontFamily: "inherit",
                }}
              >
                {isPending ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-submit */}
      {submitted && result && (
        <div style={{
          background: result.isCorrect ? "rgba(74,107,58,0.06)" : "rgba(154,59,42,0.06)",
          border: `1px solid ${result.isCorrect ? "var(--color-green)" : "var(--color-red)"}`,
          borderRadius: 12, padding: "18px 20px", marginBottom: 16,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: result.isCorrect ? "var(--color-green)" : "var(--color-red)" }}>
                {result.isCorrect ? "✓ Correct" : "✗ Incorrect"}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 4 }}>
                Confidence: {CONFIDENCE_LABELS[confidence]} · {flagged ? "Flagged for review" : "Not flagged"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {result?.attemptId && (
                <Link href={`/career/lsat/review/${result.attemptId}`}
                  style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none", padding: "8px 14px", borderRadius: 8, border: "1px solid var(--color-rule)" }}>
                  Explain →
                </Link>
              )}
              <button onClick={next} style={{
                padding: "8px 20px", borderRadius: 8, background: "var(--color-accent)",
                color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer",
              }}>
                Next Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
