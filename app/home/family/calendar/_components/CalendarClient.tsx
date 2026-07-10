"use client";

import { useMemo, useState } from "react";
import { Chip, Icons } from "@/components/ios";
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
  });

  return (
    <div>
      {/* ── Header: nav + view toggle ── */}
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a href={navHref(view, prevAnchor)} aria-label="Previous" style={navBtn}><Icons.ChevronLeft style={{ width: 18, height: 18 }} /></a>
            <span className="ios-headline" style={{ minWidth: 150, textAlign: "center" }}>
              {view === "month" ? monthLabel(anchorDate) : `Week of ${new Date(`${rangeStart}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            </span>
            <a href={navHref(view, nextAnchor)} aria-label="Next" style={navBtn}><Icons.ChevronRight style={{ width: 18, height: 18 }} /></a>
            <a href={navHref(view, todayStr)} className="ios-subhead" style={{ color: "var(--ios-tint)", fontWeight: 500, padding: "0 6px" }}>Today</a>
          </div>
          <div style={{ display: "flex", gap: 2, padding: 2, background: "var(--ios-fill)", borderRadius: 9, flex: "0 0 auto" }}>
            <a href={navHref("month", anchorDate)} style={segLink(view === "month")}>Month</a>
            <a href={navHref("week", anchorDate)} style={segLink(view === "week")}>Week</a>
          </div>
        </div>
      )}

      {/* ── Person filter chips ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {chips.map((c) => (
          <Chip key={c.id} small selected={personFilter === c.id} onClick={() => setPersonFilter(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>

      {view === "month" ? (
        <>
          {/* ── Month grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "var(--ios-separator)", borderRadius: "var(--ios-radius-card)", overflow: "hidden" }}>
            {WEEKDAY_LABELS.map((wd) => (
              <div key={wd} className="ios-caption" style={{ background: "var(--ios-bg)", padding: "6px 8px", fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--ios-label-2)" }}>
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
                    background: isSelected ? "var(--ios-fill)" : "var(--ios-cell)",
                    textAlign: "left",
                    padding: "6px 6px 8px", minHeight: 84, display: "flex", flexDirection: "column", gap: 3,
                    opacity: inMonth ? 1 : 0.4,
                  }}
                >
                  <span className="ios-num" style={{
                    fontSize: 13, fontWeight: isToday ? 700 : 500,
                    color: isToday ? "#fff" : "var(--ios-label)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 22, height: 22, borderRadius: "50%",
                    background: isToday ? "var(--ios-tint)" : "transparent",
                  }}>
                    {dayNum}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {dayEvents.slice(0, 3).map((e) => (
                      <div key={e.id} className="ios-caption" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--ios-label-2)", overflow: "hidden" }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: MODULE_DOT[e.category] ?? MODULE_DOT[e.module] ?? "var(--ios-label-3)", flexShrink: 0 }} />
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
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
                <div key={d} style={{ background: "var(--ios-cell)", boxShadow: isToday ? "inset 0 0 0 1.5px var(--ios-tint)" : undefined, borderRadius: "var(--ios-radius-card)", padding: "8px 10px", minHeight: 160 }}>
                  <div className="ios-caption ios-num" style={{ fontWeight: 700, color: isToday ? "var(--ios-tint)" : "var(--ios-label-2)", marginBottom: 6 }}>
                    {new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {dayEvents.length === 0 && (
                      <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>—</span>
                    )}
                    {dayEvents.map((e) => {
                      const dotColor = MODULE_DOT[e.category] ?? MODULE_DOT[e.module] ?? "var(--ios-label-2)";
                      const badge = e.personLabel ?? MODULE_BADGE[e.module] ?? MODULE_BADGE[e.category];
                      const body = (
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                            <span className="ios-caption ios-num" style={{ color: "var(--ios-label-3)" }}>{e.timeLabel}</span>
                          </div>
                          <span className="ios-caption" style={{ color: "var(--ios-label)", lineHeight: 1.3 }}>{e.title}</span>
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
    <div style={{ marginTop: 16 }}>
      <h3 className="ios-group-header">{dayLabel(date)}</h3>
      {events.length === 0 ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "0 var(--ios-gutter)" }}>Nothing scheduled.</p>
      ) : (
        <div className="ios-list" style={{ margin: 0 }}>
          {events.map((e) => {
            const dotColor = MODULE_DOT[e.category] ?? MODULE_DOT[e.module] ?? "var(--ios-label-2)";
            const badge = e.personLabel ?? MODULE_BADGE[e.module] ?? MODULE_BADGE[e.category];
            const inner = (
              <>
                <span className="ios-cell-lead ios-caption ios-num" style={{ color: "var(--ios-label-2)", minWidth: 64, justifyContent: "flex-start" }}>{e.timeLabel}</span>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                <span className="ios-cell-body"><span className="ios-cell-title ios-subhead">{e.title}</span></span>
                {badge && <span className="ios-caption" style={{ fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: dotColor, flexShrink: 0 }}>{badge}</span>}
              </>
            );
            return e.href ? (
              <a key={e.id} href={e.href} className="ios-cell">{inner}</a>
            ) : (
              <div key={e.id} className="ios-cell">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 30, height: 30, borderRadius: "50%",
  background: "var(--ios-fill)", color: "var(--ios-tint)",
  textDecoration: "none",
};

function segLink(active: boolean): React.CSSProperties {
  return {
    padding: "6px 14px", borderRadius: 7, fontSize: 14, fontWeight: active ? 600 : 500,
    textAlign: "center",
    background: active ? "var(--ios-bg-elevated)" : "transparent",
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04)" : "none",
    color: "var(--ios-label)", textDecoration: "none",
  };
}
