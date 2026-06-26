"use client";

type TabType = "overview" | "materials" | "flashcards" | "practice" | "chat";

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

  const countdown = exam.target_exam_date ? daysUntil(exam.target_exam_date) : null;

  const statCardStyle: React.CSSProperties = {
    background: "var(--color-bg-card)",
    border: "1px solid var(--color-rule)",
    borderRadius: 12,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--color-ink-4)",
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700,
    color: exam.color_tag,
    lineHeight: 1,
  };

  const actionBtnStyle: React.CSSProperties = {
    padding: "10px 20px",
    borderRadius: 8,
    border: `1.5px solid ${exam.color_tag}`,
    background: "transparent",
    color: exam.color_tag,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  };

  const actionBtnPrimaryStyle: React.CSSProperties = {
    ...actionBtnStyle,
    background: exam.color_tag,
    color: "white",
    border: "none",
  };

  return (
    <div>
      {/* Target exam date countdown */}
      {countdown !== null && (
        <div
          style={{
            background:
              countdown <= 7
                ? "#fef2f2"
                : countdown <= 30
                ? "#fffbeb"
                : `${exam.color_tag}0d`,
            border: `1px solid ${
              countdown <= 7
                ? "#fecaca"
                : countdown <= 30
                ? "#fde68a"
                : `${exam.color_tag}30`
            }`,
            borderRadius: 10,
            padding: "14px 20px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 22 }}>
            {countdown <= 7 ? "🚨" : countdown <= 30 ? "⏰" : "📅"}
          </span>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color:
                  countdown <= 7
                    ? "#991b1b"
                    : countdown <= 30
                    ? "#92400e"
                    : exam.color_tag,
              }}
            >
              {countdown < 0
                ? `Exam date passed ${Math.abs(countdown)} day${Math.abs(countdown) !== 1 ? "s" : ""} ago`
                : countdown === 0
                ? "Exam is today!"
                : `${countdown} day${countdown !== 1 ? "s" : ""} until your exam`}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>
              Target date: {formatDate(exam.target_exam_date!)}
            </div>
          </div>
        </div>
      )}

      {/* Progress summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div style={statCardStyle}>
          <span style={statLabelStyle}>Questions</span>
          <span style={statValueStyle}>{questionCount}</span>
          <span style={{ fontSize: 12, color: "var(--color-ink-3)" }}>available</span>
        </div>

        <div style={statCardStyle}>
          <span style={statLabelStyle}>Sessions</span>
          <span style={statValueStyle}>{recentSessions.length}</span>
          <span style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
            {recentSessions.length === 5 ? "shown (last 5)" : "completed"}
          </span>
        </div>

        <div style={statCardStyle}>
          <span style={statLabelStyle}>Best Score</span>
          <span style={statValueStyle}>
            {hasBestScore ? `${Math.round(bestScore)}%` : "—"}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
            {exam.passing_score_pct ? `passing: ${exam.passing_score_pct}%` : "no passing score set"}
          </span>
        </div>

        <div style={statCardStyle}>
          <span style={statLabelStyle}>Domains</span>
          <span style={statValueStyle}>{domains.length}</span>
          <span style={{ fontSize: 12, color: "var(--color-ink-3)" }}>defined</span>
        </div>
      </div>

      {/* Domain coverage */}
      {domains.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--color-ink)",
              margin: "0 0 16px 0",
            }}
          >
            Domain Coverage
          </h2>

          <div
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {domains.map((domain, idx) => (
              <div
                key={domain.id}
                style={{
                  padding: "14px 20px",
                  borderBottom:
                    idx < domains.length - 1
                      ? "1px solid var(--color-rule)"
                      : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 8,
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-ink)",
                      flex: 1,
                    }}
                  >
                    {domain.name}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--color-ink-3)",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {domain.weight_pct > 0 ? `${domain.weight_pct}%` : "—"}
                  </span>
                </div>

                {/* Weight bar */}
                {domain.weight_pct > 0 && (
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: "var(--color-paper-deep)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.min(domain.weight_pct, 100)}%`,
                        background: exam.color_tag,
                        borderRadius: 3,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                )}

                {domain.description && (
                  <p
                    style={{
                      margin: "6px 0 0 0",
                      fontSize: 12,
                      color: "var(--color-ink-3)",
                      lineHeight: 1.5,
                    }}
                  >
                    {domain.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "var(--color-ink)",
              margin: "0 0 16px 0",
            }}
          >
            Recent Sessions
          </h2>

          <div
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {recentSessions.map((session, idx) => (
              <div
                key={session.id}
                style={{
                  padding: "14px 20px",
                  borderBottom:
                    idx < recentSessions.length - 1
                      ? "1px solid var(--color-rule)"
                      : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-ink)",
                      marginBottom: 2,
                    }}
                  >
                    {formatMode(session.mode)} session
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                    {formatDate(session.started_at)}
                    {session.ended_at ? null : (
                      <span
                        style={{
                          marginLeft: 8,
                          color: "#d97706",
                          fontWeight: 600,
                        }}
                      >
                        In progress
                      </span>
                    )}
                  </div>
                </div>

                {typeof session.score_pct === "number" && (
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color:
                        session.score_pct >= exam.passing_score_pct
                          ? "#059669"
                          : "#dc2626",
                    }}
                  >
                    {Math.round(session.score_pct)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--color-ink)",
            margin: "0 0 16px 0",
          }}
        >
          Quick Actions
        </h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            style={actionBtnStyle}
            onClick={() => onNavigateToTab("materials")}
          >
            Generate Questions
          </button>
          <button
            style={actionBtnStyle}
            onClick={() => onNavigateToTab("flashcards")}
          >
            Generate Flashcards
          </button>
          <button
            style={actionBtnPrimaryStyle}
            onClick={() => onNavigateToTab("practice")}
          >
            Start Practice
          </button>
          <button
            style={actionBtnStyle}
            onClick={() => onNavigateToTab("chat")}
          >
            Ask AI a Question
          </button>
        </div>
      </section>
    </div>
  );
}
