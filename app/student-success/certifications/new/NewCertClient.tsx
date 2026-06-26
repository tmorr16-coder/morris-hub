"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ── Preset data ────────────────────────────────────────────────

interface Domain {
  name: string;
  weight_pct: number;
}

interface Preset {
  name: string;
  vendor: string;
  exam_code: string;
  color_tag: string;
  passing_score_pct: number;
  description: string;
  domains: Domain[];
}

const PRESETS: Record<string, Preset> = {
  ai900: {
    name: "Microsoft Azure AI Fundamentals",
    vendor: "Microsoft",
    exam_code: "AI-900",
    color_tag: "#0078D4",
    passing_score_pct: 70,
    description: "Foundation-level knowledge of machine learning and AI concepts and related Microsoft Azure services.",
    domains: [
      { name: "AI Fundamentals", weight_pct: 15 },
      { name: "ML Workloads", weight_pct: 20 },
      { name: "Computer Vision", weight_pct: 15 },
      { name: "Natural Language Processing", weight_pct: 15 },
      { name: "Conversational AI", weight_pct: 15 },
      { name: "Azure AI Services", weight_pct: 20 },
    ],
  },
  az900: {
    name: "Microsoft Azure Fundamentals",
    vendor: "Microsoft",
    exam_code: "AZ-900",
    color_tag: "#0078D4",
    passing_score_pct: 70,
    description: "Cloud concepts, core Azure services, security, compliance, privacy, pricing, and support.",
    domains: [
      { name: "Cloud Concepts", weight_pct: 25 },
      { name: "Azure Architecture", weight_pct: 35 },
      { name: "Management & Governance", weight_pct: 30 },
      { name: "Privacy & Compliance", weight_pct: 10 },
    ],
  },
  "claude-arch": {
    name: "Claude Certified Architect – Foundations",
    vendor: "Anthropic",
    exam_code: "CCA-F",
    color_tag: "#C97A3A",
    passing_score_pct: 75,
    description: "Design and build production-ready systems with Claude APIs, agentic patterns, and responsible AI principles.",
    domains: [
      { name: "Claude APIs & SDKs", weight_pct: 25 },
      { name: "Prompt Engineering", weight_pct: 25 },
      { name: "Agentic Systems", weight_pct: 20 },
      { name: "Safety & Responsible AI", weight_pct: 15 },
      { name: "Performance & Cost Optimization", weight_pct: 15 },
    ],
  },
};

const COLOR_OPTIONS = [
  { value: "#0078D4", label: "Azure Blue" },
  { value: "#C97A3A", label: "Amber" },
  { value: "#3B5C7F", label: "Slate" },
  { value: "#4A6B3A", label: "Moss" },
  { value: "#7B4F9E", label: "Violet" },
  { value: "#9A3B2A", label: "Crimson" },
];

// ── Shared input style ─────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--color-line)",
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "var(--font-sans)",
  background: "var(--color-bg-sunk)",
  color: "var(--color-ink)",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--color-ink-3)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

// ── Component ──────────────────────────────────────────────────

export default function NewCertificationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetKey = searchParams.get("preset") ?? "";
  const preset = PRESETS[presetKey] ?? null;

  const [name, setName] = useState(preset?.name ?? "");
  const [vendor, setVendor] = useState(preset?.vendor ?? "");
  const [examCode, setExamCode] = useState(preset?.exam_code ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [targetDate, setTargetDate] = useState("");
  const [passingScore, setPassingScore] = useState<number>(preset?.passing_score_pct ?? 70);
  const [colorTag, setColorTag] = useState(preset?.color_tag ?? COLOR_OPTIONS[2].value);
  const [domains, setDomains] = useState<Domain[]>(
    preset?.domains ?? [{ name: "", weight_pct: 0 }]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If the preset param changes after mount (e.g., navigation), re-apply
  useEffect(() => {
    if (preset) {
      setName(preset.name);
      setVendor(preset.vendor);
      setExamCode(preset.exam_code);
      setDescription(preset.description);
      setPassingScore(preset.passing_score_pct);
      setColorTag(preset.color_tag);
      setDomains(preset.domains);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKey]);

  // Domain helpers
  function updateDomain(index: number, field: keyof Domain, value: string | number) {
    setDomains((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  }

  function addDomain() {
    setDomains((prev) => [...prev, { name: "", weight_pct: 0 }]);
  }

  function removeDomain(index: number) {
    setDomains((prev) => prev.filter((_, i) => i !== index));
  }

  // Total weight indicator
  const totalWeight = domains.reduce((sum, d) => sum + (d.weight_pct || 0), 0);
  const weightOk = totalWeight === 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload = {
        name,
        vendor: vendor || null,
        exam_code: examCode || null,
        description: description || null,
        target_exam_date: targetDate || null,
        passing_score_pct: passingScore,
        color_tag: colorTag,
        domains: domains.filter((d) => d.name.trim()),
      };

      const res = await fetch("/api/student-support/certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }

      const created = await res.json();
      router.push(`/student-success/certifications/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "40px 28px 80px" }}>
        {/* Back link */}
        <Link
          href="/student-success/certifications"
          style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}
        >
          ← Certification Prep
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 400,
            margin: "10px 0 4px",
            letterSpacing: "-0.01em",
          }}
        >
          {preset ? `Set up ${preset.exam_code}` : "New Certification"}
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", marginBottom: 32 }}>
          {preset
            ? `Pre-filled for ${preset.exam_code} — adjust anything you like.`
            : "Add a certification you're preparing for."}
        </p>

        {error && (
          <div
            style={{
              background: "rgba(154,59,42,0.1)",
              border: "1px solid rgba(154,59,42,0.3)",
              color: "#9A3B2A",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section: Basics */}
          <div
            style={{
              background: "var(--color-bg-raised)",
              border: "1px solid var(--color-line)",
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--color-line)",
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-ink-2)",
              }}
            >
              Certification details
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Name */}
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., AWS Solutions Architect Associate"
                  style={inputStyle}
                />
              </div>

              {/* Vendor + Exam code row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>Vendor</label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g., Amazon Web Services"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Exam code</label>
                  <input
                    type="text"
                    value={examCode}
                    onChange={(e) => setExamCode(e.target.value)}
                    placeholder="e.g., SAA-C03"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this cert covers..."
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                />
              </div>
            </div>
          </div>

          {/* Section: Goals */}
          <div
            style={{
              background: "var(--color-bg-raised)",
              border: "1px solid var(--color-line)",
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 20,
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--color-line)",
                fontFamily: "var(--font-display)",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-ink-2)",
              }}
            >
              Goals & schedule
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Target date */}
              <div>
                <label style={labelStyle}>Target exam date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Passing score slider */}
              <div>
                <label style={labelStyle}>
                  Passing score:{" "}
                  <span style={{ color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
                    {passingScore}%
                  </span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={1}
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value))}
                  style={{ width: "100%", accentColor: colorTag }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--color-ink-4)",
                    marginTop: 4,
                  }}
                >
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label style={labelStyle}>Accent color</label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      onClick={() => setColorTag(opt.value)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: opt.value,
                        border:
                          colorTag === opt.value
                            ? "3px solid var(--color-ink)"
                            : "2px solid transparent",
                        cursor: "pointer",
                        boxShadow:
                          colorTag === opt.value
                            ? `0 0 0 2px var(--color-bg), 0 0 0 4px ${opt.value}`
                            : "none",
                        transition: "box-shadow 0.15s",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Domains */}
          <div
            style={{
              background: "var(--color-bg-raised)",
              border: "1px solid var(--color-line)",
              borderRadius: 14,
              overflow: "hidden",
              marginBottom: 28,
            }}
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--color-line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-ink-2)",
                }}
              >
                Exam domains
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: weightOk
                    ? "var(--color-moss)"
                    : totalWeight > 0
                    ? "var(--color-ink-3)"
                    : "var(--color-ink-4)",
                }}
              >
                {totalWeight}% / 100%
              </span>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {domains.map((domain, i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 10, alignItems: "center" }}
                >
                  <input
                    type="text"
                    value={domain.name}
                    onChange={(e) => updateDomain(i, "name", e.target.value)}
                    placeholder="Domain name"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      value={domain.weight_pct || ""}
                      onChange={(e) =>
                        updateDomain(i, "weight_pct", Number(e.target.value))
                      }
                      placeholder="0"
                      min={0}
                      max={100}
                      style={{
                        ...inputStyle,
                        width: 68,
                        textAlign: "right",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--color-ink-3)",
                        flexShrink: 0,
                      }}
                    >
                      %
                    </span>
                  </div>
                  {domains.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDomain(i)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-ink-4)",
                        fontSize: 18,
                        lineHeight: 1,
                        padding: "0 4px",
                        flexShrink: 0,
                      }}
                      title="Remove domain"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addDomain}
                style={{
                  alignSelf: "flex-start",
                  marginTop: 4,
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: "1px dashed var(--color-line-2)",
                  background: "none",
                  color: "var(--color-ink-3)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                + Add domain
              </button>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <Link
              href="/student-success/certifications"
              style={{
                padding: "10px 22px",
                borderRadius: 10,
                border: "1px solid var(--color-line)",
                background: "transparent",
                color: "var(--color-ink-2)",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                display: "inline-block",
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              style={{
                padding: "10px 28px",
                borderRadius: 10,
                border: "none",
                background:
                  submitting || !name.trim() ? "var(--color-line)" : colorTag,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting || !name.trim() ? "default" : "pointer",
                opacity: submitting || !name.trim() ? 0.6 : 1,
                fontFamily: "var(--font-sans)",
                transition: "opacity 0.15s",
              }}
            >
              {submitting ? "Creating..." : "Create certification"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
