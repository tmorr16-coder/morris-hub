"use client";

// Cross-platform reminder quick-add. Drops into PlatformMenu so a user
// can capture a reminder from any subdomain (hub/health/finance) with
// title + date + optional time/recurrence/category. Inserts directly
// into hub.reminders via the user's Supabase session — RLS scopes the
// insert to auth.uid().

import { useState, useRef, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Category = "bill" | "medication" | "workout" | "appointment" | "personal" | "general";
type Recurrence = "once" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

const CATEGORIES: Category[] = ["bill", "medication", "workout", "appointment", "personal", "general"];
const RECURRENCES: Recurrence[] = ["once", "daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"];

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    COOKIE_DOMAIN
      ? { cookieOptions: { domain: COOKIE_DOMAIN, path: "/", sameSite: "lax" } }
      : undefined
  );
}

function todayISO(): string {
  // YYYY-MM-DD in the user's local timezone (Indianapolis by default for Terry).
  // We use a date input that gives us the local date directly.
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function tomorrowISO(): string {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().slice(0, 10);
}

function nextWeekISO(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export default function QuickAddReminder({
  sourceApp,
}: {
  sourceApp: "hub" | "health" | "finance";
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");
  const [recurrence, setRecurrence] = useState<Recurrence>("once");
  const [category, setCategory] = useState<Category>("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Focus title when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setError(null);
      setSuccess(false);
    }
  }, [open]);

  async function save() {
    if (!title.trim()) {
      setError("Title required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = makeClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Not signed in");
        setSaving(false);
        return;
      }
      // Build the due_at by combining date + time in the user's local zone.
      // The Date constructor with "YYYY-MM-DDTHH:mm" treats it as local time.
      const dueAt = new Date(`${date}T${time}:00`).toISOString();

      const { error: insertErr } = await supabase
        .schema("hub")
        .from("reminders")
        .insert({
          user_id: user.id,
          title: title.trim(),
          due_at: dueAt,
          recurrence,
          category,
          source_app: sourceApp,
        });

      if (insertErr) {
        setError(insertErr.message);
        setSaving(false);
        return;
      }

      // Reset form, show flash, close after a beat
      setTitle("");
      setRecurrence("once");
      setCategory("general");
      setSuccess(true);
      setTimeout(() => setOpen(false), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "relative" }} ref={popoverRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Quick-add reminder (works from any app)"
        style={{
          fontSize: 12,
          fontWeight: 500,
          padding: "5px 10px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          background: open ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.03)",
          color: "#1a1a1a",
          cursor: "pointer",
          fontFamily: "var(--font-geist, system-ui), sans-serif",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Remind
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 14,
            zIndex: 200,
            fontFamily: "var(--font-geist, system-ui), sans-serif",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6B6258", marginBottom: 10 }}>
            New reminder
          </div>

          <input
            ref={inputRef}
            placeholder="Title (e.g. Take Mounjaro)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
            }}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 10,
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />

          {/* Quick date chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {[
              { label: "Today", val: todayISO() },
              { label: "Tomorrow", val: tomorrowISO() },
              { label: "Next week", val: nextWeekISO() },
            ].map((c) => (
              <button
                key={c.label}
                onClick={() => setDate(c.val)}
                style={{
                  flex: 1,
                  padding: "5px 6px",
                  border: `1px solid ${date === c.val ? "#1a1a1a" : "rgba(0,0,0,0.1)"}`,
                  background: date === c.val ? "rgba(0,0,0,0.04)" : "#fff",
                  borderRadius: 6,
                  fontSize: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "#1a1a1a",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 6, marginBottom: 10 }}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)} style={inputStyle}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} style={inputStyle}>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>

          {error && (
            <div style={{ padding: "6px 10px", background: "rgba(154,59,42,0.08)", border: "1px solid #9A3B2A", borderRadius: 6, fontSize: 11, color: "#9A3B2A", marginBottom: 8 }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: "6px 10px", background: "rgba(77,107,58,0.08)", border: "1px solid #4D6B3A", borderRadius: 6, fontSize: 11, color: "#4D6B3A", marginBottom: 8 }}>
              Saved ✓
            </div>
          )}

          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: "6px 12px",
                border: "1px solid rgba(0,0,0,0.1)",
                background: "#fff",
                borderRadius: 8,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                color: "#6B6258",
              }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !title.trim()}
              style={{
                padding: "6px 14px",
                border: "none",
                background: title.trim() && !saving ? "#1a1a1a" : "#ccc",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                cursor: title.trim() && !saving ? "pointer" : "default",
                fontFamily: "inherit",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "inherit",
  color: "#1a1a1a",
  background: "#fff",
  boxSizing: "border-box",
  width: "100%",
};
