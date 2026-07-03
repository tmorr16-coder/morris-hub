/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import Link from "next/link";
import { Segmented, Group, Cell, IconBadge, Icons } from "@/components/ios";
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

  const tabs: { value: TabType; label: string }[] = [
    { value: "overview",   label: "Overview" },
    { value: "study",      label: "Study" },
    { value: "materials",  label: "Materials" },
    { value: "flashcards", label: "Flashcards" },
    { value: "practice",   label: "Practice" },
    { value: "chat",       label: "Chat" },
  ];

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ padding: "0 16px 20px", overflowX: "auto" }}>
        <Segmented
          options={tabs}
          value={activeTab}
          onChange={setActiveTab}
          ariaLabel="Certification sections"
        />
      </div>

      {/* Tab content */}
      <div style={{ padding: "0 16px" }}>
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
        <Group header="Paused sessions">
          {openSessions.map((s) => (
            <Cell
              key={s.id}
              lead={<IconBadge color="var(--ios-orange)"><Icons.TodayIcon /></IconBadge>}
              title={modeLabel[s.mode] ?? s.mode}
              subtitle={`Started ${new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${s.question_count} questions`}
              trailing={<span className="ios-subhead" style={{ color: "var(--ios-tint)", fontWeight: 600 }}>Resume</span>}
              href={`/career/certifications/${exam.id}/practice/${s.id}`}
            />
          ))}
        </Group>
      )}

      {/* Question bank status */}
      <Group header="Question bank" footer="Claude generates questions from the exam domains — no source material required.">
        <Cell
          lead={<IconBadge color={exam.color_tag}><Icons.ChecklistIcon /></IconBadge>}
          title="Questions available"
          trailing={<span className="ios-title-3 ios-num" style={{ color: "var(--ios-label)", fontWeight: 700 }}>{questionCount}</span>}
          chevron={false}
        />
      </Group>

      <button
        type="button"
        className="ios-btn ios-btn--primary"
        onClick={handleGenerate}
        disabled={generating}
        style={{ opacity: generating ? 0.6 : 1 }}
      >
        {generating ? "Generating…" : "Generate 10 more questions"}
      </button>

      {genError && (
        <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: 0 }}>{genError}</p>
      )}

      {/* Start practice */}
      {questionCount > 0 ? (
        <Link href={`/career/certifications/${exam.id}/practice`} style={{ textDecoration: "none" }}>
          <div className="ios-list" style={{ margin: 0, padding: "24px 20px", display: "flex", alignItems: "center", gap: 16 }}>
            <IconBadge color={exam.color_tag}><Icons.ChartIcon /></IconBadge>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ios-headline" style={{ color: "var(--ios-label)" }}>Start practice session</div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>Choose Practice, Timed Mock, or Domain Drill</div>
            </div>
            <Icons.ChevronRight style={{ width: 18, height: 18, color: "var(--ios-label-3)" }} />
          </div>
        </Link>
      ) : (
        <div className="ios-list" style={{ margin: 0, padding: "32px 24px", textAlign: "center" }}>
          <div className="ios-headline" style={{ color: "var(--ios-label)", marginBottom: 6 }}>No questions yet</div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0, lineHeight: 1.5 }}>
            Tap &ldquo;Generate 10 more questions&rdquo; above to build your question bank.
          </p>
        </div>
      )}
    </div>
  );
}
