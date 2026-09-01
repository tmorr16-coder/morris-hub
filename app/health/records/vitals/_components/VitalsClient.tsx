"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Group } from "@/components/ios";
import { addVitals, deleteVitals } from "../../actions";

export interface VitalsRecord {
  id: string;
  measured_on: string;
  systolic: number | null;
  diastolic: number | null;
  pulse_bpm: number | null;
  temperature_f: number | null;
  spo2_pct: number | null;
  respiratory_rate: number | null;
  weight_lbs: number | null;
  waist_in: number | null;
  context: string | null;
  notes: string | null;
}

const FIELDS = [
  { key: "systolic", label: "Systolic", unit: "mmHg", mode: "numeric" },
  { key: "diastolic", label: "Diastolic", unit: "mmHg", mode: "numeric" },
  { key: "pulse_bpm", label: "Pulse", unit: "bpm", mode: "numeric" },
  { key: "weight_lbs", label: "Weight", unit: "lbs", mode: "decimal" },
  { key: "spo2_pct", label: "SpO₂", unit: "%", mode: "numeric" },
  { key: "temperature_f", label: "Temperature", unit: "°F", mode: "decimal" },
  { key: "respiratory_rate", label: "Resp. rate", unit: "/min", mode: "numeric" },
  { key: "waist_in", label: "Waist", unit: "in", mode: "decimal" },
] as const;

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid var(--ios-separator)",
  background: "transparent",
  color: "var(--ios-label)",
  fontSize: 16,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--ios-label-2)",
  marginBottom: 4,
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** One-line recap of a reading: only the fields actually recorded. */
function summarize(v: VitalsRecord): string {
  const parts: string[] = [];
  if (v.systolic != null && v.diastolic != null) parts.push(`${v.systolic}/${v.diastolic} mmHg`);
  if (v.pulse_bpm != null) parts.push(`${v.pulse_bpm} bpm`);
  if (v.weight_lbs != null) parts.push(`${v.weight_lbs} lbs`);
  if (v.spo2_pct != null) parts.push(`${v.spo2_pct}% SpO₂`);
  if (v.temperature_f != null) parts.push(`${v.temperature_f}°F`);
  if (v.respiratory_rate != null) parts.push(`${v.respiratory_rate}/min`);
  if (v.waist_in != null) parts.push(`${v.waist_in} in waist`);
  return parts.join(" · ") || "No values";
}

export default function VitalsClient({ initial }: { initial: VitalsRecord[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [measuredOn, setMeasuredOn] = useState(new Date().toLocaleDateString("sv"));
  const [context, setContext] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);

    const numbers = Object.fromEntries(
      FIELDS.map((f) => [f.key, values[f.key] === undefined || values[f.key] === "" ? null : Number(values[f.key])])
    );

    if (Object.values(numbers).every((v) => v == null)) {
      setError("Enter at least one reading.");
      return;
    }
    if (Object.values(numbers).some((v) => v != null && !Number.isFinite(v))) {
      setError("Readings must be numbers.");
      return;
    }

    setBusy(true);
    const { error: saveError } = await addVitals({
      measured_on: measuredOn,
      context: context || null,
      notes: notes || null,
      ...numbers,
    });
    setBusy(false);

    if (saveError) {
      setError(saveError);
      return;
    }
    setValues({});
    setContext("");
    setNotes("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    setBusy(true);
    await deleteVitals(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <Group header="New reading">
        <div style={{ padding: "12px 16px", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="v-date">Date</label>
              <input
                id="v-date"
                type="date"
                style={inputStyle}
                value={measuredOn}
                onChange={(e) => setMeasuredOn(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="v-context">Context</label>
              <input
                id="v-context"
                style={inputStyle}
                placeholder="Home, morning"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label style={labelStyle} htmlFor={`v-${f.key}`}>
                  {f.label} ({f.unit})
                </label>
                <input
                  id={`v-${f.key}`}
                  style={inputStyle}
                  inputMode={f.mode}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div>
            <label style={labelStyle} htmlFor="v-notes">Notes</label>
            <input
              id="v-notes"
              style={inputStyle}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <span className="ios-footnote" style={{ color: "var(--ios-red)" }}>{error}</span>}

          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            style={{
              padding: "12px 18px",
              borderRadius: 11,
              background: "var(--ios-tint)",
              color: "var(--ios-on-tint)",
              fontWeight: 600,
              fontSize: 16,
              border: "none",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Saving…" : "Save reading"}
          </button>
        </div>
      </Group>

      {initial.length > 0 && (
        <Group header="History">
          {initial.map((v) => (
            <div key={v.id} className="ios-cell">
              <span className="ios-cell-body">
                <span className="ios-cell-title">{fmtDate(v.measured_on)}</span>
                <span className="ios-cell-sub">
                  {summarize(v)}
                  {v.context ? ` · ${v.context}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => handleDelete(v.id)}
                disabled={busy}
                aria-label={`Delete reading from ${fmtDate(v.measured_on)}`}
                style={{ background: "none", border: "none", color: "var(--ios-red)", fontSize: 13, flexShrink: 0 }}
              >
                Delete
              </button>
            </div>
          ))}
        </Group>
      )}
    </>
  );
}
