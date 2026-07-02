"use client";

import { useMemo, useState } from "react";
import { MODULE_DOT, MODULE_BADGE } from "@/app/home/_components/FamilyTimeline";

interface CalendarEvent {
  id: string;
  date: string;
  time: string | null;
  timeLabel: string;
  title: string;
  module: string;
  category: string;
  href?: string;
  person: string;
  personLabel?: string;
}

interface Member {
  id: string;
  label: string;
}

interface Props {
  view: "month" | "week";
  anchorDate: string;
  todayStr: string;
  rangeStart: string;
  rangeEnd: string;
  events: CalendarEvent[];
  members: Member[];
  /** When true, renders inline (e.g. on the Family page) without the
   *  prev/next/today nav arrows or Month/Week view toggle — just the
   *  calendar grid and person filter chips. Defaults to false. */
  embedded?: boolean;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function dayLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function navHref(view: "month" | "week", date: string): string {
  return `/home/family/calendar?view=${view}&date=${date}`;
}

export default function CalendarClient({ view, anchorDate, todayStr, rangeStart, rangeEnd, events, members, embedded = false }: Props) {
  const [personFilter, setPersonFilter] = useState<string>("everyone");
  const [selectedDate, setSelectedDate] = useState<string | null>(view === "week" ? null : todayStr);

  const filtered = useMemo(() => {
    if (personFilter === "everyone") return events;
    return events.filter((e) => e.person === personFilter);
  }, [events, personFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of filtered) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [filtered]);

  const days: string[] = useMemo(() => {
    const result: string[] = [];
    let d = rangeStart;
    while (d <= rangeEnd) {
      result.push(d);
      d = addDays(d, 1);
    }
    return result;
  }, [rangeStart, rangeEnd]);

  const currentMonth = anchorDate.slice(0, 7);
  const prevAnchor = view === "week" ? addDays(anchorDate, -7) : addDays(`${currentMonth}-01`, -1);
  const nextAnchor = view === "week" ? addDays(anchorDate, 7) : addDays(rangeEnd, 1);

  const chips: Array<{ id: string; label: string }> = [
    { id: "everyone", label: "Everyone" },
    { id: "me", label: "Me" },
    ...members,
  ];

  const chip = (label: string, color: string): React.CSSProperties => ({
    fontSize: 9, fontWeight: 700, letterSpacing: "0.04em",
    padding: "1px 6px", borderRadius: 6,
    background: `${color}15`, color,
    fontFamily: "var(--font-geist, system-ui), sans-serif",
  });

  return (
    <div>
      {/* ── Header: nav + view toggle ── */}
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href={navHref(view, prevAnchor)} aria-label="Previous" style={navBtn}>‹</a>
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif", minWidth: 160, textAlign: "center" }}>
              {view === "month" ? monthLabel(anchorDate) : `Week of ${new Date(`${rangeStart}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </span>
            <a href={navHref(view, nextAnchor)} aria-label="Next" style={navBtn}>›</a>
            <a href={navHref(view, todayStr)} style={{ ...navBtn, width: "auto", padding: "0 12px", fontSize: 12 }}>Today</a>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <a href={navHref("month", anchorDate)} style={toggleBtn(view === "month")}>Month</a>
            <a href={navHref("week", anchorDate)} style={toggleBtn(view === "week")}>Week</a>
          </div>
        </div>
      )}

      {/* ── Person filter chips ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {chips.map((c) => {
          const active = personFilter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setPersonFilter(c.id)}
              aria-pressed={active}
              style={{
                padding: "4px 12px", borderRadius: 20,
                border: active ? "1.5px solid var(--color-accent)" : "1px solid var(--color-rule)",
                background: active ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                color: active ? "var(--color-accent)" : "var(--color-ink-3)",
                fontSize: 12, fontWeight: active ? 600 : 500, cursor: "pointer",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {view === "month" ? (
        <>
          {/* ── Month grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "var(--color-rule)", border: "1px solid var(--color-rule)", borderRadius: 12, overflow: "hidden" }}>
            {WEEKDAY_LABELS.map((wd) => (
              <div key={wd} style={{ background: "var(--color-bg-deep)", padding: "6px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                {wd}
              </div>
            ))}
            {days.map((d) => {
              const inMonth = d.slice(0, 7) === currentMonth;
              const isToday = d === todayStr;
              const isSelected = d === selectedDate;
              const dayEvents = eventsByDate.get(d) ?? [];
              const dayNum = Number(d.slice(8, 10));
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  style={{
                    background: isSelected ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                    border: "none", textAlign: "left", cursor: "pointer",
                    padding: "6px 6px 8px", minHeight: 84, display: "flex", flexDirection: "column", gap: 3,
                    opacity: inMonth ? 1 : 0.4,
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: isToday ? 700 : 500,
                    color: isToday ? "var(--color-accent)" : "var(--color-ink-3)",
                    fontFamily: "var(--font-geist, system-ui), sans-serif",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 18, height: 18, borderRadius: "50%",
                    background: isToday ? "var(--color-accent)" : "transparent",
                    ...(isToday ? { color: "#FFFDF8" } : {}),
                  }}>
                    {dayNum}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {dayEvents.slice(0, 3).map((e) => (
                      <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--color-ink-3)", fontFamily: "var(--font-geist, system-ui), sans-serif", overflow: "hidden" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: MODULE_DOT[e.category] ?? MODULE_DOT[e.module] ?? "var(--color-ink-4)", flexShrink: 0 }} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: 9, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Selected day detail ── */}
          {selectedDate && (
            <DayDetail date={selectedDate} events={eventsByDate.get(selectedDate) ?? []} />
          )}
        </>
      ) : (
        <>
          {/* ── Week grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
            {days.map((d) => {
              const isToday = d === todayStr;
              const dayEvents = eventsByDate.get(d) ?? [];
              return (
                <div key={d} style={{ background: "var(--color-bg-card)", border: isToday ? "1.5px solid var(--color-accent)" : "1px solid var(--color-rule)", borderRadius: 10, padding: "8px 10px", minHeight: 160 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isToday ? "var(--color-accent)" : "var(--color-ink-3)", fontFamily: "var(--font-geist, system-ui), sans-serif", marginBottom: 6 }}>
                    {new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {dayEvents.length === 0 && (
                      <span style={{ fontSize: 11, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>—</span>
                    )}
                    {dayEvents.map((e) => {
                      const dotColor = MODULE_DOT[e.category] ?? MODULE_DOT[e.module] ?? "var(--color-ink-3)";
                      const badge = e.personLabel ?? MODULE_BADGE[e.module] ?? MODULE_BADGE[e.category];
                      const body = (
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{e.timeLabel}</span>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif", lineHeight: 1.3 }}>{e.title}</span>
                          {badge && <span style={chip(badge, dotColor)}>{badge}</span>}
                        </div>
                      );
                      return e.href ? (
                        <a key={e.id} href={e.href} style={{ textDecoration: "none" }}>{body}</a>
                      ) : (
                        <div key={e.id}>{body}</div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DayDetail({ date, events }: { date: string; events: CalendarEvent[] }) {
  return (
    <div style={{ marginTop: 16, background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 10, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
        {dayLabel(date)}
      </div>
      {events.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Nothing scheduled.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map((e) => {
            const dotColor = MODULE_DOT[e.category] ?? MODULE_DOT[e.module] ?? "var(--color-ink-3)";
            const badge = e.personLabel ?? MODULE_BADGE[e.module] ?? MODULE_BADGE[e.category];
            const row = (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "var(--color-ink-4)", minWidth: 64, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{e.timeLabel}</span>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif", flex: 1 }}>{e.title}</span>
                {badge && <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: dotColor, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{badge}</span>}
              </div>
            );
            return e.href ? (
              <a key={e.id} href={e.href} style={{ textDecoration: "none" }}>{row}</a>
            ) : (
              <div key={e.id}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 28, height: 28, borderRadius: 8, border: "1px solid var(--color-rule)",
  background: "var(--color-bg-card)", color: "var(--color-ink-3)",
  textDecoration: "none", fontSize: 16, fontFamily: "var(--font-geist, system-ui), sans-serif",
};

function toggleBtn(active: boolean): React.CSSProperties {
  return {
    padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 500,
    border: active ? "1.5px solid var(--color-accent)" : "1px solid var(--color-rule)",
    background: active ? "var(--color-accent-soft)" : "var(--color-bg-card)",
    color: active ? "var(--color-accent)" : "var(--color-ink-3)",
    textDecoration: "none", fontFamily: "var(--font-geist, system-ui), sans-serif",
  };
}
