"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import Link from "next/link";
import { Group, Cell, Icons } from "@/components/ios";
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

function CheckMark({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4 4L19 6.5" />
    </svg>
  );
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

  // Toggle every reading in a day at once. If the whole day is already done,
  // tapping again clears it; otherwise all remaining readings are marked read.
  async function toggleDay(dayNumber: number, refs: string[]) {
    const allDone = refs.every((r) => completions[`${dayNumber}:${r}`]);
    const nextVal = !allDone;

    setCompletions((prev) => {
      const next = { ...prev };
      refs.forEach((r) => { next[`${dayNumber}:${r}`] = nextVal; });
      return next;
    });

    if (nextVal) {
      await db.schema("bible").from("reading_completions").upsert(
        refs.map((r) => ({
          user_id: userId, plan_id: planId,
          day_number: dayNumber, reading_ref: r,
        })),
        { onConflict: "user_id,plan_id,day_number,reading_ref" }
      );
    } else {
      await db.schema("bible").from("reading_completions").delete()
        .eq("user_id", userId).eq("plan_id", planId)
        .eq("day_number", dayNumber);
    }
  }

  // Mark the next `count` days' readings done, starting from the first day that
  // still has anything unread (catch-up for a whole week or month at once).
  async function bulkMarkDays(count: number) {
    const reads: any[] = plan?.readings ?? [];
    const firstInc = reads.find((d: any) => {
      const refs: string[] = d.readings ?? [d.reference ?? `Day ${d.day}`];
      return !refs.every((r) => completions[`${d.day}:${r}`]);
    });
    if (!firstInc) return;
    const start = firstInc.day;
    const targetDays = reads.filter((d: any) => d.day >= start && d.day < start + count);
    const rows: any[] = [];
    setCompletions((prev) => {
      const next = { ...prev };
      for (const d of targetDays) {
        const refs: string[] = d.readings ?? [d.reference ?? `Day ${d.day}`];
        for (const r of refs) {
          next[`${d.day}:${r}`] = true;
          rows.push({ user_id: userId, plan_id: planId, day_number: d.day, reading_ref: r });
        }
      }
      return next;
    });
    if (rows.length) {
      await db.schema("bible").from("reading_completions").upsert(rows, { onConflict: "user_id,plan_id,day_number,reading_ref" });
    }
  }

  function jumpToDay(dayNumber: string) {
    if (typeof document === "undefined") return;
    document.getElementById(`plan-day-${dayNumber}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (isBuiltIn) {
    return (
      <div style={{ paddingTop: 8, paddingBottom: 40 }}>
        <h1 className="ios-large-title" style={{ padding: "8px var(--ios-gutter) 4px" }}>
          {planId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </h1>
        <Group footer="This built-in plan can be started from the Plans page. Custom AI-generated plans support full progress tracking.">
          <Cell
            lead={<span className="ios-icon" style={{ background: "var(--ios-tint)" }}><Icons.SparkleIcon /></span>}
            title="Generate a custom plan"
            subtitle="Full day-by-day progress tracking"
            href="/bible/plans/generate"
          />
        </Group>
      </div>
    );
  }

  if (!plan) return null;

  const readings: any[] = plan.readings ?? [];
  // Calendar date for each plan day = start date + (day - 1). "Day 1" is the
  // day you started the plan.
  const startDate = userPlan?.started_at ? new Date(userPlan.started_at) : null;
  function dateForDay(dayNum: number): string | null {
    if (!startDate || isNaN(startDate.getTime())) return null;
    const d = new Date(startDate.getTime() + (dayNum - 1) * 86_400_000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  const totalReadings = readings.reduce((acc: number, day: any) => acc + (day.readings?.length ?? 1), 0);
  const completed = Object.values(completions).filter(Boolean).length;
  const pct = totalReadings > 0 ? Math.round((completed / totalReadings) * 100) : 0;

  // First incomplete day → marked as "today"
  const firstIncomplete = readings.find((d: any) => {
    const refs: string[] = d.readings ?? [d.reference ?? `Day ${d.day}`];
    return !refs.every((r) => completions[`${d.day}:${r}`]);
  });

  return (
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>
      <h1 className="ios-large-title" style={{ padding: "8px var(--ios-gutter) 2px" }}>
        {plan.title}
      </h1>
      {plan.description && (
        <p className="ios-subhead" style={{ color: "var(--ios-label-2)", margin: 0, padding: "0 var(--ios-gutter) 12px" }}>
          {plan.description}
        </p>
      )}

      {/* Progress bar */}
      {enrolled && (
        <div style={{ padding: "0 var(--ios-gutter) 4px" }}>
          <div className="ios-footnote" style={{ display: "flex", justifyContent: "space-between", color: "var(--ios-label-2)", marginBottom: 6 }}>
            <span>{completed} of {totalReadings} readings done</span>
            <span className="ios-num" style={{ color: "var(--ios-label)", fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 8, background: "var(--ios-fill)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--ios-tint)", borderRadius: 4, transition: "width 300ms" }} />
          </div>
        </div>
      )}

      {/* Quick controls — jump to a day, or catch up a week/month at once */}
      {enrolled && readings.length > 1 && (
        <div style={{ display: "flex", gap: 8, padding: "10px var(--ios-gutter) 2px", flexWrap: "wrap", alignItems: "center" }}>
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) { jumpToDay(e.target.value); e.currentTarget.value = ""; } }}
            aria-label="Jump to day"
            style={{ flex: "1 1 130px", minWidth: 120, padding: "9px 10px", background: "var(--ios-fill)", border: "none", borderRadius: 10, color: "var(--ios-label)", fontSize: 15, appearance: "none", WebkitAppearance: "none" }}
          >
            <option value="">Jump to day…</option>
            {readings.map((d: any) => {
              const dt = dateForDay(d.day);
              return <option key={d.day} value={d.day}>{dt ? `${dt} · Day ${d.day}` : `Day ${d.day}`}</option>;
            })}
          </select>
          <button className="ios-btn" onClick={() => bulkMarkDays(7)} style={{ background: "var(--ios-fill)", color: "var(--ios-tint)", padding: "9px 14px", fontWeight: 600, flexShrink: 0 }}>Mark week done</button>
          <button className="ios-btn" onClick={() => bulkMarkDays(30)} style={{ background: "var(--ios-fill)", color: "var(--ios-tint)", padding: "9px 14px", fontWeight: 600, flexShrink: 0 }}>Mark month done</button>
        </div>
      )}

      {/* Enroll CTA */}
      {!enrolled && (
        <Group header="Start" footer="Track your progress day by day.">
          <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
            <span className="ios-headline">Start this plan</span>
            <button
              className="ios-btn ios-btn--primary"
              onClick={enroll}
              disabled={enrolling}
            >
              {enrolling ? "Starting…" : "Start plan"}
            </button>
          </div>
        </Group>
      )}

      {/* Day list */}
      {readings.map((day: any) => {
        const dayReadings: string[] = day.readings ?? [day.reference ?? `Day ${day.day}`];
        const allDone = dayReadings.every((ref) => completions[`${day.day}:${ref}`]);
        const isToday = enrolled && firstIncomplete?.day === day.day;

        return (
          <Group
            key={day.day}
            id={`plan-day-${day.day}`}
            header={
              <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>
                  {dateForDay(day.day) && (
                    <span style={{ color: "var(--ios-label-2)", fontWeight: 400 }}>{dateForDay(day.day)} · </span>
                  )}
                  Day {day.day}
                  {isToday && <span style={{ color: "var(--ios-orange)" }}> · Today</span>}
                </span>
                {allDone && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--ios-green)" }}>
                    <CheckMark size={12} /> Complete
                  </span>
                )}
              </span>
            }
            style={{ opacity: allDone ? 0.6 : 1 }}
          >
            {/* One-tap bulk toggle for the whole day */}
            {enrolled && (
              <Cell
                insetSeparator
                chevron={false}
                onClick={() => toggleDay(day.day, dayReadings)}
                ariaLabel={allDone ? `Mark day ${day.day} not read` : `Mark all readings of day ${day.day} read`}
                lead={
                  <span style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    border: allDone ? "none" : "1.7px solid var(--ios-tint)",
                    background: allDone ? "var(--ios-green)" : "transparent",
                    color: "var(--ios-on-tint)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {allDone && <CheckMark />}
                  </span>
                }
                title={
                  <span style={{
                    fontSize: isToday ? 17 : 16,
                    fontWeight: isToday ? 700 : 600,
                    color: allDone ? "var(--ios-label-2)" : "var(--ios-tint)",
                  }}>
                    {allDone
                      ? "Mark day not read"
                      : isToday
                      ? "Mark today complete"
                      : "Mark all read"}
                  </span>
                }
              />
            )}
            {dayReadings.map((ref) => {
              const key = `${day.day}:${ref}`;
              const done = completions[key];
              const parsed = parseRef(ref);

              return (
                <Cell
                  key={ref}
                  insetSeparator
                  lead={enrolled ? (
                    <button
                      onClick={() => toggleReading(day.day, ref)}
                      aria-label={done ? "Mark incomplete" : "Mark complete"}
                      style={{
                        width: 26, height: 26, borderRadius: "50%", flexShrink: 0, padding: 0,
                        border: done ? "none" : "1.7px solid var(--ios-separator)",
                        background: done ? "var(--ios-green)" : "transparent",
                        color: "var(--ios-on-tint)", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {done && <CheckMark />}
                    </button>
                  ) : undefined}
                  title={
                    <span style={{
                      fontSize: 16, lineHeight: 1.4,
                      color: done ? "var(--ios-label-3)" : "var(--ios-label)",
                      textDecoration: done ? "line-through" : "none",
                    }}>
                      {ref}
                    </span>
                  }
                  trailing={parsed ? (
                    <Link
                      href={`/bible/read/${parsed.bookId}/${parsed.chapter}`}
                      style={{
                        padding: "4px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: "var(--ios-tint)", color: "var(--ios-on-tint)", textDecoration: "none",
                        display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
                      }}
                    >
                      <Icons.BookIcon style={{ width: 15, height: 15 }} aria-hidden />
                      Read
                    </Link>
                  ) : undefined}
                />
              );
            })}
          </Group>
        );
      })}
    </div>
  );
}
