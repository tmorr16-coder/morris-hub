"use client";

import { useState, useRef } from "react";
import { Segmented, Chip, RadialGauge, Icons } from "@/components/ios";

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

const HORIZON_TINTS: Record<string, string> = {
  short: "var(--ios-green)",
  medium: "var(--ios-orange)",
  long: "var(--ios-tint)",
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
  const [linkedinAbout, setLinkedinAbout] = useState(profile?.linkedin_bio ?? "");
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
    profile?.assessment_responses ?? {}
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
          linkedin_bio: linkedinAbout,
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
        body: JSON.stringify({ assessment_responses: answers }),
      });
      // Then analyze
      const res = await fetch("/api/career/profile/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setSummary(data);
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
    <div data-section="career" style={{ paddingBottom: 44 }}>
      {/* Tab switcher */}
      <div style={{ padding: "4px 16px 8px" }}>
        <Segmented
          ariaLabel="Profile section"
          options={[
            { value: "background", label: "Background" },
            { value: "assessment", label: "Assessment" },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* ── Tab 1: Professional Background ── */}
      {activeTab === "background" && (
        <div>
          {/* Section: Current Role */}
          <FormSection title="Current role">
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
                style={{ ...inputStyle, maxWidth: 140 }}
                className="ios-num"
              />
            </Field>
            <Field label="Industry">
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Technology, Healthcare, Finance"
              />
            </Field>
          </FormSection>

          {/* Section: Resume & Bio */}
          <FormSection title="Resume & bio">
            <Field label="Resume text">
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={10}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                placeholder="Paste your resume text here, or upload a PDF below..."
              />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading}
                className="ios-btn"
                style={{
                  minHeight: 0,
                  padding: "9px 16px",
                  borderRadius: 10,
                  fontSize: 15,
                  background: "var(--ios-fill)",
                  color: "var(--ios-tint)",
                  cursor: uploadLoading ? "not-allowed" : "pointer",
                  opacity: uploadLoading ? 0.6 : 1,
                }}
              >
                <Icons.PlusIcon width={15} height={15} />
                {uploadLoading ? "Parsing PDF…" : "Upload PDF"}
              </button>
              <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                PDF text will be extracted above
              </span>
            </div>
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
          </FormSection>

          {/* Section: Interests & Targets */}
          <FormSection title="Interests & targets">
            <Field label="Career interests">
              <ChipInput
                chips={interests}
                inputValue={interestInput}
                setInputValue={setInterestInput}
                onAdd={() => addChip(interestInput, interests, setInterests, setInterestInput)}
                onRemove={(i) => removeChip(i, interests, setInterests)}
                placeholder={interests.length === 0 ? "Type and press Enter to add…" : ""}
              />
            </Field>

            <Field label="Target roles">
              <ChipInput
                chips={targetRoles}
                inputValue={targetInput}
                setInputValue={setTargetInput}
                onAdd={() => addChip(targetInput, targetRoles, setTargetRoles, setTargetInput)}
                onRemove={(i) => removeChip(i, targetRoles, setTargetRoles)}
                placeholder={targetRoles.length === 0 ? "Type and press Enter to add…" : ""}
              />
            </Field>
          </FormSection>

          {/* Save */}
          <div style={{ padding: "24px 16px 0" }}>
            <button
              type="button"
              onClick={handleSaveBackground}
              disabled={bgSaving}
              className="ios-btn ios-btn--primary"
              style={{ cursor: bgSaving ? "not-allowed" : "pointer", opacity: bgSaving ? 0.7 : 1 }}
            >
              {bgSaving ? "Saving…" : "Save"}
            </button>
            {bgSaved && (
              <p className="ios-footnote" style={{ color: "var(--ios-green)", textAlign: "center", marginTop: 10 }}>
                Saved
              </p>
            )}
            {bgError && (
              <p className="ios-footnote" style={{ color: "var(--ios-red)", textAlign: "center", marginTop: 10 }}>
                {bgError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Interest Assessment ── */}
      {activeTab === "assessment" && (
        <div>
          {/* Summary view */}
          {showSummary && summary && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px 6px" }}>
                <h2 className="ios-group-header" style={{ padding: 0 }}>
                  Your career profile
                </h2>
                <button
                  type="button"
                  onClick={() => setRetaking(true)}
                  className="ios-btn--plain"
                  style={{ padding: 0 }}
                >
                  Retake
                </button>
              </div>
              <AssessmentSummaryCard summary={summary} />
            </div>
          )}

          {/* Assessment form — shown when not completed or retaking */}
          {!showSummary && (
            <>
              {/* Progress meter */}
              <div style={{ padding: "8px 16px 0" }}>
                <div
                  className="ios-list"
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", margin: 0 }}
                >
                  <RadialGauge
                    value={answeredCount / 12}
                    color="var(--ios-tint)"
                    size={64}
                    center={
                      <span className="ios-num" style={{ fontSize: 17, fontWeight: 600, color: "var(--ios-label)" }}>
                        {answeredCount}/12
                      </span>
                    }
                  />
                  <div style={{ flex: 1 }}>
                    <div className="ios-headline">Questions answered</div>
                    <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                      {assessmentCompleted
                        ? "Assessment complete — update your answers anytime"
                        : "Answer at least 6 to generate your profile"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scale questions */}
              <FormSection title="Preferences">
                {SCALE_QUESTIONS.map((q) => (
                  <div key={q.id}>
                    <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 10 }}>
                      {q.label}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {q.options.map((opt) => {
                        const current = answers[q.id];
                        const selected = q.multi
                          ? Array.isArray(current) && current.includes(opt)
                          : current === opt;
                        return (
                          <Chip
                            key={opt}
                            small
                            selected={selected}
                            onClick={() =>
                              q.multi ? toggleMulti(q.id, opt) : setScaleAnswer(q.id, opt)
                            }
                          >
                            {opt}
                          </Chip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </FormSection>

              {/* Text questions */}
              <FormSection title="In your words">
                {TEXT_QUESTIONS.map((q) => (
                  <div key={q.id}>
                    <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 8 }}>
                      {q.label}
                    </div>
                    <textarea
                      rows={q.rows}
                      value={(answers[q.id] as string) ?? ""}
                      onChange={(e) => setTextAnswer(q.id, e.target.value)}
                      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                      placeholder="Your answer…"
                    />
                  </div>
                ))}
              </FormSection>

              {/* Generate button */}
              <div style={{ padding: "24px 16px 0" }}>
                {analyzeError && (
                  <p className="ios-footnote" style={{ color: "var(--ios-red)", marginBottom: 12 }}>
                    {analyzeError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleGenerateProfile}
                  disabled={analyzing || answeredCount < 6}
                  className="ios-btn ios-btn--primary"
                  style={{
                    cursor: analyzing || answeredCount < 6 ? "not-allowed" : "pointer",
                    opacity: analyzing || answeredCount < 6 ? 0.6 : 1,
                  }}
                >
                  {analyzing ? "Generating your career profile…" : "Generate my career profile"}
                </button>
                {answeredCount < 6 && (
                  <p className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 10, textAlign: "center" }}>
                    Answer at least 6 questions to generate your profile.
                  </p>
                )}
              </div>

              {/* Show summary inline after generating, if not retaking */}
              {!retaking && summary && (
                <div style={{ marginTop: 32 }}>
                  <h2 className="ios-group-header">Your career profile</h2>
                  <AssessmentSummaryCard summary={summary} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h2 className="ios-group-header">{title}</h2>
      <div
        className="ios-list"
        style={{ margin: "0 16px", padding: "16px", display: "flex", flexDirection: "column", gap: 18 }}
      >
        {children}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function ChipInput({
  chips,
  inputValue,
  setInputValue,
  onAdd,
  onRemove,
  placeholder,
}: {
  chips: string[];
  inputValue: string;
  setInputValue: (v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  placeholder: string;
}) {
  return (
    <div
      style={{
        border: "var(--ios-hair) solid var(--ios-separator)",
        borderRadius: 10,
        padding: "8px 10px",
        background: "var(--ios-cell)",
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
        colorScheme: "light dark",
      }}
    >
      {chips.map((chip, i) => (
        <TagChip key={i} label={chip} onRemove={() => onRemove(i)} />
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            onAdd();
          }
        }}
        onBlur={onAdd}
        placeholder={placeholder}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 16,
          color: "var(--ios-label)",
          minWidth: 120,
          flex: 1,
          fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function TagChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 5px 4px 11px",
        background: "var(--ios-fill)",
        color: "var(--ios-label)",
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: 9,
          background: "var(--ios-fill-2)",
          color: "var(--ios-label-2)",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </span>
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 12px",
        background: "var(--ios-fill)",
        color,
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

function AssessmentSummaryCard({ summary }: { summary: AssessmentSummary }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary paragraphs */}
      {summary.summary?.length > 0 && (
        <div className="ios-list" style={{ margin: "0 16px", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {summary.summary.map((para, i) => (
            <p key={i} className="ios-body" style={{ color: "var(--ios-label)", margin: 0, lineHeight: 1.6 }}>
              {para}
            </p>
          ))}
        </div>
      )}

      {/* Strengths */}
      {summary.strengths?.length > 0 && (
        <TagGroup title="Strengths" titleColor="var(--ios-green)">
          {summary.strengths.map((s, i) => (
            <Tag key={i} color="var(--ios-green)">{s}</Tag>
          ))}
        </TagGroup>
      )}

      {/* Growth areas */}
      {summary.growth_areas?.length > 0 && (
        <TagGroup title="Growth areas" titleColor="var(--ios-orange)">
          {summary.growth_areas.map((s, i) => (
            <Tag key={i} color="var(--ios-orange)">{s}</Tag>
          ))}
        </TagGroup>
      )}

      {/* Career themes */}
      {summary.career_themes?.length > 0 && (
        <TagGroup title="Career themes" titleColor="var(--ios-tint)">
          {summary.career_themes.map((s, i) => (
            <Tag key={i} color="var(--ios-tint)">{s}</Tag>
          ))}
        </TagGroup>
      )}

      {/* Suggested directions */}
      {summary.suggested_directions?.length > 0 && (
        <section>
          <h3 className="ios-group-header">Suggested directions</h3>
          <div className="ios-list" style={{ margin: "0 16px", display: "flex", flexDirection: "column" }}>
            {summary.suggested_directions.map((dir, i) => {
              const tint = HORIZON_TINTS[dir.horizon] ?? "var(--ios-label-2)";
              return (
                <div
                  key={i}
                  className="ios-cell"
                  style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="ios-headline" style={{ flex: 1 }}>{dir.title}</span>
                    <span
                      style={{
                        padding: "2px 9px",
                        borderRadius: 6,
                        border: `1px solid ${tint}`,
                        color: tint,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.02em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {HORIZON_LABELS[dir.horizon] ?? dir.horizon}
                    </span>
                  </div>
                  <p className="ios-subhead" style={{ color: "var(--ios-label-2)", margin: 0, lineHeight: 1.5 }}>
                    {dir.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function TagGroup({ title, titleColor, children }: { title: string; titleColor: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="ios-group-header" style={{ color: titleColor }}>{title}</h3>
      <div className="ios-list" style={{ margin: "0 16px", padding: "14px 16px", display: "flex", flexWrap: "wrap", gap: 7 }}>
        {children}
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 16,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  colorScheme: "light dark",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  color: "var(--ios-label-2)",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
  marginBottom: 6,
};
