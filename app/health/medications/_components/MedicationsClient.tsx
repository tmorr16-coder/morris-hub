"use client";

import { useState, useTransition, useEffect } from "react";
import { Chip, IconBadge, Icons } from "@/components/ios";
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

// Uppercase grouped-list-style section header, no horizontal inset (parent pads).
const sectionHeader: React.CSSProperties = {
  fontSize: 13, fontWeight: 400, lineHeight: "18px",
  color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.02em",
};

// ── Zepbound tracker ────────────────────────────────────────────
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

  const subFieldLabel: React.CSSProperties = {
    fontSize: 12, fontWeight: 400, color: "var(--ios-label-2)",
    textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 8,
  };

  return (
    <div className="ios-list" style={{ margin: "0 0 12px" }}>
      {/* Header cell */}
      <div className="ios-cell">
        <span className="ios-cell-lead">
          <IconBadge color="var(--ios-tint)"><Icons.PillIcon /></IconBadge>
        </span>
        <span className="ios-cell-body">
          <span className="ios-cell-title">
            Zepbound <span className="ios-num" style={{ fontWeight: 600 }}>{data.dose} mg</span>
          </span>
          <span className="ios-cell-sub">{data.injectionDay}s</span>
        </span>
        <span className="ios-cell-trail" style={{ flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Next dose</span>
          <span className="ios-footnote" style={{ fontWeight: 600, color: loggedToday ? "var(--ios-green)" : "var(--ios-label)" }}>
            {loggedToday ? "✓ Logged" : nextInjectionDays()}
          </span>
        </span>
      </div>

      {/* Dose escalation picker */}
      {editingDose && (
        <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <span style={subFieldLabel}>Current dose</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ZEPBOUND_DOSES.map((d) => (
              <Chip key={d} small selected={data.dose === d} onClick={() => { save({ ...data, dose: d }); setEditingDose(false); }}>
                {d} mg
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Injection day picker */}
      {editingDay && (
        <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <span style={subFieldLabel}>Injection day</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DAYS.map((d) => (
              <Chip key={d} small selected={data.injectionDay === d} onClick={() => { save({ ...data, injectionDay: d }); setEditingDay(false); }}>
                {d.slice(0, 3)}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Next injection site + log action */}
      <div className="ios-cell">
        <span className="ios-cell-body">
          <span className="ios-cell-sub" style={{ marginTop: 0 }}>Next injection site</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            <span className="ios-headline">{nextSite}</span>
            <Chip small selected={editingSite} onClick={() => setEditingSite((v) => !v)}>Override</Chip>
          </span>
        </span>
        <button
          type="button"
          onClick={logDose}
          disabled={loggedToday}
          className="ios-btn"
          style={{
            minHeight: 0, padding: "9px 16px", borderRadius: 10, fontSize: 15,
            background: loggedToday ? "var(--ios-fill)" : "var(--ios-green)",
            color: loggedToday ? "var(--ios-label-3)" : "#fff",
            cursor: loggedToday ? "not-allowed" : "pointer", whiteSpace: "nowrap",
          }}
        >
          {loggedToday ? "✓ Done" : "Log Dose"}
        </button>
      </div>
      {editingSite && (
        <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <span style={subFieldLabel}>Select next site</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {INJECTION_SITES.map((s, idx) => (
              <Chip key={s} small selected={data.siteIndex === idx} onClick={() => { save({ ...data, siteIndex: idx }); setEditingSite(false); }}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Backdate form */}
      {showBackdate && (
        <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <span style={subFieldLabel}>Log a past dose</span>
          <div>
            <div style={{ ...subFieldLabel, marginBottom: 5 }}>Date</div>
            <input
              type="date"
              value={backdateDate}
              max={new Date().toLocaleDateString("sv")}
              onChange={(e) => setBackdateDate(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "var(--ios-hair) solid var(--ios-separator)", background: "var(--ios-cell)", color: "var(--ios-label)", fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box", colorScheme: "light dark" }}
            />
            {backdateDate && data.logs.some((l) => l.date === backdateDate) && (
              <div className="ios-footnote" style={{ color: "var(--ios-red)", marginTop: 4 }}>Already logged on this date</div>
            )}
          </div>
          <div>
            <div style={{ ...subFieldLabel, marginBottom: 5 }}>Dose</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {ZEPBOUND_DOSES.map((d) => (
                <Chip key={d} small selected={backdateDose === d} onClick={() => setBackdateDose(d)}>{d} mg</Chip>
              ))}
            </div>
          </div>
          <div>
            <div style={{ ...subFieldLabel, marginBottom: 5 }}>Injection site</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {INJECTION_SITES.map((s) => (
                <Chip key={s} small selected={backdateSite === s} onClick={() => setBackdateSite(s)}>{s}</Chip>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={saveBackdate}
              disabled={!backdateDate || !backdateDose || !backdateSite || data.logs.some((l) => l.date === backdateDate)}
              className="ios-btn"
              style={{
                flex: 1, minHeight: 0, padding: "10px", borderRadius: 10, fontSize: 15,
                background: (backdateDate && backdateDose && backdateSite && !data.logs.some((l) => l.date === backdateDate)) ? "var(--ios-green)" : "var(--ios-fill)",
                color: (backdateDate && backdateDose && backdateSite && !data.logs.some((l) => l.date === backdateDate)) ? "#fff" : "var(--ios-label-3)",
              }}
            >
              Save
            </button>
            <button type="button" onClick={() => setShowBackdate(false)} className="ios-btn--plain" style={{ padding: "10px 14px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Config chips */}
      <div className="ios-cell" style={{ gap: 8, flexWrap: "wrap" }}>
        <Chip small selected={editingDose} onClick={() => { setEditingDose((v) => !v); setEditingDay(false); }}>Change dose</Chip>
        <Chip small selected={editingDay} onClick={() => { setEditingDay((v) => !v); setEditingDose(false); }}>Change day</Chip>
        <Chip small selected={showBackdate} onClick={openBackdate}>Log past dose</Chip>
      </div>

      {/* Dose history */}
      {allLogs.length > 0 && (
        <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={sectionHeader}>
              Dose history · {allLogs.length} injection{allLogs.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={() => { setEditHistory((v) => !v); setEditingLogDate(null); }}
              className="ios-btn--plain"
              style={{ color: editHistory ? "var(--ios-red)" : "var(--ios-tint)", padding: 0 }}
            >
              {editHistory ? "Done" : "Edit"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Array.from(byMonth.entries()).map(([month, logs]) => (
              <div key={month}>
                <div className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-label-2)", marginBottom: 6 }}>
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
                            display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                            borderRadius: isEditing ? "10px 10px 0 0" : 10,
                            background: isFirst ? "rgba(52,199,89,0.12)" : "var(--ios-fill)",
                            cursor: editHistory ? "pointer" : "default",
                          }}
                          onClick={() => editHistory && setEditingLogDate(isEditing ? null : log.date)}
                        >
                          {editHistory && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); deleteLog(log.date); }}
                              aria-label="Delete dose"
                              style={{ width: 22, height: 22, borderRadius: 11, background: "var(--ios-red)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
                            >
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>
                            </button>
                          )}
                          <div style={{ flex: 1 }}>
                            <span className="ios-subhead" style={{ fontWeight: 500 }}>{dayLabel}</span>
                            <span className="ios-footnote" style={{ marginLeft: 8, color: "var(--ios-label-2)" }}>{log.site}</span>
                          </div>
                          <div className="ios-num ios-subhead" style={{ fontWeight: 600 }}>{log.dose} mg</div>
                          {editHistory && <span style={{ color: "var(--ios-label-3)" }}>{isEditing ? "▲" : "›"}</span>}
                        </div>
                        {isEditing && (
                          <div style={{ background: "var(--ios-cell)", border: "var(--ios-hair) solid var(--ios-separator)", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "10px 12px 12px" }}>
                            <div style={{ ...subFieldLabel, marginBottom: 6 }}>Dose</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                              {ZEPBOUND_DOSES.map((d) => (
                                <Chip key={d} small selected={log.dose === d} onClick={() => updateLog(log.date, { dose: d })}>{d} mg</Chip>
                              ))}
                            </div>
                            <div style={{ ...subFieldLabel, marginBottom: 6 }}>Site</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                              {INJECTION_SITES.map((s) => (
                                <Chip key={s} small selected={log.site === s} onClick={() => updateLog(log.date, { site: s })}>{s}</Chip>
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
  fontSize: 13, fontWeight: 400, color: "var(--ios-label-2)",
  textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 6,
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 16,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

// ── Shared sheet shell ─────────────────────────────────────────
function Sheet({ onClose, title, children }: {
  onClose: () => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="ios-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="ios-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="ios-grabber" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button type="button" className="ios-btn--plain" onClick={onClose}>Cancel</button>
          <span className="ios-headline">{title}</span>
          <span style={{ width: 52 }} />
        </div>
        {children}
      </div>
    </>
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
      <div style={fieldLabel}>Common</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {COMMON_MEDS.map((m) => (
          <Chip key={m.name} small selected={name === m.name} onClick={() => pick(m)}>{m.name}</Chip>
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
          <select value={schedule} onChange={(e) => setSchedule(e.target.value)} style={{ ...fieldInput, colorScheme: "light dark" }}>
            {SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <button
        type="button"
        disabled={!valid}
        onClick={() => valid && onAdd({ name: name.trim(), dose: dose.trim(), schedule })}
        className="ios-btn ios-btn--primary"
        style={{ opacity: valid ? 1 : 0.5, cursor: valid ? "pointer" : "not-allowed" }}
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
          <select value={schedule} onChange={(e) => setSchedule(e.target.value)} style={{ ...fieldInput, colorScheme: "light dark" }}>
            {SCHEDULES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <button
        type="button"
        disabled={!valid || !changed}
        onClick={() => valid && changed && onSave(med.id, { name: name.trim(), dose: dose.trim(), schedule })}
        className="ios-btn ios-btn--primary"
        style={{ opacity: valid && changed ? 1 : 0.5, cursor: valid && changed ? "pointer" : "not-allowed" }}
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
    const tempId = `temp-${new Date().getTime()}`;
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
      {/* Section header + edit toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 7px" }}>
        <span style={sectionHeader}>Medications</span>
        <button
          type="button"
          onClick={() => setEditMode((e) => !e)}
          className="ios-btn--plain"
          style={{ color: editMode ? "var(--ios-red)" : "var(--ios-tint)", padding: 0 }}
        >
          {editMode ? "Done" : "Edit"}
        </button>
      </div>

      <div className="ios-list" style={{ margin: 0 }}>
        {meds.length === 0 && !editMode && (
          <div className="ios-cell" style={{ justifyContent: "center", color: "var(--ios-label-2)" }}>
            No medications yet
          </div>
        )}

        {meds.map((m) => {
          const isTaken = !!taken[m.id];
          return (
            <div key={m.id} className="ios-cell">
              <span className="ios-cell-lead">
                {editMode ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.id)}
                    aria-label="Remove medication"
                    style={{ width: 26, height: 26, borderRadius: 13, background: "var(--ios-red)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTaken((t) => ({ ...t, [m.id]: !t[m.id] }))}
                    aria-label={isTaken ? "Mark not taken" : "Mark taken"}
                    aria-pressed={isTaken}
                    style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: isTaken ? "var(--ios-green)" : "transparent",
                      border: isTaken ? "none" : "1.5px solid var(--ios-label-3)",
                      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {isTaken && (
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                )}
              </span>

              {/* Row body — tappable in edit mode to open edit sheet */}
              <span
                className="ios-cell-body"
                style={{ cursor: editMode ? "pointer" : "default" }}
                onClick={() => editMode && setEditTarget(m)}
              >
                <span className="ios-cell-title" style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  {m.name}
                  <span className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)" }}>{m.dose}</span>
                </span>
                <span className="ios-cell-sub">{m.schedule}</span>
              </span>

              {editMode && (
                <button
                  type="button"
                  onClick={() => setEditTarget(m)}
                  aria-label="Edit medication"
                  style={{ flexShrink: 0, color: "var(--ios-label-3)", fontSize: 17, padding: "0 4px" }}
                >
                  ›
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => { setEditMode(false); setShowAdd(true); }}
          className="ios-cell"
          style={{ color: "var(--ios-tint)" }}
        >
          <span className="ios-cell-lead">
            <span style={{ width: 26, height: 26, borderRadius: "50%", border: "1.5px dashed var(--ios-label-3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ios-tint)" }}>
              <Icons.PlusIcon width={16} height={16} />
            </span>
          </span>
          <span className="ios-cell-body">
            <span className="ios-cell-title" style={{ color: "var(--ios-tint)" }}>Add medication</span>
          </span>
        </button>
      </div>

      {/* Zepbound tracker — opt-in */}
      <div style={{ marginTop: 12 }}>
        {zepboundEnabled ? (
          <>
            <ZepboundCard />
            <button
              type="button"
              onClick={disableZepbound}
              className="ios-footnote"
              style={{ display: "block", margin: "0 auto 12px", color: "var(--ios-label-2)" }}
            >
              Hide Zepbound tracker
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={enableZepbound}
            className="ios-list"
            style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "14px 16px", margin: "0 0 12px", textAlign: "left" }}
          >
            <IconBadge color="var(--ios-tint)"><Icons.PillIcon /></IconBadge>
            <span className="ios-cell-body">
              <span className="ios-cell-title">Track Zepbound / GLP-1</span>
              <span className="ios-cell-sub">Log doses, track injection sites &amp; escalation</span>
            </span>
            <Icons.ChevronRight className="ios-chevron" />
          </button>
        )}
      </div>

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
