"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const EXPERIENCE_TYPES = [
  "project",
  "presentation",
  "leadership",
  "challenge",
  "collaboration",
  "mentoring",
  "feedback",
  "other",
];

interface Goal {
  id: string;
  title: string;
  color_tag?: string;
}

interface Experience {
  id: string;
  title: string;
  description?: string | null;
  experience_type?: string;
  experience_date?: string | null;
  reflection?: string | null;
  impact?: string | null;
  skills_developed?: string[];
  linked_goal_ids?: string[];
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  experiences: any[];
  goals: Goal[];
  goalsMap: Record<string, string>;
  typeColors: Record<string, string>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ExperiencesPageClient({
  experiences,
  goals,
  goalsMap,
  typeColors,
}: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    experience_type: "project",
    experience_date: new Date().toISOString().slice(0, 10),
    description: "",
    reflection: "",
    impact: "",
    skills_developed: "",
    linked_goal_ids: [] as string[],
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleGoal(id: string) {
    setForm((prev) => ({
      ...prev,
      linked_goal_ids: prev.linked_goal_ids.includes(id)
        ? prev.linked_goal_ids.filter((g) => g !== id)
        : [...prev.linked_goal_ids, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/career/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          experience_type: form.experience_type,
          experience_date: form.experience_date || null,
          description: form.description.trim() || null,
          reflection: form.reflection.trim() || null,
          impact: form.impact.trim() || null,
          skills_developed: form.skills_developed
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          linked_goal_ids: form.linked_goal_ids,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to save");
      }
      setShowForm(false);
      setForm({
        title: "",
        experience_type: "project",
        experience_date: new Date().toISOString().slice(0, 10),
        description: "",
        reflection: "",
        impact: "",
        skills_developed: "",
        linked_goal_ids: [],
      });
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Add button */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            background: "var(--color-accent)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 18px",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {showForm ? "Cancel" : "+ Log Experience"}
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "24px",
            marginBottom: 28,
          }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>
            Log an On-the-Job Experience
          </h3>

          {error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 6,
                padding: "8px 12px",
                color: "#9A3B2A",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Title *</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="e.g. Led onboarding for 3 new teammates"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Type</label>
              <select name="experience_type" value={form.experience_type} onChange={handleChange} style={inputStyle}>
                {EXPERIENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Date</label>
              <input
                type="date"
                name="experience_date"
                value={form.experience_date}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="What happened? What was your role?"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>What did you learn? (Reflection)</label>
              <textarea
                name="reflection"
                value={form.reflection}
                onChange={handleChange}
                rows={3}
                placeholder="What did you learn?"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>How does this help your goals? (Impact)</label>
              <textarea
                name="impact"
                value={form.impact}
                onChange={handleChange}
                rows={2}
                placeholder="How does this help your goals?"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Skills Developed (comma separated)</label>
              <input
                name="skills_developed"
                value={form.skills_developed}
                onChange={handleChange}
                placeholder="e.g. communication, project management, SQL"
                style={inputStyle}
              />
            </div>

            {goals.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Link to Goals</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {goals.map((g) => {
                    const selected = form.linked_goal_ids.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGoal(g.id)}
                        style={{
                          border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-rule)"}`,
                          background: selected ? "var(--color-accent-soft)" : "transparent",
                          color: selected ? "var(--color-accent-dark)" : "var(--color-ink-2)",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        {g.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={submitting || isPending}
              style={{
                background: "var(--color-accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 20px",
                fontSize: 14,
                fontWeight: 500,
                cursor: submitting ? "wait" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving…" : "Save Experience"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                background: "transparent",
                border: "1px solid var(--color-rule)",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 14,
                color: "var(--color-ink-2)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Experience list */}
      {experiences.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            color: "var(--color-ink-3)",
            fontSize: 15,
          }}
        >
          No experiences logged yet. Click &ldquo;+ Log Experience&rdquo; to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {experiences.map((exp: Experience) => {
            const typeColor =
              typeColors[exp.experience_type ?? "other"] ?? typeColors.other;
            return (
              <div
                key={exp.id}
                style={{
                  background: "var(--color-bg-card)",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 10,
                  padding: "16px 20px",
                  borderLeft: `4px solid ${typeColor}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span
                        style={{
                          background: typeColor,
                          color: "#fff",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {exp.experience_type ?? "other"}
                      </span>
                      {exp.experience_date && (
                        <span style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                          {formatDate(exp.experience_date)}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--color-ink)",
                        marginBottom: exp.description ? 6 : 0,
                      }}
                    >
                      {exp.title}
                    </div>
                    {exp.description && (
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--color-ink-2)",
                          margin: "0 0 8px",
                          lineHeight: 1.5,
                        }}
                      >
                        {exp.description}
                      </p>
                    )}
                    {exp.reflection && (
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--color-ink-3)",
                          margin: "0 0 6px",
                          fontStyle: "italic",
                          lineHeight: 1.5,
                        }}
                      >
                        {exp.reflection.length > 160
                          ? exp.reflection.slice(0, 160) + "…"
                          : exp.reflection}
                      </p>
                    )}
                    {(exp.skills_developed ?? []).length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        {(exp.skills_developed ?? []).map((skill: string) => (
                          <span
                            key={skill}
                            style={{
                              background: "var(--color-accent-soft)",
                              color: "var(--color-accent-dark)",
                              borderRadius: 4,
                              padding: "1px 7px",
                              fontSize: 11,
                              fontWeight: 500,
                              textTransform: "capitalize",
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    {(exp.linked_goal_ids ?? []).length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        {(exp.linked_goal_ids ?? []).map((gid: string) =>
                          goalsMap[gid] ? (
                            <span
                              key={gid}
                              style={{
                                background: "var(--color-bg-deep)",
                                color: "var(--color-ink-2)",
                                borderRadius: 4,
                                padding: "1px 7px",
                                fontSize: 11,
                              }}
                            >
                              {goalsMap[gid]}
                            </span>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--color-ink-3)",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--color-bg)",
  border: "1px solid var(--color-rule)",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 14,
  color: "var(--color-ink)",
  outline: "none",
};
