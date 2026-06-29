"use client";

import { useState, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Profile = Record<string, any> | null;

interface SuggestedDirection {
  title: string;
  description: string;
  horizon: "short" | "medium" | "long";
}

interface AssessmentSummary {
  summary: string[];
  strengths: string[];
  growth_areas: string[];
  career_themes: string[];
  suggested_directions: SuggestedDirection[];
}

const HORIZON_LABELS: Record<string, string> = {
  short: "Short-term",
  medium: "Medium-term",
  long: "Long-term",
};

const HORIZON_COLORS: Record<string, { bg: string; text: string }> = {
  short: { bg: "#e6f0e0", text: "#3a5c2a" },
  medium: { bg: "#f5edd8", text: "#7a5a2a" },
  long: { bg: "#dde5ee", text: "#2a3f5c" },
};

const Q6_OPTIONS = [
  "Financial reward",
  "Recognition",
  "Continuous growth",
  "Purpose/meaning",
  "Work-life balance",
  "Stability",
];

const SCALE_QUESTIONS = [
  {
    id: "q1",
    label: "What energizes you most at work?",
    options: [
      "Task completion",
      "Problem solving",
      "Working with people",
      "Creating new things",
      "Leading and influencing",
    ],
    multi: false,
  },
  {
    id: "q2",
    label: "How do you prefer to work?",
    options: ["Independently", "Small collaborative team", "Large organization"],
    multi: false,
  },
  {
    id: "q3",
    label: "What kind of impact matters most to you?",
    options: ["Business results", "Developing people", "Innovation", "Mission/purpose"],
    multi: false,
  },
  {
    id: "q4",
    label: "How do you approach risk and change?",
    options: ["Prefer stability", "Balanced approach", "Embrace uncertainty"],
    multi: false,
  },
  {
    id: "q5",
    label: "Your relationship with leadership?",
    options: [
      "I prefer to lead",
      "Collaborative peer",
      "I prefer to contribute individually",
    ],
    multi: false,
  },
  {
    id: "q6",
    label: "What motivates you most? (select up to 2)",
    options: Q6_OPTIONS,
    multi: true,
  },
];

const TEXT_QUESTIONS = [
  { id: "q7", label: "Where do you want to be in 5 years?", rows: 3 },
  { id: "q8", label: "What subjects, domains or industries excite you?", rows: 3 },
  { id: "q9", label: "What do you consider your top 3 strengths?", rows: 3 },
  { id: "q10", label: "What skills do you most want to develop?", rows: 3 },
  { id: "q11", label: "What's the biggest obstacle between you and your goals?", rows: 2 },
  { id: "q12", label: "What does career success look like for you personally?", rows: 3 },
];

export default function CareerProfileClient({ profile }: { profile: Profile }) {
  const [activeTab, setActiveTab] = useState<"background" | "assessment">("background");

  // --- Background form state ---
  const [title, setTitle] = useState(profile?.current_title ?? "");
  const [company, setCompany] = useState(profile?.current_company ?? "");
  const [yearsExp, setYearsExp] = useState<number>(profile?.years_experience ?? 0);
  const [industry, setIndustry] = useState(profile?.industry ?? "");
  const [resumeText, setResumeText] = useState(profile?.resume_text ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedin_url ?? "");
  const [linkedinAbout, setLinkedinAbout] = useState(profile?.linkedin_about ?? "");
  const [interestInput, setInterestInput] = useState("");
  const [interests, setInterests] = useState<string[]>(profile?.career_interests ?? []);
  const [targetInput, setTargetInput] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>(profile?.target_roles ?? []);
  const [bgSaving, setBgSaving] = useState(false);
  const [bgSaved, setBgSaved] = useState(false);
  const [bgError, setBgError] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Assessment state ---
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    profile?.assessment_answers ?? {}
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [summary, setSummary] = useState<AssessmentSummary | null>(
    profile?.assessment_summary ?? null
  );
  const [assessmentCompleted, setAssessmentCompleted] = useState(
    profile?.assessment_completed ?? false
  );
  const [retaking, setRetaking] = useState(false);

  // Count answered questions
  const answeredCount = [...SCALE_QUESTIONS, ...TEXT_QUESTIONS].filter(({ id }) => {
    const a = answers[id];
    if (!a) return false;
    if (Array.isArray(a)) return a.length > 0;
    return a.trim().length > 0;
  }).length;

  // --- Handlers: Background ---
  function addChip(
    input: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void
  ) {
    const trimmed = input.trim().replace(/,$/, "").trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
    }
    setInput("");
  }

  function removeChip(idx: number, list: string[], setList: (v: string[]) => void) {
    setList(list.filter((_, i) => i !== idx));
  }

  async function handleUploadResume(file: File) {
    setUploadLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/career/profile/upload-resume", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.text) setResumeText(data.text);
    } catch {
      // silently fail — user can still type
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleSaveBackground() {
    setBgSaving(true);
    setBgError("");
    setBgSaved(false);
    try {
      const res = await fetch("/api/career/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_title: title,
          current_company: company,
          years_experience: yearsExp,
          industry,
          resume_text: resumeText,
          linkedin_url: linkedinUrl,
          linkedin_about: linkedinAbout,
          career_interests: interests,
          target_roles: targetRoles,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setBgSaved(true);
      setTimeout(() => setBgSaved(false), 2500);
    } catch {
      setBgError("Failed to save. Please try again.");
    } finally {
      setBgSaving(false);
    }
  }

  // --- Handlers: Assessment ---
  function setScaleAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function toggleMulti(id: string, value: string) {
    setAnswers((prev) => {
      const current = (prev[id] as string[]) ?? [];
      if (current.includes(value)) {
        return { ...prev, [id]: current.filter((v) => v !== value) };
      }
      if (current.length >= 2) return prev; // max 2
      return { ...prev, [id]: [...current, value] };
    });
  }

  function setTextAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleGenerateProfile() {
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      // Save responses first
      await fetch("/api/career/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessment_answers: answers }),
      });
      // Then analyze
      const res = await fetch("/api/career/profile/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setSummary(data.summary);
      setAssessmentCompleted(true);
      setRetaking(false);
    } catch {
      setAnalyzeError("Something went wrong generating your profile. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  const showSummary = assessmentCompleted && summary && !retaking;

  return (
    <div data-section="career">
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 28px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 36,
              fontWeight: 400,
              margin: "0 0 6px",
              color: "var(--color-ink)",
            }}
          >
            Profile & Assessment
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-ink-3)", margin: 0 }}>
            Build your professional foundation and get a personalized career profile.
          </p>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--color-line)",
            marginBottom: 36,
          }}
        >
          {(["background", "assessment"] as const).map((tab) => {
            const labels = { background: "Professional Background", assessment: "Interest Assessment" };
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--color-accent)" : "var(--color-ink-2)",
                  background: "none",
                  border: "none",
                  borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
                  marginBottom: -1,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* ── Tab 1: Professional Background ── */}
        {activeTab === "background" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {/* Section: Current Role */}
            <Section title="Current Role">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <Field label="Current title">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. Senior Product Manager"
                  />
                </Field>
                <Field label="Current company">
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. Acme Corp"
                  />
                </Field>
                <Field label="Years of experience">
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={yearsExp}
                    onChange={(e) => setYearsExp(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Industry">
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    style={inputStyle}
                    placeholder="e.g. Technology, Healthcare, Finance, Education, Consulting"
                  />
                </Field>
              </div>
            </Section>

            {/* Section: Resume & Bio */}
            <Section title="Resume & Bio">
              <Field label="Resume text">
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={10}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                  placeholder="Paste your resume text here, or upload a PDF below..."
                />
              </Field>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadResume(file);
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLoading}
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    background: "var(--color-bg-raised)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 6,
                    cursor: uploadLoading ? "not-allowed" : "pointer",
                    color: "var(--color-ink-2)",
                    opacity: uploadLoading ? 0.6 : 1,
                  }}
                >
                  {uploadLoading ? "Parsing PDF..." : "Upload PDF"}
                </button>
                <span style={{ fontSize: 12, color: "var(--color-ink-4)" }}>
                  PDF text will be extracted and filled in above
                </span>
              </div>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="LinkedIn URL">
                  <input
                    type="text"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    style={inputStyle}
                    placeholder="https://linkedin.com/in/your-profile"
                  />
                </Field>
                <Field label="LinkedIn About section">
                  <textarea
                    value={linkedinAbout}
                    onChange={(e) => setLinkedinAbout(e.target.value)}
                    rows={5}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                    placeholder="Paste your LinkedIn About section here"
                  />
                </Field>
              </div>
            </Section>

            {/* Section: Interests & Targets */}
            <Section title="Interests & Targets">
              <Field label="Career interests">
                <div
                  style={{
                    border: "1px solid var(--color-line)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    background: "var(--color-bg-raised)",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  {interests.map((chip, i) => (
                    <Chip
                      key={i}
                      label={chip}
                      onRemove={() => removeChip(i, interests, setInterests)}
                    />
                  ))}
                  <input
                    type="text"
                    value={interestInput}
                    onChange={(e) => setInterestInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addChip(interestInput, interests, setInterests, setInterestInput);
                      }
                    }}
                    onBlur={() => addChip(interestInput, interests, setInterests, setInterestInput)}
                    placeholder={interests.length === 0 ? "Type and press Enter to add..." : ""}
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 14,
                      color: "var(--color-ink)",
                      minWidth: 120,
                      flex: 1,
                    }}
                  />
                </div>
              </Field>

              <Field label="Target roles">
                <div
                  style={{
                    border: "1px solid var(--color-line)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    background: "var(--color-bg-raised)",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  {targetRoles.map((chip, i) => (
                    <Chip
                      key={i}
                      label={chip}
                      onRemove={() => removeChip(i, targetRoles, setTargetRoles)}
                    />
                  ))}
                  <input
                    type="text"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addChip(targetInput, targetRoles, setTargetRoles, setTargetInput);
                      }
                    }}
                    onBlur={() =>
                      addChip(targetInput, targetRoles, setTargetRoles, setTargetInput)
                    }
                    placeholder={targetRoles.length === 0 ? "Type and press Enter to add..." : ""}
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: 14,
                      color: "var(--color-ink)",
                      minWidth: 120,
                      flex: 1,
                    }}
                  />
                </div>
              </Field>
            </Section>

            {/* Save */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button
                onClick={handleSaveBackground}
                disabled={bgSaving}
                style={{
                  padding: "11px 28px",
                  background: "var(--color-accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: bgSaving ? "not-allowed" : "pointer",
                  opacity: bgSaving ? 0.7 : 1,
                }}
              >
                {bgSaving ? "Saving..." : "Save"}
              </button>
              {bgSaved && (
                <span style={{ fontSize: 13, color: "var(--color-moss)" }}>Saved</span>
              )}
              {bgError && (
                <span style={{ fontSize: 13, color: "#c0392b" }}>{bgError}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 2: Interest Assessment ── */}
        {activeTab === "assessment" && (
          <div>
            {/* Summary view */}
            {showSummary && summary && (
              <div style={{ marginBottom: 40 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                  }}
                >
                  <h2
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      margin: 0,
                      color: "var(--color-ink)",
                    }}
                  >
                    Your Career Profile Summary
                  </h2>
                  <button
                    onClick={() => setRetaking(true)}
                    style={{
                      padding: "7px 14px",
                      fontSize: 12,
                      background: "var(--color-bg-raised)",
                      border: "1px solid var(--color-line)",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "var(--color-ink-2)",
                    }}
                  >
                    Retake assessment
                  </button>
                </div>
                <AssessmentSummaryCard summary={summary} />
              </div>
            )}

            {/* Assessment form — shown when not completed or retaking */}
            {(!showSummary) && (
              <>
                {/* Progress */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 28,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
                    {answeredCount} of 12 questions answered
                  </span>
                  {assessmentCompleted && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--color-moss)",
                        fontWeight: 600,
                      }}
                    >
                      Assessment complete
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 4,
                    background: "var(--color-line)",
                    borderRadius: 2,
                    marginBottom: 36,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(answeredCount / 12) * 100}%`,
                      background: "var(--color-accent)",
                      borderRadius: 2,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
                  {/* Scale questions */}
                  {SCALE_QUESTIONS.map((q) => (
                    <div key={q.id}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "var(--color-ink)",
                          marginBottom: 14,
                        }}
                      >
                        {q.label}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {q.options.map((opt) => {
                          const current = answers[q.id];
                          const selected = q.multi
                            ? Array.isArray(current) && current.includes(opt)
                            : current === opt;
                          return (
                            <button
                              key={opt}
                              onClick={() =>
                                q.multi ? toggleMulti(q.id, opt) : setScaleAnswer(q.id, opt)
                              }
                              style={{
                                padding: "8px 16px",
                                fontSize: 13,
                                borderRadius: 20,
                                border: selected
                                  ? "2px solid var(--color-accent)"
                                  : "1px solid var(--color-line)",
                                background: selected
                                  ? "var(--color-accent-soft)"
                                  : "var(--color-bg-raised)",
                                color: selected ? "var(--color-accent)" : "var(--color-ink-2)",
                                fontWeight: selected ? 600 : 400,
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Text questions */}
                  {TEXT_QUESTIONS.map((q) => (
                    <div key={q.id}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "var(--color-ink)",
                          marginBottom: 10,
                        }}
                      >
                        {q.label}
                      </div>
                      <textarea
                        rows={q.rows}
                        value={(answers[q.id] as string) ?? ""}
                        onChange={(e) => setTextAnswer(q.id, e.target.value)}
                        style={{
                          ...inputStyle,
                          resize: "vertical",
                          lineHeight: 1.6,
                        }}
                        placeholder="Your answer..."
                      />
                    </div>
                  ))}
                </div>

                {/* Generate button */}
                <div style={{ marginTop: 40 }}>
                  {analyzeError && (
                    <p style={{ fontSize: 13, color: "#c0392b", marginBottom: 12 }}>
                      {analyzeError}
                    </p>
                  )}
                  <button
                    onClick={handleGenerateProfile}
                    disabled={analyzing || answeredCount < 6}
                    style={{
                      padding: "12px 32px",
                      background: "var(--color-accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: analyzing || answeredCount < 6 ? "not-allowed" : "pointer",
                      opacity: analyzing || answeredCount < 6 ? 0.6 : 1,
                    }}
                  >
                    {analyzing ? "Generating your career profile..." : "Generate my career profile"}
                  </button>
                  {answeredCount < 6 && (
                    <p style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 8 }}>
                      Answer at least 6 questions to generate your profile.
                    </p>
                  )}
                </div>

                {/* Show summary inline after generating, if not retaking */}
                {!retaking && summary && (
                  <div style={{ marginTop: 48 }}>
                    <AssessmentSummaryCard summary={summary} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "var(--color-ink)",
          marginBottom: 18,
          paddingBottom: 10,
          borderBottom: "1px solid var(--color-line)",
        }}
      >
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-ink-2)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px 3px 10px",
        background: "var(--color-accent-soft)",
        color: "var(--color-accent-dark)",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {label}
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-accent)",
          padding: 0,
          lineHeight: 1,
          fontSize: 14,
          display: "flex",
          alignItems: "center",
        }}
        aria-label={`Remove ${label}`}
      >
        &times;
      </button>
    </span>
  );
}

function AssessmentSummaryCard({ summary }: { summary: AssessmentSummary }) {
  return (
    <div
      style={{
        background: "var(--color-bg-raised)",
        border: "1px solid var(--color-line)",
        borderRadius: 12,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Summary paragraphs */}
      {summary.summary?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {summary.summary.map((para, i) => (
            <p key={i} style={{ fontSize: 14, color: "var(--color-ink)", margin: 0, lineHeight: 1.7 }}>
              {para}
            </p>
          ))}
        </div>
      )}

      {/* Strengths */}
      {summary.strengths?.length > 0 && (
        <div>
          <div
            style={{ fontSize: 11, fontWeight: 700, color: "var(--color-moss)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}
          >
            Strengths
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {summary.strengths.map((s, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 12px",
                  background: "#e6f2e8",
                  color: "#2e6b3a",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Growth areas */}
      {summary.growth_areas?.length > 0 && (
        <div>
          <div
            style={{ fontSize: 11, fontWeight: 700, color: "#b8760a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}
          >
            Growth Areas
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {summary.growth_areas.map((s, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 12px",
                  background: "#fef3e0",
                  color: "#8a5c10",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Career themes */}
      {summary.career_themes?.length > 0 && (
        <div>
          <div
            style={{ fontSize: 11, fontWeight: 700, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}
          >
            Career Themes
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {summary.career_themes.map((s, i) => (
              <span
                key={i}
                style={{
                  padding: "4px 12px",
                  background: "var(--color-accent-soft)",
                  color: "var(--color-accent-dark)",
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggested directions */}
      {summary.suggested_directions?.length > 0 && (
        <div>
          <div
            style={{ fontSize: 11, fontWeight: 700, color: "var(--color-ink-2)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}
          >
            Suggested Directions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {summary.suggested_directions.map((dir, i) => {
              const hc = HORIZON_COLORS[dir.horizon] ?? { bg: "#f0ede6", text: "#8a8278" };
              return (
                <div
                  key={i}
                  style={{
                    background: "var(--color-bg-sunk)",
                    borderRadius: 8,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
                      {dir.title}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: hc.bg,
                        color: hc.text,
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "capitalize",
                      }}
                    >
                      {HORIZON_LABELS[dir.horizon] ?? dir.horizon}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: 0, lineHeight: 1.5 }}>
                    {dir.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 14,
  border: "1px solid var(--color-line)",
  borderRadius: 7,
  background: "var(--color-bg-raised)",
  color: "var(--color-ink)",
  outline: "none",
  boxSizing: "border-box",
};
