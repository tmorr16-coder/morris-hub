"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BIBLE_BOOKS } from "@/lib/bible-api";

/** Parse "Genesis 1" or "John 3-5" → { bookId, chapter } */
function parseRef(ref: string): { bookId: string; chapter: number } | null {
  const m = ref.trim().match(/^(.+?)\s+(\d+)(?:-\d+)?$/);
  if (!m) return null;
  const name = m[1].trim().toLowerCase();
  const book = BIBLE_BOOKS.find(b =>
    b.name.toLowerCase() === name ||
    b.name.toLowerCase().replace(/\s/g, "") === name.replace(/\s/g, "")
  );
  if (!book) return null;
  return { bookId: book.id, chapter: parseInt(m[2]) };
}

interface Props {
  planId: string;
  plan: any;
  isBuiltIn: boolean;
  userPlan: any;
  completions: any[];
  userId: string;
}

export default function PlanProgress({ planId, plan, isBuiltIn, userPlan, completions: initial, userId }: Props) {
  const [enrolled, setEnrolled] = useState(!!userPlan);
  const [completions, setCompletions] = useState<Record<string, boolean>>(
    Object.fromEntries(initial.map((c: any) => [`${c.day_number}:${c.reading_ref}`, true]))
  );
  const [enrolling, setEnrolling] = useState(false);
  const db = createClient() as any;

  async function enroll() {
    setEnrolling(true);
    await fetch("/api/bible/plans/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    setEnrolled(true);
    setEnrolling(false);
  }

  async function toggleReading(dayNumber: number, ref: string) {
    const key = `${dayNumber}:${ref}`;
    const done = completions[key];
    const next = { ...completions, [key]: !done };
    setCompletions(next);

    if (done) {
      await db.schema("bible").from("reading_completions").delete()
        .eq("user_id", userId).eq("plan_id", planId)
        .eq("day_number", dayNumber).eq("reading_ref", ref);
    } else {
      await db.schema("bible").from("reading_completions").upsert({
        user_id: userId, plan_id: planId,
        day_number: dayNumber, reading_ref: ref,
      }, { onConflict: "user_id,plan_id,day_number,reading_ref" });
    }
  }

  if (isBuiltIn) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
        <Link href="/bible/plans" style={{ fontSize: 13, color: "var(--color-accent)", textDecoration: "none" }}>← Plans</Link>
        <h1 style={{ fontFamily: "var(--font-instrument-serif, serif)", fontSize: 26, fontWeight: 400, margin: "12px 0 8px" }}>
          {planId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </h1>
        <p style={{ color: "var(--color-ink-3)", fontSize: 14 }}>
          This built-in plan can be started from the Plans page. Custom AI-generated plans support full progress tracking.
        </p>
        <Link href="/bible/plans/generate" style={{
          display: "inline-block", marginTop: 16, padding: "10px 20px",
          background: "var(--color-accent)", color: "#fff", borderRadius: 8,
          textDecoration: "none", fontSize: 13, fontWeight: 500,
        }}>
          Generate a custom plan
        </Link>
      </div>
    );
  }

  if (!plan) return null;

  const readings: any[] = plan.readings ?? [];
  const totalReadings = readings.reduce((acc: number, day: any) => acc + (day.readings?.length ?? 1), 0);
  const completed = Object.values(completions).filter(Boolean).length;
  const pct = totalReadings > 0 ? Math.round((completed / totalReadings) * 100) : 0;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
      <Link href="/bible/plans" style={{ fontSize: 13, color: "var(--color-accent)", textDecoration: "none" }}>← Plans</Link>

      <h1 style={{ fontFamily: "var(--font-instrument-serif, serif)", fontSize: 26, fontWeight: 400, margin: "12px 0 4px" }}>
        {plan.title}
      </h1>
      {plan.description && (
        <p style={{ color: "var(--color-ink-3)", fontSize: 14, margin: "0 0 20px" }}>{plan.description}</p>
      )}

      {/* Progress bar */}
      {enrolled && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-ink-3)", marginBottom: 6 }}>
            <span>{completed} of {totalReadings} readings done</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 8, background: "var(--color-rule)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--color-accent)", borderRadius: 4, transition: "width 300ms" }} />
          </div>
        </div>
      )}

      {/* Enroll CTA */}
      {!enrolled && (
        <div style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)", borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--color-ink)" }}>Start this plan</div>
            <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>Track your progress day by day.</div>
          </div>
          <button onClick={enroll} disabled={enrolling}
            style={{ padding: "8px 18px", background: "var(--color-accent)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {enrolling ? "Starting…" : "Start plan"}
          </button>
        </div>
      )}

      {/* Day list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {readings.map((day: any) => {
          const dayReadings: string[] = day.readings ?? [day.reference ?? `Day ${day.day}`];
          const allDone = dayReadings.every((ref) => completions[`${day.day}:${ref}`]);
          // Find the first incomplete day to mark as "today"
          const firstIncomplete = readings.find((d: any) => {
            const refs: string[] = d.readings ?? [d.reference ?? `Day ${d.day}`];
            return !refs.every((r) => completions[`${d.day}:${r}`]);
          });
          const isToday = enrolled && firstIncomplete?.day === day.day;

          return (
            <div key={day.day} style={{
              background: "var(--color-bg-card)",
              border: `1px solid ${isToday ? "var(--color-accent)" : "var(--color-rule)"}`,
              borderRadius: 12, padding: "14px 18px", boxShadow: "var(--shadow-card)",
              opacity: allDone ? 0.65 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-ink-3)" }}>Day {day.day}</span>
                  {isToday && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "var(--color-accent)",
                      background: "var(--color-accent-soft)", padding: "2px 7px", borderRadius: 8,
                    }}>Today</span>
                  )}
                  {allDone && <span style={{ fontSize: 11, color: "var(--color-green)" }}>✓ Complete</span>}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dayReadings.map((ref) => {
                  const key = `${day.day}:${ref}`;
                  const done = completions[key];
                  const parsed = parseRef(ref);

                  return (
                    <div key={ref} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {/* Checkbox */}
                      {enrolled && (
                        <button onClick={() => toggleReading(day.day, ref)}
                          style={{
                            width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                            border: `2px solid ${done ? "var(--color-accent)" : "var(--color-rule)"}`,
                            background: done ? "var(--color-accent)" : "transparent",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                          {done && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                        </button>
                      )}

                      {/* Reference text */}
                      <span style={{
                        flex: 1, fontSize: 15, color: done ? "var(--color-ink-3)" : "var(--color-ink)",
                        textDecoration: done ? "line-through" : "none",
                        fontFamily: "var(--font-instrument-serif, serif)",
                      }}>
                        {ref}
                      </span>

                      {/* Read buttons */}
                      {parsed && (() => {
                        // reading index within this day
                        const rIdx = dayReadings.indexOf(ref);
                        const focusParams = `focus=1&plan=${planId}&day=${day.day}&ridx=${rIdx}`;
                        return (
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <Link
                              href={`/read/${parsed.bookId}/${parsed.chapter}`}
                              style={{
                                padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                                border: "1px solid var(--color-rule)",
                                background: "var(--color-bg-deep)",
                                color: "var(--color-ink-2)", textDecoration: "none",
                                display: "flex", alignItems: "center", gap: 4,
                              }}
                            >
                              📖 Read
                            </Link>
                            <Link
                              href={`/read/${parsed.bookId}/${parsed.chapter}?${focusParams}`}
                              style={{
                                padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                                border: "none",
                                background: "var(--color-accent)",
                                color: "#fff", textDecoration: "none",
                                display: "flex", alignItems: "center", gap: 4,
                              }}
                            >
                              ◈ Focus
                            </Link>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
