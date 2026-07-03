"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chip, Icons } from "@/components/ios";

interface Choice { id: string; label: string; body: string; }
interface Question {
  id: string; stem: string; difficulty: number; type_id: string;
  lsat_question_types?: { section: string; category: string; subcategory: string | null };
}

const CONFIDENCE_LABELS = ["", "Very Unsure", "Unsure", "Neutral", "Confident", "Very Confident"];
const CONFIDENCE_COLORS = ["", "var(--ios-red)", "var(--ios-orange)", "var(--ios-label-2)", "var(--ios-green)", "var(--ios-green)"];

function CheckSvg({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function XSvg({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function FlagSvg({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

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
    const flaggedTotal = answeredRows.filter((a) => a.flagged).length;
    return (
      <div style={{ textAlign: "center", paddingTop: 56 }}>
        <div style={{
          width: 68, height: 68, borderRadius: "50%", margin: "0 auto 20px",
          background: "var(--ios-green)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CheckSvg size={36} />
        </div>
        <h1 className="ios-title-1" style={{ margin: "0 0 8px" }}>Session Complete</h1>
        <div className="ios-body" style={{ color: "var(--ios-label-2)", marginBottom: 4 }}>
          <span className="ios-num">{correct} / {total}</span> correct — <span className="ios-num">{total > 0 ? Math.round(correct / total * 100) : 0}%</span>
        </div>
        {flaggedTotal > 0 && (
          <div className="ios-subhead" style={{ color: "var(--ios-orange)", marginBottom: 24, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <FlagSvg /> {flaggedTotal} question{flaggedTotal !== 1 ? "s" : ""} flagged for blind review
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "28px auto 0" }}>
          <Link href="/career/lsat" className="ios-btn ios-btn--primary" style={{ textDecoration: "none" }}>
            Back to LSAT Prep
          </Link>
          <Link href="/career/lsat/review" className="ios-btn ios-btn--plain" style={{ textDecoration: "none" }}>
            Review Flagged
          </Link>
        </div>
      </div>
    );
  }

  const qtype = nextQuestion?.lsat_question_types;
  const timeFraction = timeLeft !== null && session.time_limit_s
    ? Math.max(0, Math.min(1, timeLeft / session.time_limit_s))
    : null;
  const lowTime = timeLeft !== null && timeLeft < 300;

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href="/career/lsat" className="ios-subhead" style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "var(--ios-tint)", textDecoration: "none", fontWeight: 500 }}>
            <Icons.ChevronLeft style={{ width: 15, height: 15 }} /> Exit
          </Link>
          <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
            {modeLabel}{session.section ? ` · ${session.section}` : ""} · Q{totalAnswered + 1}
          </span>
          {qtype && (
            <span className="ios-chip ios-chip--sm">
              {qtype.category}{qtype.subcategory ? ` (${qtype.subcategory})` : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {timeLeft !== null && (
            <span className="ios-num" style={{ fontSize: 15, fontWeight: 700, color: lowTime ? "var(--ios-red)" : "var(--ios-label)" }}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </span>
          )}
          <button onClick={endSession} disabled={isPending} className="ios-btn--plain" style={{ fontSize: 14, color: "var(--ios-label-2)" }}>
            End
          </button>
        </div>
      </div>

      {/* Timer progress */}
      {timeFraction !== null && (
        <div style={{ height: 4, borderRadius: 2, background: "var(--ios-fill)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ height: "100%", width: `${timeFraction * 100}%`, background: lowTime ? "var(--ios-red)" : "var(--ios-tint)", borderRadius: 2, transition: "width 1s linear" }} />
        </div>
      )}

      {/* Question stem */}
      <div className="ios-list" style={{ margin: 0, padding: "20px 18px", marginBottom: 20 }}>
        <div className="ios-body" style={{ lineHeight: 1.7, color: "var(--ios-label)", whiteSpace: "pre-line" }}>
          {nextQuestion?.stem}
        </div>
        {session.mode === "blind_review" && (
          <div className="ios-footnote" style={{ marginTop: 12, color: "var(--ios-orange)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <FlagSvg /> This was flagged during a previous session — choose what you believe is correct before revealing the answer.
          </div>
        )}
      </div>

      {/* Answer choices */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {nextChoices.map((c) => {
          const isSelected = selectedId === c.id;
          const isCorrect = submitted && result?.correctId === c.id;
          const isWrong = submitted && isSelected && !result?.isCorrect;
          const accent = isCorrect ? "var(--ios-green)" : isWrong ? "var(--ios-red)" : isSelected ? "var(--ios-tint)" : "var(--ios-separator)";
          const filled = isCorrect || isWrong || isSelected;

          return (
            <button
              key={c.id}
              onClick={() => !submitted && setSelectedId(c.id)}
              style={{
                padding: "14px 16px", borderRadius: 12, textAlign: "left", cursor: submitted ? "default" : "pointer",
                border: `1.5px solid ${accent}`,
                background: isCorrect ? "color-mix(in srgb, var(--ios-green) 10%, var(--ios-cell))" : isWrong ? "color-mix(in srgb, var(--ios-red) 10%, var(--ios-cell))" : isSelected ? "color-mix(in srgb, var(--ios-tint) 10%, var(--ios-cell))" : "var(--ios-cell)",
                display: "flex", gap: 12, alignItems: "flex-start",
                transition: "border-color 120ms, background 120ms",
                color: "var(--ios-label)", width: "100%",
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                border: `1.5px solid ${filled ? accent : "var(--ios-label-3)"}`,
                background: filled ? accent : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                color: filled ? "#fff" : "var(--ios-label-2)",
              }}>
                {c.label}
              </span>
              <span className="ios-subhead" style={{ lineHeight: 1.5, color: "var(--ios-label)", paddingTop: 4, flex: 1 }}>
                {c.body}
              </span>
              {isCorrect && <span style={{ marginLeft: "auto", flexShrink: 0, color: "var(--ios-green)", paddingTop: 2 }}><CheckSvg size={18} /></span>}
              {isWrong && <span style={{ marginLeft: "auto", flexShrink: 0, color: "var(--ios-red)", paddingTop: 2 }}><XSvg size={18} /></span>}
            </button>
          );
        })}
      </div>

      {/* Pre-submit controls */}
      {!submitted && (
        <div className="ios-list" style={{ margin: 0, padding: "16px 18px", marginBottom: 16 }}>
          <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Confidence</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} small selected={confidence === n} onClick={() => setConfidence(n)}>{n}</Chip>
            ))}
          </div>
          <div className="ios-footnote" style={{ color: CONFIDENCE_COLORS[confidence], marginTop: 6, fontWeight: 600 }}>
            {CONFIDENCE_LABELS[confidence]}
          </div>

          <div style={{ marginTop: 16 }}>
            <Chip small selected={flagged} onClick={() => setFlagged(!flagged)}>
              <FlagSvg /> {flagged ? "Flagged" : "Flag for review"}
            </Chip>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!selectedId || isPending}
            className="ios-btn ios-btn--primary"
            style={{ marginTop: 16, opacity: !selectedId || isPending ? 0.5 : 1 }}
          >
            {isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      )}

      {/* Post-submit */}
      {submitted && result && (
        <div
          className="ios-list"
          style={{
            margin: 0, padding: "16px 18px", marginBottom: 16,
            border: `1.5px solid ${result.isCorrect ? "var(--ios-green)" : "var(--ios-red)"}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div className="ios-headline" style={{ color: result.isCorrect ? "var(--ios-green)" : "var(--ios-red)", display: "flex", alignItems: "center", gap: 6 }}>
                {result.isCorrect ? <CheckSvg size={18} /> : <XSvg size={18} />}
                {result.isCorrect ? "Correct" : "Incorrect"}
              </div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
                Confidence: {CONFIDENCE_LABELS[confidence]} · {flagged ? "Flagged for review" : "Not flagged"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {result?.attemptId && (
                <Link href={`/career/lsat/review/${result.attemptId}`} className="ios-btn--plain" style={{ fontSize: 14, textDecoration: "none" }}>
                  Explain
                </Link>
              )}
              <button onClick={next} className="ios-btn ios-btn--primary" style={{ width: "auto", padding: "10px 20px", minHeight: 0 }}>
                Next Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
