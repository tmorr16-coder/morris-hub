"use client";

import { useState } from "react";
import { Group, Cell, IconBadge, RadialGauge, Sparkline, Icons } from "@/components/ios";

type TabType = "overview" | "materials" | "flashcards" | "practice" | "chat";

function CheckIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L20 6" />
    </svg>
  );
}

function AddToCareerButton({ certName, score, sessionId }: { certName: string; score: number; sessionId: string }) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  async function add() {
    setState("saving");
    try {
      await fetch("/api/career/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: certName,
          learning_type: "certification",
          status: "completed",
          end_date: new Date().toISOString().slice(0, 10),
          notes: `Passed with ${Math.round(score)}% in practice session`,
        }),
      });
      setState("done");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <span className="ios-caption" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-green)", fontWeight: 600 }}>
        <CheckIcon /> Added to Career
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={state === "saving"}
      className="ios-chip ios-chip--sm"
      style={{ color: "var(--ios-tint)", cursor: state === "saving" ? "wait" : "pointer" }}
    >
      {state === "saving" ? "Adding…" : "Add to Career"}
    </button>
  );
}

interface Exam {
  id: string;
  name: string;
  color_tag: string;
  passing_score_pct: number;
  target_exam_date: string | null;
}

interface Domain {
  id: string;
  name: string;
  weight_pct: number;
  description: string | null;
  sort_order: number;
}

interface RecentSession {
  id: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  score_pct?: number;
}

interface OverviewTabProps {
  exam: Exam;
  domains: Domain[];
  questionCount: number;
  recentSessions: RecentSession[];
  onNavigateToTab: (tab: TabType) => void;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMode(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export default function OverviewTab({
  exam,
  domains,
  questionCount,
  recentSessions,
  onNavigateToTab,
}: OverviewTabProps) {
  const completedSessions = recentSessions.filter((s) => s.ended_at);
  const bestScore = completedSessions
    .map((s) => s.score_pct)
    .filter((s): s is number => typeof s === "number")
    .reduce((best, s) => Math.max(best, s), -Infinity);

  const hasBestScore = isFinite(bestScore);
  const passed = hasBestScore && bestScore >= exam.passing_score_pct;
  const scoreColor = passed ? "var(--ios-green)" : "var(--ios-red)";

  const scoreSeries = completedSessions
    .map((s) => s.score_pct)
    .filter((s): s is number => typeof s === "number")
    .reverse();

  const countdown = exam.target_exam_date ? daysUntil(exam.target_exam_date) : null;
  const countdownColor =
    countdown === null ? exam.color_tag : countdown <= 7 ? "var(--ios-red)" : countdown <= 30 ? "var(--ios-orange)" : exam.color_tag;

  const quickActions: { label: string; sub: string; tab: TabType; color: string; icon: React.ReactNode }[] = [
    { label: "Generate questions", sub: "Build your question bank", tab: "materials", color: exam.color_tag, icon: <Icons.ChecklistIcon /> },
    { label: "Generate flashcards", sub: "Quick recall practice", tab: "flashcards", color: "#B565A7", icon: <Icons.BookIcon /> },
    { label: "Start practice", sub: "Timed mock or domain drill", tab: "practice", color: "var(--ios-green)", icon: <Icons.ChartIcon /> },
    { label: "Ask AI a question", sub: "Study assistant chat", tab: "chat", color: "var(--ios-tint)", icon: <Icons.SparkleIcon /> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Target exam date countdown */}
      {countdown !== null && (
        <div className="ios-list" style={{ margin: 0, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <IconBadge color={countdownColor}><Icons.CalendarIcon /></IconBadge>
          <div style={{ minWidth: 0 }}>
            <div className="ios-headline" style={{ color: countdownColor }}>
              {countdown < 0
                ? `Exam date passed ${Math.abs(countdown)} day${Math.abs(countdown) !== 1 ? "s" : ""} ago`
                : countdown === 0
                ? "Exam is today!"
                : `${countdown} day${countdown !== 1 ? "s" : ""} until your exam`}
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
              Target date: {formatDate(exam.target_exam_date!)}
            </div>
          </div>
        </div>
      )}

      {/* Best score gauge */}
      {hasBestScore && (
        <div className="ios-list" style={{ margin: 0, padding: "20px 16px", display: "flex", alignItems: "center", gap: 20 }}>
          <RadialGauge
            value={bestScore / 100}
            color={scoreColor}
            center={<span className="ios-num" style={{ fontSize: 20, fontWeight: 700, color: "var(--ios-label)" }}>{Math.round(bestScore)}%</span>}
          />
          <div style={{ minWidth: 0 }}>
            <div className="ios-group-header" style={{ padding: 0 }}>Best score</div>
            <div className="ios-headline" style={{ color: scoreColor, marginTop: 4 }}>
              {passed ? "Passing" : "Keep practicing"}
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
              {exam.passing_score_pct ? `Passing score: ${exam.passing_score_pct}%` : "No passing score set"}
            </div>
          </div>
        </div>
      )}

      {/* Progress summary */}
      <Group header="Progress">
        <Cell
          lead={<IconBadge color={exam.color_tag}><Icons.ChecklistIcon /></IconBadge>}
          title="Questions available"
          trailing={<span className="ios-num ios-headline" style={{ color: "var(--ios-label)" }}>{questionCount}</span>}
          chevron={false}
        />
        <Cell
          lead={<IconBadge color="var(--ios-orange)"><Icons.ChartIcon /></IconBadge>}
          title="Practice sessions"
          subtitle={recentSessions.length === 5 ? "Showing last 5" : undefined}
          trailing={<span className="ios-num ios-headline" style={{ color: "var(--ios-label)" }}>{recentSessions.length}</span>}
          chevron={false}
        />
        <Cell
          lead={<IconBadge color="var(--ios-green)"><Icons.TrendUpIcon /></IconBadge>}
          title="Best score"
          trailing={<span className="ios-num ios-headline" style={{ color: hasBestScore ? scoreColor : "var(--ios-label-2)" }}>{hasBestScore ? `${Math.round(bestScore)}%` : "—"}</span>}
          chevron={false}
        />
        <Cell
          lead={<IconBadge color="#B565A7"><Icons.BookIcon /></IconBadge>}
          title="Domains"
          trailing={<span className="ios-num ios-headline" style={{ color: "var(--ios-label)" }}>{domains.length}</span>}
          chevron={false}
        />
      </Group>

      {/* Score trend */}
      {scoreSeries.length >= 2 && (
        <Group header="Score trend">
          <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>Recent sessions</span>
            <Sparkline points={scoreSeries} color={exam.color_tag} width={160} height={44} />
          </div>
        </Group>
      )}

      {/* Domain coverage */}
      {domains.length > 0 && (
        <Group header="Domain coverage">
          {domains.map((domain) => (
            <Cell
              key={domain.id}
              title={domain.name}
              subtitle={domain.description ?? undefined}
              trailing={
                <span className="ios-subhead ios-num" style={{ color: "var(--ios-label-2)" }}>
                  {domain.weight_pct > 0 ? `${domain.weight_pct}%` : "—"}
                </span>
              }
              chevron={false}
            />
          ))}
        </Group>
      )}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <Group header="Recent sessions">
          {recentSessions.map((session) => (
            <Cell
              key={session.id}
              title={`${formatMode(session.mode)} session`}
              subtitle={
                <span>
                  {formatDate(session.started_at)}
                  {session.ended_at ? null : (
                    <span style={{ marginLeft: 8, color: "var(--ios-orange)", fontWeight: 600 }}>In progress</span>
                  )}
                </span>
              }
              trailing={
                typeof session.score_pct === "number" ? (
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span className="ios-num" style={{ fontSize: 18, fontWeight: 700, color: session.score_pct >= exam.passing_score_pct ? "var(--ios-green)" : "var(--ios-red)" }}>
                      {Math.round(session.score_pct)}%
                    </span>
                    {session.score_pct >= exam.passing_score_pct && (
                      <AddToCareerButton certName={exam.name} score={session.score_pct} sessionId={session.id} />
                    )}
                  </span>
                ) : undefined
              }
              chevron={false}
            />
          ))}
        </Group>
      )}

      {/* Quick actions */}
      <Group header="Quick actions">
        {quickActions.map((a) => (
          <Cell
            key={a.tab}
            lead={<IconBadge color={a.color}>{a.icon}</IconBadge>}
            title={a.label}
            subtitle={a.sub}
            onClick={() => onNavigateToTab(a.tab)}
          />
        ))}
      </Group>
    </div>
  );
}
