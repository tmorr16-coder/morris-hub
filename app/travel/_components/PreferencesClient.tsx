"use client";

import { useState } from "react";
import { CABINS, type TravelPreferences } from "../types";

export default function PreferencesClient({ initial }: { initial: TravelPreferences }) {
  const [p, setP] = useState<TravelPreferences>(initial);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function set<K extends keyof TravelPreferences>(k: K, v: TravelPreferences[K]) {
    setP((cur) => ({ ...cur, [k]: v }));
    setSaveState("idle");
  }

  async function save() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/travel/preferences", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch { setSaveState("error"); }
  }

  return (
    <div>
      <div className="ios-group-header" style={{ padding: "8px 0 7px" }}>FLIGHTS</div>
      <div className="ios-list" style={{ margin: 0, padding: 16 }}>
        <Field label="Home airport"><Inp value={p.home_airport ?? ""} onChange={(v) => set("home_airport", v.toUpperCase())} placeholder="IND" width={90} /></Field>
        <Field label="Preferred cabin">
          <select value={p.cabin_class} onChange={(e) => set("cabin_class", e.target.value)} style={sel(150)}>
            {CABINS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Max stops"><Inp value={String(p.max_stops)} onChange={(v) => set("max_stops", Math.max(0, Math.min(3, parseInt(v) || 0)))} width={70} /></Field>
        <Field label="Preferred airlines"><Inp value={p.preferred_airlines.join(", ")} onChange={(v) => set("preferred_airlines", splitCodes(v))} placeholder="UA, DL, AA" width={170} /></Field>
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", lineHeight: 1.4 }}>Two-letter IATA airline codes, comma-separated.</div>
      </div>

      <div className="ios-group-header" style={{ padding: "12px 0 7px" }}>HOTELS</div>
      <div className="ios-list" style={{ margin: 0, padding: 16 }}>
        <Field label="Preferred chains"><Inp value={p.preferred_hotel_chains.join(", ")} onChange={(v) => set("preferred_hotel_chains", splitCodes(v))} placeholder="Marriott, Hilton, Hyatt" width={170} /></Field>
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", lineHeight: 1.4 }}>Brand names, comma-separated. Matching results get a “Preferred chain” flag.</div>
        <Field label="Minimum rating">
          <select value={p.hotel_min_rating} onChange={(e) => set("hotel_min_rating", parseInt(e.target.value))} style={sel(110)}>
            {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>{"★".repeat(r)}</option>)}
          </select>
        </Field>
      </div>

      <div className="ios-group-header" style={{ padding: "12px 0 7px" }}>PRICE ALERTS</div>
      <div className="ios-list" style={{ margin: 0, padding: 16 }}>
        <Toggle label="Email me when a watched price drops" checked={p.notify_email} onChange={(v) => set("notify_email", v)} />
        <Toggle label="Text me (SMS)" checked={p.notify_sms} onChange={(v) => set("notify_sms", v)} />
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", lineHeight: 1.4 }}>Email uses your account email. SMS uses your saved phone number in Settings.</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 8px" }}>
        <button onClick={save} disabled={saveState === "saving"} style={{ padding: "12px 22px", borderRadius: 12, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer", opacity: saveState === "saving" ? 0.6 : 1 }}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save preferences"}
        </button>
        {saveState === "error" && <span className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)" }}>Couldn&apos;t save — try again.</span>}
      </div>
    </div>
  );
}

function splitCodes(v: string): string[] {
  return v.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}><span className="ios-subhead">{label}</span>{children}</div>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40, cursor: "pointer" }}>
      <span className="ios-subhead">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 20, height: 20 }} />
    </label>
  );
}
function Inp({ value, onChange, placeholder, width = 150 }: { value: string; onChange: (v: string) => void; placeholder?: string; width?: number }) {
  return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ width, background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 15, color: "var(--ios-label)", textAlign: "right" }} />;
}
const sel = (w: number): React.CSSProperties => ({ width: w, background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 15, color: "var(--ios-label)", textAlign: "right" });
