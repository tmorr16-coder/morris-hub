"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const COLOR_OPTIONS = [
  { label: "Indigo", value: "#3B5C7F" },
  { label: "Moss", value: "#4a6a4d" },
  { label: "Amber", value: "#b88a2e" },
  { label: "Rose", value: "#9a3b4a" },
  { label: "Slate", value: "#2f3a47" },
  { label: "Bronze", value: "#8b6a47" },
];

export default function NewGoalPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    category: "Career",
    horizon: "short-term",
    target_date: "",
    why: "",
    description: "",
    success_criteria: "",
    color_tag: "#3B5C7F",
    status: "active",
  });

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/career/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          target_date: form.target_date || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      router.push(`/career/goals/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--color-bg, #f7f4ee)",
        padding: "40px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Back link */}
        <Link
          href="/career/goals"
          style={{
            fontSize: 12,
            color: "var(--color-ink-3, #8a8278)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 28,
          }}
        >
          ← Back to Goals
        </Link>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            fontWeight: 400,
            color: "var(--color-ink)",
            margin: "0 0 32px",
          }}
        >
          New Goal
        </h1>

        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: "var(--color-bg-raised, #fff)",
              border: "1px solid var(--color-line, #e5e2da)",
              borderRadius: 12,
              padding: "28px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            {/* Title */}
            <Field label="Goal Title" required>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="What do you want to achieve?"
                required
                style={inputStyle}
              />
            </Field>

            {/* Category + Horizon row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Category">
                <select value={form.category} onChange={(e) => set("category", e.target.value)} style={inputStyle}>
                  <option value="Career">Career</option>
                  <option value="Personal">Personal</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Horizon">
                <select value={form.horizon} onChange={(e) => set("horizon", e.target.value)} style={inputStyle}>
                  <option value="short-term">Short-term (0–6 months)</option>
                  <option value="medium-term">Medium-term (6–24 months)</option>
                  <option value="long-term">Long-term (2 years+)</option>
                </select>
              </Field>
            </div>

            {/* Target date + Status row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Target Date">
                <input
                  type="date"
                  value={form.target_date}
                  onChange={(e) => set("target_date", e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => set("status", e.target.value)} style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </Field>
            </div>

            {/* Why */}
            <Field label="Why does this matter to you?">
              <textarea
                value={form.why}
                onChange={(e) => set("why", e.target.value)}
                placeholder="Connect this goal to your deeper values and motivations..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
              />
            </Field>

            {/* Description */}
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Describe the goal in more detail..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
              />
            </Field>

            {/* Success criteria */}
            <Field label="Success Criteria">
              <textarea
                value={form.success_criteria}
                onChange={(e) => set("success_criteria", e.target.value)}
                placeholder="How will you know when you've achieved this goal? List criteria, one per line."
                rows={4}
                style={{ ...inputStyle, resize: "vertical", minHeight: 96 }}
              />
            </Field>

            {/* Color tag */}
            <Field label="Color Tag">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.label}
                    onClick={() => set("color_tag", opt.value)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: opt.value,
                      border: form.color_tag === opt.value ? "3px solid var(--color-ink)" : "3px solid transparent",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                      outline: "none",
                    }}
                  />
                ))}
              </div>
            </Field>
          </div>

          {error && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                background: "#fce8e6",
                border: "1px solid #f5c2bd",
                borderRadius: 8,
                fontSize: 13,
                color: "#8a2a2a",
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 24,
              justifyContent: "flex-end",
            }}
          >
            <Link
              href="/career/goals"
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: "var(--color-ink-2, #423e37)",
                textDecoration: "none",
                background: "var(--color-bg-sunk, #f0ede6)",
                border: "1px solid var(--color-line, #e5e2da)",
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || !form.title.trim()}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: submitting ? "var(--color-accent-dark, #29415a)" : "var(--color-accent, #3b5c7f)",
                border: "none",
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: !form.title.trim() ? 0.5 : 1,
                transition: "background 0.15s, opacity 0.15s",
              }}
            >
              {submitting ? "Saving…" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-ink-2, #423e37)",
          marginBottom: 6,
          letterSpacing: "0.03em",
        }}
      >
        {label}
        {required && <span style={{ color: "var(--color-accent)", marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "var(--color-bg-sunk, #f0ede6)",
  border: "1px solid var(--color-line, #e5e2da)",
  borderRadius: 8,
  fontSize: 14,
  color: "var(--color-ink)",
  outline: "none",
  fontFamily: "inherit",
};
