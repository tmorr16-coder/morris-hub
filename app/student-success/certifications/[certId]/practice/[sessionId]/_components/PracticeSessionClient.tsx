"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Choice {
  id: string;
  label: string;
  body: string;
}

interface Question {
  id: string;
  stem: string;
  explanation: string | null;
  difficulty: number;
  domain_id: string | null;
  cert_domains: { id: string; name: string } | null;
}

interface AttemptRow {
  question_id: string;
  is_correct: boolean;
  selected_choice_id: string | null;
}

interface Props {
  session: {
    id: string;
    mode: string;
    domain_id: string | null;
    time_limit_s: number | null;
    started_at: string;
  };
  question: Question | null;
  choices: Choice[];
  totalQuestions: number;
  answeredCount: number;
  answeredRows: AttemptRow[];
  examName: string;
  certId: string;
}

// Split explanation into short (first sentence) and extended (the rest).
function splitExplanation(text: string | null): { short: string; extended: string } {
  if (!text) return { short: "", extended: "" };
  const idx = text.search(/\.\s+[A-Z]/);
  if (idx === -1 || idx > 160) return { short: text, extended: "" };
  return { short: text.slice(0, idx + 1), extended: text.slice(idx + 1).trim() };
}

export default function PracticeSessionClient({
  session,
  question,
  choices,
  totalQuestions,
  answeredCount,
  answeredRows,
  examName,
  certId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    isCorrect: boolean;
    correctChoiceId: string;
    correctLabel: string;
  } | null>(null);
  const [showFullExplanation, setShowFullExplanation] = useState(false);
  const [startTime] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState<number | null>(() => {
    if (!session.time_limit_s) return null;
    const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
    return Math.max(session.time_limit_s - elapsed, 0);
  });

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { endSession(); return; }
    const t = setInterval(() => setTimeLeft((p) => (p !== null && p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Pause: navigate away without ending the session so it can be resumed
  function pause() {
    router.push(`/student-success/certifications/${certId}`);
  }

  // End: marks session complete
  function endSession() {
    startTransition(async () => {
      await fetch(`/api/student-support/certifications/${certId}/sessions?id=${session.id}`, {
        method: "PATCH",
      }).catch(() => {});
      router.push(`/student-success/certifications/${certId}`);
    });
  }

  function submit() {
    if (!selectedId || submitted || !question) return;
    const timeSpentS = Math.floor((Date.now() - startTime) / 1000);

    startTransition(async () => {
      const res = await fetch("/api/student-support/cert-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          questionId: question.id,
          selectedChoiceId: selectedId,
          timeSpentS,
        }),
      });
      const data = await res.json();
      if (!res.ok) { console.error("[cert-attempts]", data.error); return; }
      const correctChoice = choices.find((c) => c.id === data.correctChoiceId);
      setResult({
        isCorrect: data.isCorrect,
        correctChoiceId: data.correctChoiceId,
        correctLabel: correctChoice?.label ?? "?",
      });
      setSubmitted(true);
      setShowFullExplanation(false);
    });
  }

  function next() {
    setSelectedId(null);
    setSubmitted(false);
    setResult(null);
    setShowFullExplanation(false);
    startTransition(() => { router.refresh(); });
  }

  const modeLabel: Record<string, string> = { practice: "Practice", timed_mock: "Timed Mock", domain_drill: "Domain Drill" };
  const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // ── Completion screen ──────────────────────────────────────────────────────
  if (!question) {
    const correct = answeredRows.filter((a) => a.is_correct).length;
    const total = answeredRows.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    return (
      <div style={{ textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>
          {pct >= 80 ? "🎉" : pct >= 60 ? "📚" : "💪"}
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, marginBottom: 8 }}>
          Session Complete!
        </h1>
        <div style={{ fontSize: 42, fontWeight: 700, color: pct >= 80 ? "var(--color-green)" : pct >= 60 ? "var(--color-amber)" : "var(--color-red)", marginBottom: 4 }}>
          {pct}%
        </div>
        <div style={{ fontSize: 16, color: "var(--color-ink-2)", marginBottom: 32 }}>
          {correct} / {total} correct
        </div>
        <div style={{ maxWidth: 320, margin: "0 auto 40px", background: "var(--color-rule)", borderRadius: 8, height: 10, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct >= 80 ? "var(--color-green)" : pct >= 60 ? "var(--color-amber)" : "var(--color-red)", borderRadius: 8, transition: "width 600ms ease" }} />
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href={`/student-success/certifications/${certId}/practice`} style={{ padding: "10px 22px", borderRadius: 8, border: "1px solid var(--color-rule)", textDecoration: "none", fontSize: 14, color: "var(--color-ink-2)", background: "var(--color-bg-raised)" }}>
            New Session
          </Link>
          <Link href={`/student-success/certifications/${certId}`} style={{ padding: "10px 22px", borderRadius: 8, background: "var(--color-accent)", textDecoration: "none", fontSize: 14, fontWeight: 600, color: "#fff" }}>
            Back to {examName}
          </Link>
        </div>
      </div>
    );
  }

  // ── Active question screen ─────────────────────────────────────────────────
  const domainName = question.cert_domains?.name ?? null;
  const { short: shortExp, extended: extendedExp } = splitExplanation(question.explanation);

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={pause}
            style={{ fontSize: 12, color: "var(--color-ink-3)", background: "none", border: "1px solid var(--color-line)", borderRadius: 6, cursor: "pointer", padding: "4px 10px" }}
          >
            ⏸ Pause
          </button>
          <span style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
            {modeLabel[session.mode] ?? session.mode} · Q{answeredCount + 1} of {totalQuestions}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {timeLeft !== null && (
            <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: timeLeft < 120 ? "var(--color-red)" : "var(--color-ink-2)" }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          )}
          <button
            onClick={endSession}
            disabled={isPending}
            style={{ fontSize: 11, color: "var(--color-ink-4)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            End session
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--color-rule)", borderRadius: 4, marginBottom: 24, overflow: "hidden" }}>
        <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--color-accent)", borderRadius: 4, transition: "width 300ms ease" }} />
      </div>

      {/* Domain badge */}
      {domainName && (
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-accent)", background: "var(--color-accent-soft)", padding: "3px 10px", borderRadius: 10 }}>
            {domainName}
          </span>
        </div>
      )}

      {/* Question stem */}
      <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 14, padding: "24px 28px", marginBottom: 20, boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontSize: 16, lineHeight: 1.7, color: "var(--color-ink)", whiteSpace: "pre-line" }}>
          {question.stem}
        </div>
      </div>

      {/* Answer choices */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {choices.map((c) => {
          const isSelected = selectedId === c.id;
          const isCorrect = submitted && result?.correctChoiceId === c.id;
          const isWrong   = submitted && isSelected && !result?.isCorrect;

          return (
            <button
              key={c.id}
              onClick={() => !submitted && setSelectedId(c.id)}
              style={{
                padding: "14px 18px", borderRadius: 10, textAlign: "left",
                cursor: submitted ? "default" : "pointer",
                border: `2px solid ${isCorrect ? "var(--color-green)" : isWrong ? "var(--color-red)" : isSelected ? "var(--color-accent)" : "var(--color-line)"}`,
                background: isCorrect ? "rgba(74,107,58,0.08)" : isWrong ? "rgba(154,59,42,0.08)" : isSelected ? "var(--color-accent-soft)" : "var(--color-bg-raised)",
                display: "flex", gap: 12, alignItems: "flex-start",
                transition: "border-color 120ms, background 120ms",
              }}
            >
              <span style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, border: `2px solid ${isCorrect ? "var(--color-green)" : isWrong ? "var(--color-red)" : isSelected ? "var(--color-accent)" : "var(--color-rule)"}`, background: isCorrect ? "var(--color-green)" : isWrong ? "var(--color-red)" : isSelected ? "var(--color-accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: isCorrect || isWrong || isSelected ? "#fff" : "var(--color-ink-3)" }}>
                {c.label}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-ink)", paddingTop: 3 }}>
                {c.body}
              </span>
              {isCorrect && <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 18, paddingTop: 2, color: "var(--color-green)" }}>✓</span>}
              {isWrong   && <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 18, paddingTop: 2, color: "var(--color-red)" }}>✗</span>}
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      {!submitted && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={submit}
            disabled={!selectedId || isPending}
            style={{ padding: "11px 28px", borderRadius: 8, border: "none", background: selectedId ? "var(--color-accent)" : "var(--color-rule)", color: selectedId ? "#fff" : "var(--color-ink-4)", fontWeight: 600, fontSize: 14, cursor: selectedId && !isPending ? "pointer" : "default", fontFamily: "inherit" }}
          >
            {isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      )}

      {/* Post-submit feedback */}
      {submitted && result && (
        <div style={{ background: result.isCorrect ? "rgba(74,107,58,0.06)" : "rgba(154,59,42,0.06)", border: `1px solid ${result.isCorrect ? "var(--color-green)" : "var(--color-red)"}`, borderRadius: 12, padding: "18px 20px" }}>

          {/* Short affirming line */}
          <div style={{ fontSize: 16, fontWeight: 700, color: result.isCorrect ? "var(--color-green)" : "var(--color-red)", marginBottom: result.isCorrect ? 4 : 6 }}>
            {result.isCorrect ? "✓ Correct!" : `✗ Not quite — the correct answer was ${result.correctLabel}`}
          </div>

          {/* Short explanation (first sentence) */}
          {shortExp && (
            <div style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.6, marginBottom: extendedExp ? 6 : 16 }}>
              {shortExp}
            </div>
          )}

          {/* Expand toggle for longer explanation */}
          {extendedExp && (
            <>
              <button
                onClick={() => setShowFullExplanation((v) => !v)}
                style={{ fontSize: 12, color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showFullExplanation ? 8 : 16, fontFamily: "inherit", textDecoration: "underline" }}
              >
                {showFullExplanation ? "Hide full explanation ↑" : "See full explanation ↓"}
              </button>
              {showFullExplanation && (
                <div style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.6, marginBottom: 16, paddingTop: 4, borderTop: "1px solid var(--color-line)", paddingLeft: 12, borderLeft: `3px solid ${result.isCorrect ? "var(--color-green)" : "var(--color-red)"}` }}>
                  {extendedExp}
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={next}
              disabled={isPending}
              style={{ padding: "9px 24px", borderRadius: 8, background: "var(--color-accent)", color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: isPending ? "default" : "pointer", fontFamily: "inherit" }}
            >
              {isPending ? "Loading…" : "Next →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
