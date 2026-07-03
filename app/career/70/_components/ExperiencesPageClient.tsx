"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Group, Chip, IconBadge, Icons } from "@/components/ios";
import QuickLogModal from "./QuickLogModal";

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
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

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

  const availableTypes = Array.from(
    new Set(experiences.map((e: Experience) => e.experience_type ?? "other"))
  );
  const visible = experiences.filter(
    (e: Experience) => filter === "all" || (e.experience_type ?? "other") === filter
  );

  return (
    <div>
      {/* Add actions */}
      <div style={{ display: "flex", gap: 10, padding: "0 16px 8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setShowQuickLog(true)}
          className="ios-btn ios-btn--primary"
          style={{ flex: 1, minWidth: 140, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <Icons.SparkleIcon style={{ width: 17, height: 17 }} /> Quick Log
        </button>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ios-btn"
          style={{ flex: 1, minWidth: 140, background: "var(--ios-fill)", color: "var(--ios-tint)" }}
        >
          Full Entry
        </button>
      </div>

      {showQuickLog && (
        <QuickLogModal
          onClose={() => setShowQuickLog(false)}
          onSaved={() => { setShowQuickLog(false); router.refresh(); }}
        />
      )}

      {/* Full entry sheet */}
      {showForm && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setShowForm(false)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Log an experience">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setShowForm(false)}>Cancel</button>
              <span className="ios-headline">Log experience</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={handleSubmit} style={{ overflowY: "auto" }}>
              {error && (
                <p className="ios-footnote" style={{ padding: "0 0 12px", color: "var(--ios-red)" }}>{error}</p>
              )}

              <div className="ios-group-header" style={{ padding: "0 0 8px" }}>
                Title <span style={{ color: "var(--ios-red)" }}>*</span>
              </div>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="e.g. Led onboarding for 3 new teammates"
                style={inputStyle}
              />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Type</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {EXPERIENCE_TYPES.map((t) => (
                  <Chip
                    key={t}
                    small
                    selected={form.experience_type === t}
                    onClick={() => setForm((prev) => ({ ...prev, experience_type: t }))}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Chip>
                ))}
              </div>

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Date</div>
              <input
                type="date"
                name="experience_date"
                value={form.experience_date}
                onChange={handleChange}
                style={inputStyle}
              />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Description</div>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="What happened? What was your role?"
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>What did you learn? (Reflection)</div>
              <textarea
                name="reflection"
                value={form.reflection}
                onChange={handleChange}
                rows={3}
                placeholder="What did you learn?"
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>How does this help your goals? (Impact)</div>
              <textarea
                name="impact"
                value={form.impact}
                onChange={handleChange}
                rows={2}
                placeholder="How does this help your goals?"
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Skills developed (comma separated)</div>
              <input
                name="skills_developed"
                value={form.skills_developed}
                onChange={handleChange}
                placeholder="e.g. communication, project management, SQL"
                style={inputStyle}
              />

              {goals.length > 0 && (
                <>
                  <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Link to goals</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {goals.map((g) => (
                      <Chip
                        key={g.id}
                        small
                        selected={form.linked_goal_ids.includes(g.id)}
                        onClick={() => toggleGoal(g.id)}
                      >
                        {g.title}
                      </Chip>
                    ))}
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={submitting || isPending}
                className="ios-btn ios-btn--primary"
                style={{ marginTop: 22, opacity: submitting ? 0.5 : 1 }}
              >
                {submitting ? "Saving…" : "Save Experience"}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Type filter */}
      {availableTypes.length > 1 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "6px 16px 0" }}>
          <Chip small selected={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
          {availableTypes.map((t) => (
            <Chip key={t} small selected={filter === t} onClick={() => setFilter(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Chip>
          ))}
        </div>
      )}

      {/* Experience list */}
      {visible.length === 0 ? (
        <Group footer="Capture what you learned on the job with Quick Log or a full entry.">
          <button
            type="button"
            className="ios-cell"
            onClick={() => setShowQuickLog(true)}
            style={{ color: "var(--ios-tint)" }}
          >
            <span className="ios-cell-lead">
              <IconBadge color="var(--ios-tint)"><Icons.PlusIcon /></IconBadge>
            </span>
            <span className="ios-cell-body">
              <span className="ios-cell-title" style={{ color: "var(--ios-tint)" }}>Log your first experience</span>
            </span>
          </button>
        </Group>
      ) : (
        <div className="ios-list" style={{ margin: "12px 16px 0" }}>
          {visible.map((exp: Experience) => {
            const typeColor = typeColors[exp.experience_type ?? "other"] ?? typeColors.other;
            return (
              <div key={exp.id} className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span className="ios-cell-lead">
                    <IconBadge color={typeColor}><Icons.BriefcaseIcon /></IconBadge>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="ios-caption" style={{ textTransform: "uppercase", letterSpacing: "0.02em", fontWeight: 600, color: typeColor }}>
                        {exp.experience_type ?? "other"}
                      </span>
                      {exp.experience_date && (
                        <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>
                          {formatDate(exp.experience_date)}
                        </span>
                      )}
                    </div>
                    <div className="ios-headline" style={{ marginTop: 2 }}>{exp.title}</div>
                  </div>
                </div>

                {exp.description && (
                  <p className="ios-subhead" style={{ margin: 0, color: "var(--ios-label-2)", lineHeight: 1.5 }}>
                    {exp.description}
                  </p>
                )}
                {exp.reflection && (
                  <p className="ios-subhead" style={{ margin: 0, color: "var(--ios-label-3)", fontStyle: "italic", lineHeight: 1.5 }}>
                    {exp.reflection.length > 160 ? exp.reflection.slice(0, 160) + "…" : exp.reflection}
                  </p>
                )}
                {(exp.skills_developed ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(exp.skills_developed ?? []).map((skill: string) => (
                      <Chip key={skill} small>{skill}</Chip>
                    ))}
                  </div>
                )}
                {(exp.linked_goal_ids ?? []).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(exp.linked_goal_ids ?? []).map((gid: string) =>
                      goalsMap[gid] ? (
                        <span
                          key={gid}
                          className="ios-caption"
                          style={{ background: "var(--ios-fill)", color: "var(--ios-label-2)", borderRadius: 6, padding: "2px 8px" }}
                        >
                          {goalsMap[gid]}
                        </span>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
