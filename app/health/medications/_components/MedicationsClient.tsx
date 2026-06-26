"use client";

import { useState, useTransition, useEffect } from "react";
import { addMedication, updateMedication, removeMedication } from "../actions";

export interface Med {
  id: string;
  name: string;
  dose: string;
  schedule: string;
}

const COMMON_MEDS = [
  { name: "Vitamin D3",   dose: "5000 IU", schedule: "Daily · AM" },
  { name: "Magnesium",    dose: "400 mg",  schedule: "Daily · PM" },
  { name: "Omega-3",      dose: "2 g",     schedule: "Daily · AM" },
  { name: "Creatine",     dose: "5 g",     schedule: "Daily · AM" },
  { name: "Multivitamin", dose: "1 tab",   schedule: "Daily · AM" },
  { name: "Zinc",         dose: "15 mg",   schedule: "Daily · PM" },
  { name: "Probiotic",    dose: "1 cap",   schedule: "Daily · AM" },
  { name: "GLP-1",        dose: "5 mg",    schedule: "Weekly · Tue" },
];

const SCHEDULES = [
  "Daily · AM",
  "Daily · PM",
  "Twice daily",
  "Weekly · Mon",
  "Weekly · Tue",
  "Weekly · Wed",
  "Weekly · Thu",
  "Weekly · Fri",
  "Weekly · Sat",
  "Weekly · Sun",
  "As needed",
];

const ZEPBOUND_DOSES = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20];
const INJECTION_SITES = ["L Abdomen", "R Abdomen", "L Thigh", "R Thigh", "L Upper Arm", "R Upper Arm"];
const ZEPBOUND_KEY = "zepbound-tracker";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ZepboundLog { date: string; dose: number; site: string }
interface ZepboundData {
  dose: number;
  injectionDay: string;
  siteIndex: number;
  logs: ZepboundLog[];
}

function ZepboundCard() {
  const [data, setData] = useState<ZepboundData | null>(null);
  const [editingDose, setEditingDose] = useState(false);
  const [editingDay, setEditingDay] = useState(false);
  const [editingSite, setEditingSite] = useState(false);
  const [editHistory, setEditHistory] = useState(false);
  const [editingLogDate, setEditingLogDate] = useState<string | null>(null);
  const [showBackdate, setShowBackdate] = useState(false);
  const [backdateDate, setBackdateDate] = useState("");
  const [backdateDose, setBackdateDose] = useState<number | null>(null);
  const [backdateSite, setBackdateSite] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ZEPBOUND_KEY);
      if (raw) setData(JSON.parse(raw));
      // No auto-init — only show if the user has previously saved data
    } catch { /* ignore */ }
  }, []);

  function save(next: ZepboundData) {
    setData(next);
    try { localStorage.setItem(ZEPBOUND_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function logDose() {
    if (!data) return;
    const today = new Date().toLocaleDateString("sv");
    const alreadyToday = data.logs[data.logs.length - 1]?.date === today;
    if (alreadyToday) return;
    const site = INJECTION_SITES[data.siteIndex];
    const nextSiteIndex = (data.siteIndex + 1) % INJECTION_SITES.length;
    save({ ...data, siteIndex: nextSiteIndex, logs: [...data.logs, { date: today, dose: data.dose, site }] });
  }

  function openBackdate() {
    if (!data) return;
    setBackdateDate("");
    setBackdateDose(data.dose);
    setBackdateSite(INJECTION_SITES[data.siteIndex]);
    setShowBackdate(true);
  }

  function saveBackdate() {
    if (!data || !backdateDate || !backdateDose || !backdateSite) return;
    const alreadyLogged = data.logs.some((l) => l.date === backdateDate);
    if (alreadyLogged) return;
    const newLog: ZepboundLog = { date: backdateDate, dose: backdateDose, site: backdateSite };
    const sorted = [...data.logs, newLog].sort((a, b) => a.date.localeCompare(b.date));
    save({ ...data, logs: sorted });
    setShowBackdate(false);
  }

  function deleteLog(date: string) {
    if (!data) return;
    save({ ...data, logs: data.logs.filter((l) => l.date !== date) });
  }

  function updateLog(date: string, patch: Partial<ZepboundLog>) {
    if (!data) return;
    save({ ...data, logs: data.logs.map((l) => l.date === date ? { ...l, ...patch } : l) });
    setEditingLogDate(null);
  }

  function nextInjectionDays(): string {
    if (!data) return "—";
    const todayIdx = new Date().getDay();
    const targetIdx = DAYS.indexOf(data.injectionDay);
    const diff = ((targetIdx - todayIdx) + 7) % 7;
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `In ${diff} days`;
  }

  if (!data) return null;

  const today = new Date().toLocaleDateString("sv");
  const loggedToday = data.logs[data.logs.length - 1]?.date === today;
  const nextSite = INJECTION_SITES[data.siteIndex];
  const allLogs = [...data.logs].reverse();

  // Group logs by month
  const byMonth = new Map<string, ZepboundLog[]>();
  for (const log of allLogs) {
    const d = new Date(log.date + "T12:00:00");
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(log);
  }

  return (
    <div
      style={{
        background: "var(--color-bg-raised)",
        border: "1px solid var(--color-line)",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      {/* Header */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--color-line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div
              style={{
                fontSize: 10, fontWeight: 500, letterSpacing: "0.14em",
                textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 4,
              }}
            >
              GLP-1 · Zepbound
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 28,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                  color: "var(--color-ink)",
                  lineHeight: 1,
                }}
              >
                {data.dose} mg
              </div>
              <div style={{ fontSize: 12, color: "var(--color-ink-4)" }}>
                {data.injectionDay}s
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginBottom: 2 }}>Next dose</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: loggedToday ? "var(--color-moss)" : "var(--color-ink)" }}>
              {loggedToday ? "✓ Logged" : nextInjectionDays()}
            </div>
          </div>
        </div>
      </div>

      {/* Dose escalation */}
      {editingDose && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-line)" }}>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 8 }}>
            Current dose
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ZEPBOUND_DOSES.map((d) => (
              <button
                key={d}
                onClick={() => { save({ ...data, dose: d }); setEditingDose(false); }}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: `1px solid ${data.dose === d ? "var(--color-accent)" : "var(--color-line)"}`,
                  background: data.dose === d ? "var(--color-accent-soft)" : "var(--color-bg-sunk)",
                  color: data.dose === d ? "var(--color-accent)" : "var(--color-ink-2)",
                  fontSize: 13,
                  fontWeight: data.dose === d ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {d} mg
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Injection day picker */}
      {editingDay && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--color-line)" }}>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 8 }}>
            Injection day
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DAYS.map((d) => (
              <button
                key={d}
                onClick={() => { save({ ...data, injectionDay: d }); setEditingDay(false); }}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: `1px solid ${data.injectionDay === d ? "var(--color-slate)" : "var(--color-line)"}`,
                  background: data.injectionDay === d ? "var(--color-slate-soft)" : "var(--color-bg-sunk)",
                  color: data.injectionDay === d ? "var(--color-slate)" : "var(--color-ink-2)",
                  fontSize: 13,
                  fontWeight: data.injectionDay === d ? 600 : 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Next injection site + log action */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginBottom: 3 }}>Next injection site</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>{nextSite}</div>
            <button
              onClick={() => setEditingSite((v) => !v)}
              style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: "1px solid var(--color-line)", background: editingSite ? "var(--color-ink)" : "var(--color-bg-sunk)", color: editingSite ? "var(--color-bg)" : "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit" }}
            >
              Override
            </button>
          </div>
        </div>
        <button
          onClick={logDose}
          disabled={loggedToday}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: loggedToday ? "var(--color-bg-sunk)" : "var(--color-moss)",
            color: loggedToday ? "var(--color-ink-4)" : "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: loggedToday ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          {loggedToday ? "✓ Done" : "Log Dose"}
        </button>
      </div>
      {editingSite && data && (
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
            Select next site
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {INJECTION_SITES.map((s, idx) => (
              <button
                key={s}
                onClick={() => { save({ ...data, siteIndex: idx }); setEditingSite(false); }}
                style={{
                  padding: "7px 12px", borderRadius: 8,
                  border: `1px solid ${data.siteIndex === idx ? "var(--color-slate)" : "var(--color-line)"}`,
                  background: data.siteIndex === idx ? "var(--color-slate-soft)" : "var(--color-bg-sunk)",
                  color: data.siteIndex === idx ? "var(--color-slate)" : "var(--color-ink-2)",
                  fontSize: 13, fontWeight: data.siteIndex === idx ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Backdate form */}
      {showBackdate && data && (
        <div style={{ margin: "0 16px 12px", background: "var(--color-bg-sunk)", border: "1px solid var(--color-line)", borderRadius: 10, padding: "12px" }}>
          <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10 }}>
            Log a past dose
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 5 }}>Date</div>
            <input
              type="date"
              value={backdateDate}
              max={new Date().toLocaleDateString("sv")}
              onChange={(e) => setBackdateDate(e.target.value)}
              style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid var(--color-line)", background: "var(--color-bg-raised)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
            {backdateDate && data.logs.some((l) => l.date === backdateDate) && (
              <div style={{ fontSize: 11, color: "var(--color-accent)", marginTop: 4 }}>Already logged on this date</div>
            )}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 5 }}>Dose</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {ZEPBOUND_DOSES.map((d) => (
                <button key={d} onClick={() => setBackdateDose(d)}
                  style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${backdateDose === d ? "var(--color-accent)" : "var(--color-line)"}`, background: backdateDose === d ? "var(--color-accent-soft)" : "var(--color-bg-raised)", color: backdateDose === d ? "var(--color-accent)" : "var(--color-ink-2)", fontSize: 12, fontWeight: backdateDose === d ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                  {d} mg
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 5 }}>Injection site</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {INJECTION_SITES.map((s) => (
                <button key={s} onClick={() => setBackdateSite(s)}
                  style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${backdateSite === s ? "var(--color-slate)" : "var(--color-line)"}`, background: backdateSite === s ? "var(--color-slate-soft)" : "var(--color-bg-raised)", color: backdateSite === s ? "var(--color-slate)" : "var(--color-ink-2)", fontSize: 12, fontWeight: backdateSite === s ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={saveBackdate}
              disabled={!backdateDate || !backdateDose || !backdateSite || data.logs.some((l) => l.date === backdateDate)}
              style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: (backdateDate && backdateDose && backdateSite && !data.logs.some((l) => l.date === backdateDate)) ? "var(--color-moss)" : "var(--color-bg-raised)", color: (backdateDate && backdateDose && backdateSite && !data.logs.some((l) => l.date === backdateDate)) ? "#fff" : "var(--color-ink-4)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Save
            </button>
            <button onClick={() => setShowBackdate(false)} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-ink-3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Config buttons */}
      <div style={{ padding: "0 16px 12px", display: "flex", gap: 8 }}>
        <button
          onClick={() => { setEditingDose((v) => !v); setEditingDay(false); }}
          style={{
            padding: "6px 12px", borderRadius: 8,
            border: "1px solid var(--color-line)",
            background: editingDose ? "var(--color-ink)" : "var(--color-bg-sunk)",
            color: editingDose ? "var(--color-bg)" : "var(--color-ink-3)",
            fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Change dose
        </button>
        <button
          onClick={() => { setEditingDay((v) => !v); setEditingDose(false); }}
          style={{
            padding: "6px 12px", borderRadius: 8,
            border: "1px solid var(--color-line)",
            background: editingDay ? "var(--color-ink)" : "var(--color-bg-sunk)",
            color: editingDay ? "var(--color-bg)" : "var(--color-ink-3)",
            fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Change day
        </button>
        <button
          onClick={openBackdate}
          style={{
            padding: "6px 12px", borderRadius: 8,
            border: "1px solid var(--color-line)",
            background: showBackdate ? "var(--color-ink)" : "var(--color-bg-sunk)",
            color: showBackdate ? "var(--color-bg)" : "var(--color-ink-3)",
            fontSize: 11, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Log past dose
        </button>
      </div>

      {/* Dose history */}
      {allLogs.length > 0 && (
        <div style={{ borderTop: "1px solid var(--color-line)", padding: "12px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
              Dose history · {allLogs.length} injection{allLogs.length !== 1 ? "s" : ""}
            </div>
            <button
              onClick={() => { setEditHistory((v) => !v); setEditingLogDate(null); }}
              style={{ background: "none", border: "none", color: editHistory ? "var(--color-accent)" : "var(--color-ink-3)", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase", padding: 0 }}
            >
              {editHistory ? "Done" : "Edit"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Array.from(byMonth.entries()).map(([month, logs]) => (
              <div key={month}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-4)", marginBottom: 6, letterSpacing: "0.06em" }}>
                  {month}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {logs.map((log, i) => {
                    const d = new Date(log.date + "T12:00:00");
                    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    const isFirst = i === 0 && month === Array.from(byMonth.keys())[0];
                    const isEditing = editingLogDate === log.date;
                    return (
                      <div key={log.date}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "7px 10px",
                            borderRadius: isEditing ? "8px 8px 0 0" : 8,
                            background: isFirst ? "var(--color-moss-soft)" : "var(--color-bg-sunk)",
                            cursor: editHistory ? "pointer" : "default",
                          }}
                          onClick={() => editHistory && setEditingLogDate(isEditing ? null : log.date)}
                        >
                          {editHistory && (
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteLog(log.date); }}
                              style={{ width: 22, height: 22, borderRadius: 11, background: "var(--color-accent)", border: "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, lineHeight: 1, fontWeight: 300, fontFamily: "inherit" }}
                            >
                              −
                            </button>
                          )}
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 12, color: "var(--color-ink-2)", fontWeight: 500 }}>{dayLabel}</span>
                            <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-ink-4)" }}>{log.site}</span>
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--color-ink)" }}>
                            {log.dose} mg
                          </div>
                          {editHistory && <span style={{ fontSize: 13, color: "var(--color-ink-4)" }}>{isEditing ? "▲" : "›"}</span>}
                        </div>
                        {isEditing && (
                          <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 10px 12px" }}>
                            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>Dose</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                              {ZEPBOUND_DOSES.map((d) => (
                                <button key={d} onClick={() => updateLog(log.date, { dose: d })}
                                  style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${log.dose === d ? "var(--color-accent)" : "var(--color-line)"}`, background: log.dose === d ? "var(--color-accent-soft)" : "var(--color-bg-sunk)", color: log.dose === d ? "var(--color-accent)" : "var(--color-ink-2)", fontSize: 12, fontWeight: log.dose === d ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                                  {d} mg
                                </button>
                              ))}
                            </div>
                            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>Site</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {INJECTION_SITES.map((s) => (
                                <button key={s} onClick={() => updateLog(log.date, { site: s })}
                                  style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${log.site === s ? "var(--color-slate)" : "var(--color-line)"}`, background: log.site === s ? "var(--color-slate-soft)" : "var(--color-bg-sunk)", color: log.site === s ? "var(--color-slate)" : "var(--color-ink-2)", fontSize: 12, fontWeight: log.site === s ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--color-ink-3)",
  marginBottom: 5,
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-line)",
  background: "var(--color-bg-sunk)",
  color: "var(--color-ink)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

// ── Shared sheet shell ─────────────────────────────────────────
function Sheet({ onClose, title, subtitle, children }: {
  onClose: () => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(22,20,15,0.45)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "var(--color-bg)",
          borderRadius: "20px 20px 0 0",
          padding: "0 18px 32px",
          maxHeight: "85vh",
          overflowY: "auto",
          animation: "slideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 6px" }}>
          <div style={{ width: 36, height: 4, background: "var(--color-line-2)", borderRadius: 2 }} />
        </div>
        <div style={fieldLabel}>{title}</div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
            marginBottom: 20,
          }}
        >
          {subtitle}
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Add sheet ──────────────────────────────────────────────────
function AddSheet({ onAdd, onClose }: {
  onAdd: (m: Omit<Med, "id">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [schedule, setSchedule] = useState("Daily · AM");

  const valid = name.trim().length > 0 && dose.trim().length > 0;

  const pick = (preset: (typeof COMMON_MEDS)[0]) => {
    setName(preset.name);
    setDose(preset.dose);
    setSchedule(preset.schedule);
  };

  return (
    <Sheet onClose={onClose} title="Add medication" subtitle="What are you taking?">
      <div style={{ ...fieldLabel, marginBottom: 8 }}>Common</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {COMMON_MEDS.map((m) => (
          <button
            key={m.name}
            onClick={() => pick(m)}
            style={{
              background: name === m.name ? "var(--color-ink)" : "var(--color-bg-sunk)",
              color: name === m.name ? "var(--color-bg)" : "var(--color-ink-2)",
              border: "none",
              borderRadius: 8,
              padding: "7px 11px",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 120ms, color 120ms",
            }}
          >
            {m.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={fieldLabel}>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vitamin D3" style={fieldInput} />
        </div>
        <div>
          <div style={fieldLabel}>Dose</div>
          <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="5000 IU" style={fieldInput} />
        </div>
        <div>
          <div style={fieldLabel}>Schedule</div>
          <select value={schedule} onChange={(e) => setSchedule(e.target.value)} style={fieldInput}>
            {SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <button
        disabled={!valid}
        onClick={() => valid && onAdd({ name: name.trim(), dose: dose.trim(), schedule })}
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: 12,
          border: "none",
          background: valid ? "var(--color-ink)" : "var(--color-bg-sunk)",
          color: valid ? "var(--color-bg)" : "var(--color-ink-3)",
          fontSize: 15,
          fontWeight: 600,
          cursor: valid ? "pointer" : "not-allowed",
          fontFamily: "inherit",
          transition: "background 120ms",
        }}
      >
        Add to my medications
      </button>
    </Sheet>
  );
}

// ── Edit sheet ─────────────────────────────────────────────────
function EditSheet({ med, onSave, onClose }: {
  med: Med;
  onSave: (id: string, data: Omit<Med, "id">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(med.name);
  const [dose, setDose] = useState(med.dose);
  const [schedule, setSchedule] = useState(med.schedule);

  const valid = name.trim().length > 0 && dose.trim().length > 0;
  const changed = name.trim() !== med.name || dose.trim() !== med.dose || schedule !== med.schedule;

  return (
    <Sheet onClose={onClose} title="Edit medication" subtitle="Update details">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={fieldLabel}>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={fieldInput} />
        </div>
        <div>
          <div style={fieldLabel}>Dose</div>
          <input value={dose} onChange={(e) => setDose(e.target.value)} style={fieldInput} />
        </div>
        <div>
          <div style={fieldLabel}>Schedule</div>
          <select value={schedule} onChange={(e) => setSchedule(e.target.value)} style={fieldInput}>
            {SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <button
        disabled={!valid || !changed}
        onClick={() => valid && changed && onSave(med.id, { name: name.trim(), dose: dose.trim(), schedule })}
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: 12,
          border: "none",
          background: valid && changed ? "var(--color-ink)" : "var(--color-bg-sunk)",
          color: valid && changed ? "var(--color-bg)" : "var(--color-ink-3)",
          fontSize: 15,
          fontWeight: 600,
          cursor: valid && changed ? "pointer" : "not-allowed",
          fontFamily: "inherit",
          transition: "background 120ms",
        }}
      >
        Save changes
      </button>
    </Sheet>
  );
}

const ZEPBOUND_ENABLED_KEY = "zepbound-enabled";

// ── Main component ─────────────────────────────────────────────
export default function MedicationsClient({ initialMeds }: { initialMeds: Med[] }) {
  const [meds, setMeds] = useState<Med[]>(initialMeds);
  const [taken, setTaken] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Med | null>(null);
  const [, startTransition] = useTransition();
  const [zepboundEnabled, setZepboundEnabled] = useState(false);

  useEffect(() => {
    setZepboundEnabled(localStorage.getItem(ZEPBOUND_ENABLED_KEY) === "true");
  }, []);

  function enableZepbound() {
    localStorage.setItem(ZEPBOUND_ENABLED_KEY, "true");
    if (!localStorage.getItem(ZEPBOUND_KEY)) {
      const initial: ZepboundData = { dose: 2.5, injectionDay: "Tuesday", siteIndex: 0, logs: [] };
      localStorage.setItem(ZEPBOUND_KEY, JSON.stringify(initial));
    }
    setZepboundEnabled(true);
  }

  function disableZepbound() {
    localStorage.removeItem(ZEPBOUND_ENABLED_KEY);
    localStorage.removeItem(ZEPBOUND_KEY);
    setZepboundEnabled(false);
  }

  const handleAdd = (data: Omit<Med, "id">) => {
    const tempId = `temp-${Date.now()}`;
    setMeds((prev) => [...prev, { id: tempId, ...data }]);
    setShowAdd(false);
    startTransition(async () => {
      const result = await addMedication(data);
      if (result.id) {
        setMeds((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: result.id! } : m)));
      } else {
        setMeds((prev) => prev.filter((m) => m.id !== tempId));
      }
    });
  };

  const handleUpdate = (id: string, data: Omit<Med, "id">) => {
    setMeds((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
    setEditTarget(null);
    startTransition(async () => {
      const result = await updateMedication(id, data);
      if (result.error) {
        setMeds((prev) => prev.map((m) => (m.id === id ? meds.find((o) => o.id === id)! : m)));
      }
    });
  };

  const handleRemove = (id: string) => {
    setMeds((prev) => prev.filter((m) => m.id !== id));
    startTransition(async () => {
      await removeMedication(id);
    });
  };

  return (
    <div>
      <div
        style={{
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-line)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {/* Tile header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px 10px",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
            }}
          >
            Medications
          </span>
          <button
            onClick={() => setEditMode((e) => !e)}
            style={{
              background: "none",
              border: "none",
              color: editMode ? "var(--color-accent)" : "var(--color-ink-3)",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: 0,
            }}
          >
            {editMode ? "Done" : "Edit"}
          </button>
        </div>

        {meds.length === 0 && !editMode && (
          <div
            style={{
              padding: "16px",
              borderTop: "1px solid var(--color-line)",
              fontSize: 13,
              color: "var(--color-ink-4)",
              textAlign: "center",
            }}
          >
            No medications yet
          </div>
        )}

        {meds.map((m) => {
          const isTaken = !!taken[m.id];
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderTop: "1px solid var(--color-line)",
              }}
            >
              {editMode ? (
                <button
                  onClick={() => handleRemove(m.id)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    background: "var(--color-accent)",
                    border: "none",
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 18,
                    lineHeight: 1,
                    fontWeight: 300,
                    fontFamily: "inherit",
                  }}
                >
                  −
                </button>
              ) : (
                <button
                  onClick={() => setTaken((t) => ({ ...t, [m.id]: !t[m.id] }))}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: isTaken ? "var(--color-moss)" : "transparent",
                    border: isTaken ? "none" : "1.5px solid var(--color-line-2)",
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "inherit",
                    transition: "background 120ms",
                  }}
                >
                  {isTaken && <span style={{ color: "#fff", fontSize: 13, lineHeight: 1 }}>✓</span>}
                </button>
              )}

              {/* Row body — tappable in edit mode to open edit sheet */}
              <div
                style={{ flex: 1, minWidth: 0, cursor: editMode ? "pointer" : "default" }}
                onClick={() => editMode && setEditTarget(m)}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink)" }}>
                    {m.name}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-ink-3)" }}>
                    {m.dose}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 1 }}>
                  {m.schedule}
                </div>
              </div>

              {editMode && (
                <button
                  onClick={() => setEditTarget(m)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--color-ink-3)",
                    fontSize: 16,
                    cursor: "pointer",
                    padding: "0 4px",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  ›
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={() => { setEditMode(false); setShowAdd(true); }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: "transparent",
            border: "none",
            borderTop: "1px solid var(--color-line)",
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: "var(--color-bg-sunk)",
              border: "1.5px dashed var(--color-line-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 18,
              color: "var(--color-ink-3)",
              lineHeight: 1,
            }}
          >
            +
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink-2)" }}>
            Add medication
          </span>
        </button>
      </div>

      {/* Zepbound tracker — opt-in */}
      {zepboundEnabled ? (
        <>
          <ZepboundCard />
          <button
            onClick={disableZepbound}
            style={{ display: "block", margin: "0 auto 12px", background: "none", border: "none", color: "var(--color-ink-4)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
          >
            Hide Zepbound tracker
          </button>
        </>
      ) : (
        <button
          onClick={enableZepbound}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", marginBottom: 12, borderRadius: 14,
            background: "var(--color-bg-raised)", border: "1px dashed var(--color-line-2)",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--color-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            💉
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>Track Zepbound / GLP-1</div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 1 }}>Log doses, track injection sites &amp; escalation</div>
          </div>
        </button>
      )}

      {showAdd && <AddSheet onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
      {editTarget && (
        <EditSheet
          med={editTarget}
          onSave={handleUpdate}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
