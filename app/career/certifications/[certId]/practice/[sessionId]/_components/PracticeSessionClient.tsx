"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RadialGauge, Chip } from "@/components/ios";

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

// Small inline glyphs (no emoji).
function CheckGlyph({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XGlyph({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
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
    router.push(`/career/certifications/${certId}`);
  }

  // End: marks session complete
  function endSession() {
    startTransition(async () => {
      await fetch(`/api/student-support/certifications/${certId}/sessions?id=${session.id}`, {
        method: "PATCH",
      }).catch(() => {});
      router.push(`/career/certifications/${certId}`);
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
    const accent = pct >= 80 ? "#2E7D46" : pct >= 60 ? "#E08600" : "#C0392B";

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingTop: 32 }}>
        <RadialGauge
          value={pct / 100}
          color={accent}
          size={148}
          center={
            <span className="ios-title-1 ios-num" style={{ color: "var(--ios-label)", fontWeight: 700 }}>
              {pct}%
            </span>
          }
        />
        <h1 className="ios-title-2" style={{ color: "var(--ios-label)", marginTop: 24 }}>
          Session Complete
        </h1>
        <div className="ios-body ios-num" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
          {correct} / {total} correct
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 32, width: "100%", maxWidth: 340 }}>
          <Link
            href={`/career/certifications/${certId}`}
            className="ios-btn ios-btn--primary"
            style={{ textDecoration: "none" }}
          >
            Back to {examName}
          </Link>
          <Link
            href={`/career/certifications/${certId}/practice`}
            className="ios-btn ios-btn--full"
            style={{ textDecoration: "none", background: "var(--ios-fill)", color: "var(--ios-tint)" }}
          >
            New Session
          </Link>
        </div>
      </div>
    );
  }

  // ── Active question screen ─────────────────────────────────────────────────
  const domainName = question.cert_domains?.name ?? null;
  const { short: shortExp, extended: extendedExp } = splitExplanation(question.explanation);
  const resultAccent = result?.isCorrect ? "var(--ios-green)" : "var(--ios-red)";

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={pause}
            className="ios-subhead"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ios-tint)", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
            Pause
          </button>
          <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
            {modeLabel[session.mode] ?? session.mode} · Q{answeredCount + 1} of {totalQuestions}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {timeLeft !== null && (
            <span className="ios-headline ios-num" style={{ color: timeLeft < 120 ? "var(--ios-red)" : "var(--ios-label)" }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          )}
          <button
            type="button"
            onClick={endSession}
            disabled={isPending}
            className="ios-footnote"
            style={{ color: "var(--ios-label-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            End session
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: "var(--ios-fill)", borderRadius: 999, marginBottom: 22, overflow: "hidden" }}>
        <div style={{ width: `${progressPct}%`, height: "100%", background: "var(--ios-tint)", borderRadius: 999, transition: "width 300ms ease" }} />
      </div>

      {/* Domain badge */}
      {domainName && (
        <div style={{ marginBottom: 14 }}>
          <Chip small selected>{domainName}</Chip>
        </div>
      )}

      {/* Question stem */}
      <div className="ios-list" style={{ margin: "0 0 18px", padding: "20px 18px" }}>
        <div className="ios-body" style={{ color: "var(--ios-label)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
          {question.stem}
        </div>
      </div>

      {/* Answer choices */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
        {choices.map((c) => {
          const isSelected = selectedId === c.id;
          const isCorrect = submitted && result?.correctChoiceId === c.id;
          const isWrong   = submitted && isSelected && !result?.isCorrect;
          const active = isCorrect || isWrong || isSelected;
          const accent = isCorrect ? "var(--ios-green)" : isWrong ? "var(--ios-red)" : isSelected ? "var(--ios-tint)" : "var(--ios-separator)";

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => !submitted && setSelectedId(c.id)}
              style={{
                padding: "14px 16px", borderRadius: 14, textAlign: "left",
                cursor: submitted ? "default" : "pointer",
                border: `1.5px solid ${accent}`,
                background: active ? "var(--ios-fill)" : "var(--ios-cell)",
                display: "flex", gap: 12, alignItems: "flex-start",
                transition: "border-color 120ms, background 120ms",
                fontFamily: "inherit",
              }}
            >
              <span
                className="ios-num"
                style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  border: `1.5px solid ${isCorrect ? "var(--ios-green)" : isWrong ? "var(--ios-red)" : isSelected ? "var(--ios-tint)" : "var(--ios-separator)"}`,
                  background: isCorrect ? "var(--ios-green)" : isWrong ? "var(--ios-red)" : isSelected ? "var(--ios-tint)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 600,
                  color: active ? "var(--ios-on-tint)" : "var(--ios-label-2)",
                }}
              >
                {c.label}
              </span>
              <span className="ios-callout" style={{ color: "var(--ios-label)", lineHeight: 1.5, paddingTop: 3 }}>
                {c.body}
              </span>
              {isCorrect && <span style={{ marginLeft: "auto", flexShrink: 0, paddingTop: 3 }}><CheckGlyph color="var(--ios-green)" /></span>}
              {isWrong   && <span style={{ marginLeft: "auto", flexShrink: 0, paddingTop: 3 }}><XGlyph color="var(--ios-red)" /></span>}
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      {!submitted && (
        <button
          type="button"
          onClick={submit}
          disabled={!selectedId || isPending}
          className="ios-btn ios-btn--primary"
          style={{ opacity: !selectedId || isPending ? 0.4 : 1 }}
        >
          {isPending ? "Submitting…" : "Submit"}
        </button>
      )}

      {/* Post-submit feedback */}
      {submitted && result && (
        <div
          style={{
            background: "var(--ios-fill)",
            border: `var(--ios-hair) solid ${resultAccent}`,
            borderRadius: 14,
            padding: "16px 18px",
          }}
        >
          {/* Short affirming line */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: shortExp ? 8 : 16 }}>
            {result.isCorrect ? <CheckGlyph color="var(--ios-green)" /> : <XGlyph color="var(--ios-red)" />}
            <span className="ios-headline" style={{ color: resultAccent }}>
              {result.isCorrect ? "Correct!" : `Not quite — the correct answer was ${result.correctLabel}`}
            </span>
          </div>

          {/* Short explanation (first sentence) */}
          {shortExp && (
            <div className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.6, marginBottom: extendedExp ? 8 : 16 }}>
              {shortExp}
            </div>
          )}

          {/* Expand toggle for longer explanation */}
          {extendedExp && (
            <>
              <button
                type="button"
                onClick={() => setShowFullExplanation((v) => !v)}
                className="ios-subhead"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: showFullExplanation ? 10 : 16, fontFamily: "inherit", fontWeight: 500 }}
              >
                {showFullExplanation ? "Hide full explanation" : "See full explanation"}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: showFullExplanation ? "rotate(180deg)" : "none" }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {showFullExplanation && (
                <div
                  className="ios-subhead"
                  style={{ color: "var(--ios-label-2)", lineHeight: 1.6, marginBottom: 16, paddingLeft: 12, borderLeft: `3px solid ${resultAccent}` }}
                >
                  {extendedExp}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={next}
            disabled={isPending}
            className="ios-btn ios-btn--primary"
            style={{ opacity: isPending ? 0.4 : 1 }}
          >
            {isPending ? "Loading…" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
