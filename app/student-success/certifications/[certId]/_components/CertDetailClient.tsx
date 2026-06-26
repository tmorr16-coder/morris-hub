"use client";

import { useState } from "react";
import Link from "next/link";
import OverviewTab from "./OverviewTab";
import MaterialsTab from "./MaterialsTab";
import CertFlashcardsTab from "./CertFlashcardsTab";
import CertChatTab from "./CertChatTab";
import StudyGuideTab from "./StudyGuideTab";

interface Exam {
  id: string;
  name: string;
  vendor: string | null;
  exam_code: string | null;
  description: string | null;
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

interface Material {
  id: string;
  type: string;
  title: string;
  url: string | null;
  extracted_text: string | null;
  created_at: string;
}

interface RecentSession {
  id: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  score_pct?: number;
}

interface OpenSession {
  id: string;
  mode: string;
  question_count: number;
  started_at: string;
}

interface CertDetailClientProps {
  exam: Exam;
  domains: Domain[];
  materials: Material[];
  questionCount: number;
  recentSessions: RecentSession[];
  openSessions: OpenSession[];
  savedGuideSections: any[];
}

type TabType = "overview" | "study" | "materials" | "flashcards" | "practice" | "chat";

export default function CertDetailClient({
  exam,
  domains,
  materials,
  questionCount,
  recentSessions,
  openSessions,
  savedGuideSections,
}: CertDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview",   label: "Overview" },
    { id: "study",      label: "📖 Study" },
    { id: "materials",  label: "Materials" },
    { id: "flashcards", label: "Flashcards" },
    { id: "practice",   label: "Practice" },
    { id: "chat",       label: "Chat" },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--color-rule)",
          marginBottom: 32,
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 22px",
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color:
                activeTab === tab.id ? exam.color_tag : "var(--color-ink-2)",
              background: "transparent",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? `2px solid ${exam.color_tag}`
                  : "2px solid transparent",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview" && (
          <OverviewTab
            exam={exam}
            domains={domains}
            questionCount={questionCount}
            recentSessions={recentSessions}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === "study" && (
          <StudyGuideTab
            examId={exam.id}
            examName={exam.name}
            examCode={exam.exam_code}
            domains={domains}
            colorTag={exam.color_tag}
            initialSections={savedGuideSections}
          />
        )}

        {activeTab === "materials" && (
          <MaterialsTab examId={exam.id} initialMaterials={materials} colorTag={exam.color_tag} />
        )}

        {activeTab === "flashcards" && (
          <CertFlashcardsTab
            examId={exam.id}
            examName={exam.name}
            domains={domains}
            colorTag={exam.color_tag}
          />
        )}

        {activeTab === "practice" && (
          <PracticeTabPanel
            exam={exam}
            initialQuestionCount={questionCount}
            openSessions={openSessions}
          />
        )}

        {activeTab === "chat" && (
          <CertChatTab
            examId={exam.id}
            examName={exam.name}
            examCode={exam.exam_code ?? ""}
          />
        )}
      </div>
    </div>
  );
}

// ── Inline Practice tab panel ─────────────────────────────────────────────────

function PracticeTabPanel({ exam, initialQuestionCount, openSessions }: { exam: Exam; initialQuestionCount: number; openSessions: OpenSession[] }) {
  const [questionCount, setQuestionCount] = useState(initialQuestionCount);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true); setGenError(null);
    try {
      const res = await fetch(`/api/student-support/certifications/${exam.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "questions", count: 10 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setQuestionCount((n) => n + (data.generated ?? 0));
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  const modeLabel: Record<string, string> = { practice: "Practice", timed_mock: "Timed Mock", domain_drill: "Domain Drill" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Paused sessions — resume cards */}
      {openSessions.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 10 }}>
            Paused sessions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {openSessions.map((s) => (
              <div key={s.id} style={{ background: "var(--color-bg-raised)", border: `1.5px solid ${exam.color_tag}60`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
                    {modeLabel[s.mode] ?? s.mode}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
                    Started {new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {s.question_count} questions
                  </div>
                </div>
                <Link
                  href={`/student-success/certifications/${exam.id}/practice/${s.id}`}
                  style={{ padding: "8px 18px", borderRadius: 8, background: exam.color_tag, color: "white", fontSize: 13, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}
                >
                  Resume →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question bank status */}
      <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 4 }}>Question bank</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-ink)" }}>{questionCount}</div>
          <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>questions available</div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{ padding: "10px 22px", borderRadius: 9, border: "none", background: generating ? "var(--color-bg-sunk)" : exam.color_tag, color: "white", fontSize: 14, fontWeight: 600, cursor: generating ? "wait" : "pointer", opacity: generating ? 0.7 : 1 }}
        >
          {generating ? "Generating…" : "+ Generate 10 more questions"}
        </button>
      </div>

      {genError && (
        <div style={{ background: "rgba(154,59,42,0.08)", border: "1px solid rgba(154,59,42,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--color-red)" }}>
          {genError}
        </div>
      )}

      {/* Start practice */}
      {questionCount > 0 ? (
        <Link
          href={`/student-success/certifications/${exam.id}/practice`}
          style={{ display: "block", textDecoration: "none" }}
        >
          <div style={{ background: exam.color_tag, borderRadius: 12, padding: "28px 32px", textAlign: "center", color: "white", cursor: "pointer" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Start Practice Session</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Choose Practice, Timed Mock, or Domain Drill →</div>
          </div>
        </Link>
      ) : (
        <div style={{ background: "var(--color-bg-raised)", border: "1px dashed var(--color-line)", borderRadius: 12, padding: "32px", textAlign: "center", color: "var(--color-ink-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink-2)", marginBottom: 6 }}>No questions yet</div>
          <div style={{ fontSize: 13 }}>Click "Generate 10 more questions" above to build your question bank. No source material needed — Claude generates questions from the exam domains.</div>
        </div>
      )}
    </div>
  );
}
