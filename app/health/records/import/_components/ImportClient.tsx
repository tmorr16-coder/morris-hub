"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Group, Cell } from "@/components/ios";
import { findBiomarker, BIOMARKER_BY_KEY, formatRange } from "@/lib/health/biomarkers";
import { saveExtractedRecord, uploadRecordFile, type ResultInput } from "../../actions";

type Phase = "pick" | "extracting" | "review" | "saving";

interface DraftResult extends ResultInput {
  /** Local-only row id so React keys survive edits and removals. */
  rowId: string;
  include: boolean;
}

interface Draft {
  kind: string;
  title: string;
  source: string;
  performed_on: string;
  reported_on: string;
  provider: string;
  facility: string;
  accession: string;
  summary: string;
  notes: string;
  results: DraftResult[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body_composition: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vitals: Record<string, any> | null;
}

const BODY_COMP_FIELDS: { key: string; label: string; unit?: string }[] = [
  { key: "weight_lbs", label: "Weight", unit: "lbs" },
  { key: "bmi", label: "BMI" },
  { key: "body_fat_pct", label: "Body fat", unit: "%" },
  { key: "body_fat_mass_lbs", label: "Body fat mass", unit: "lbs" },
  { key: "lean_body_mass_lbs", label: "Lean body mass", unit: "lbs" },
  { key: "skeletal_muscle_lbs", label: "Skeletal muscle mass", unit: "lbs" },
  { key: "dry_lean_mass_lbs", label: "Dry lean mass", unit: "lbs" },
  { key: "total_body_water_lbs", label: "Total body water", unit: "lbs" },
  { key: "intracellular_water_lbs", label: "Intracellular water", unit: "lbs" },
  { key: "extracellular_water_lbs", label: "Extracellular water", unit: "lbs" },
  { key: "ecw_tbw", label: "ECW/TBW" },
  { key: "visceral_fat_area", label: "Visceral fat area", unit: "cm²" },
  { key: "bmr_kcal", label: "Basal metabolic rate", unit: "kcal" },
  { key: "smi", label: "SMI", unit: "kg/m²" },
  { key: "leg_lean_mass_lbs", label: "Leg lean mass", unit: "lbs" },
  { key: "phase_angle", label: "Phase angle", unit: "°" },
];

const VITALS_FIELDS: { key: string; label: string; unit?: string }[] = [
  { key: "systolic", label: "Systolic", unit: "mmHg" },
  { key: "diastolic", label: "Diastolic", unit: "mmHg" },
  { key: "pulse_bpm", label: "Pulse", unit: "bpm" },
  { key: "temperature_f", label: "Temperature", unit: "°F" },
  { key: "spo2_pct", label: "SpO₂", unit: "%" },
  { key: "respiratory_rate", label: "Respiratory rate", unit: "/min" },
  { key: "weight_lbs", label: "Weight", unit: "lbs" },
  { key: "height_in", label: "Height", unit: "in" },
  { key: "waist_in", label: "Waist", unit: "in" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid var(--ios-separator)",
  background: "var(--ios-bg, transparent)",
  color: "var(--ios-label)",
  fontSize: 16,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--ios-label-2)",
  marginBottom: 4,
};

/** Drop the editor-only fields before a row is sent to the server. */
function toResultInput(r: DraftResult): ResultInput {
  return {
    name: r.name.trim(),
    panel: r.panel ?? null,
    value: r.value ?? null,
    value_text: r.value_text ?? null,
    unit: r.unit ?? null,
    ref_low: r.ref_low ?? null,
    ref_high: r.ref_high ?? null,
    ref_text: r.ref_text ?? null,
    flag: r.flag ?? null,
    note: r.note ?? null,
    biomarker_key: r.biomarker_key ?? null,
  };
}

let rowSeq = 0;
function nextRowId(): string {
  rowSeq += 1;
  return `r${rowSeq}`;
}

function today(): string {
  return new Date().toLocaleDateString("sv");
}

function emptyDraft(): Draft {
  return {
    kind: "lab_panel",
    title: "",
    source: "",
    performed_on: today(),
    reported_on: "",
    provider: "",
    facility: "",
    accession: "",
    summary: "",
    notes: "",
    results: [],
    body_composition: null,
    vitals: null,
  };
}

export default function ImportClient() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

/**
 * Get a picked file into a shape that will actually arrive.
 *
 * Two things stop a phone photo of a printed report from ever reaching the
 * extractor, and neither announces itself:
 *
 *  - Vercel drops any request body over 4.5MB *before* the handler runs, so an
 *    8MB photo produces no response and no error. The route's own 20MB limit
 *    was a promise the platform does not keep.
 *  - iPhones shoot HEIC by default, which the API does not accept, so the
 *    upload was rejected as an unsupported type for a perfectly good photo.
 *
 * Drawing it through a canvas fixes both: the output is always JPEG, and the
 * long edge is capped at 1568px — which is the size the vision model works at
 * anyway, so nothing legible is lost. PDFs pass through untouched.
 */
async function prepareForUpload(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const MAX_EDGE = 1568;
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // 0.9 rather than the usual 0.8: this is a page of small printed numbers,
    // and compression artefacts on a decimal point are not worth the bytes.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // Canvas could not decode it — send the original and let the route explain.
    return file;
  }
}

  async function handleFile(picked: File) {
    setError(null);
    setPhase("extracting");

    try {
      const prepared = await prepareForUpload(picked);
      setFile(prepared);
      const body = new FormData();
      body.append("file", prepared);
      const res = await fetch("/api/health/records/extract", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not read that file.");
        setPhase("pick");
        return;
      }

      setDraft({
        kind: data.record_type === "body_composition" ? "body_composition" : data.record_type === "vitals" ? "vitals" : "lab_panel",
        title: data.title ?? picked.name.replace(/\.[^.]+$/, ""),
        source: data.source ?? "",
        performed_on: data.performed_on ?? today(),
        reported_on: data.reported_on ?? "",
        provider: data.provider ?? "",
        facility: data.facility ?? "",
        accession: data.accession ?? "",
        summary: data.summary ?? "",
        notes: "",
        results: (data.results ?? []).map((r: ResultInput) => ({
          ...r,
          rowId: nextRowId(),
          include: true,
        })),
        body_composition: data.body_composition ?? null,
        vitals: data.vitals ?? null,
      });
      setPhase("review");
    } catch {
      // "Check your connection" was the wrong first guess. The common cause is
      // a file too large for the platform to accept — the request is dropped
      // before any handler runs, so the fetch itself fails and there is no
      // response to read an error out of. Say the likelier thing first.
      const mb = (file?.size ?? 0) / 1024 / 1024;
      setError(
        mb > 4
          ? `That file is ${mb.toFixed(1)}MB, which is too large to send. A photo taken here is resized automatically — try picking it again, or use a JPEG rather than a PNG.`
          : "The upload didn't go through. Try again, and check your connection if it keeps failing."
      );
      setPhase("pick");
    }
  }

  function startManual() {
    setError(null);
    setFile(null);
    setDraft(emptyDraft());
    setPhase("review");
  }

  function updateResult(rowId: string, patch: Partial<DraftResult>) {
    setDraft((d) =>
      d ? { ...d, results: d.results.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)) } : d
    );
  }

  function addResultRow() {
    setDraft((d) =>
      d
        ? {
            ...d,
            results: [
              ...d.results,
              { rowId: nextRowId(), include: true, name: "", value: null, unit: null, panel: null },
            ],
          }
        : d
    );
  }

  function removeResultRow(rowId: string) {
    setDraft((d) => (d ? { ...d, results: d.results.filter((r) => r.rowId !== rowId) } : d));
  }

  async function handleSave() {
    if (!draft) return;
    setError(null);

    if (!draft.title.trim()) return setError("Give this record a title.");
    if (!draft.performed_on) return setError("Set the date this record was taken.");

    const included = draft.results.filter((r) => r.include && r.name.trim());
    if (
      included.length === 0 &&
      !draft.body_composition &&
      !draft.vitals
    ) {
      return setError("Add at least one result before saving.");
    }

    setPhase("saving");

    const { id, error: saveError } = await saveExtractedRecord({
      kind: draft.kind,
      title: draft.title,
      source: draft.source,
      performed_on: draft.performed_on,
      reported_on: draft.reported_on,
      provider: draft.provider,
      facility: draft.facility,
      accession: draft.accession,
      summary: draft.summary,
      notes: draft.notes,
      entry_method: file ? "ai_extract" : "manual",
      results: included.map(toResultInput),
      body_composition: draft.body_composition,
      vitals: draft.vitals,
    });

    if (saveError || !id) {
      setError(saveError ?? "Could not save this record.");
      setPhase("review");
      return;
    }

    // The record is already stored; keeping the original scan is a bonus, so
    // a storage failure here is surfaced but never rolls the save back.
    if (file) {
      const body = new FormData();
      body.append("file", file);
      await uploadRecordFile(id, body);
    }

    router.push(`/health/records/${id}`);
    router.refresh();
  }

  // ── Pick ───────────────────────────────────────────────────────────────
  if (phase === "pick" || phase === "extracting") {
    const busy = phase === "extracting";
    return (
      <>
        <div className="ios-list" style={{ margin: "8px 16px 0", padding: 18 }}>
          <div className="ios-headline" style={{ marginBottom: 6 }}>
            {busy ? "Reading your record…" : "Upload a report"}
          </div>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.5, marginBottom: 14 }}>
            {busy
              ? "Transcribing every value and matching it to its reference range. A long lab report can take up to a minute."
              : "A PDF or a photo of a lab report, body-composition scan or visit summary. Scanned pages are fine — the text doesn't need to be selectable. You'll review every value before anything is saved."}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              style={{
                padding: "11px 18px",
                borderRadius: 10,
                background: "var(--ios-tint)",
                color: "var(--ios-on-tint)",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? "Reading…" : "Choose file"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={startManual}
              style={{
                padding: "11px 18px",
                borderRadius: 10,
                background: "var(--ios-fill, rgba(120,120,128,0.12))",
                color: "var(--ios-tint)",
                fontWeight: 600,
                fontSize: 15,
                border: "none",
                opacity: busy ? 0.6 : 1,
              }}
            >
              Enter by hand
            </button>
          </div>

          {busy && file && (
            <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 12 }}>
              {file.name}
            </div>
          )}
        </div>

        {error && (
          <div className="ios-list" style={{ margin: "12px 16px 0", padding: 14 }}>
            <span className="ios-subhead" style={{ color: "var(--ios-red)" }}>{error}</span>
          </div>
        )}

        <p className="ios-caption" style={{ color: "var(--ios-label-2)", padding: "18px 16px 0", lineHeight: 1.5 }}>
          Your file is sent to Claude only to transcribe the values on it, then stored privately in
          your account. Nothing is shared with family members or used for anything else.
        </p>
      </>
    );
  }

  // ── Review / edit ──────────────────────────────────────────────────────
  if (!draft) return null;
  const saving = phase === "saving";
  const includedCount = draft.results.filter((r) => r.include && r.name.trim()).length;

  return (
    <>
      <Group header="Record">
        <div style={{ padding: "12px 16px", display: "grid", gap: 12 }}>
          <div>
            <label style={labelStyle} htmlFor="rec-title">Title</label>
            <input
              id="rec-title"
              style={inputStyle}
              value={draft.title}
              placeholder="Quest lab panel"
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="rec-date">Date taken</label>
              <input
                id="rec-date"
                type="date"
                style={inputStyle}
                value={draft.performed_on}
                onChange={(e) => setField("performed_on", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="rec-source">Source</label>
              <input
                id="rec-source"
                style={inputStyle}
                value={draft.source}
                placeholder="Quest Diagnostics"
                onChange={(e) => setField("source", e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle} htmlFor="rec-provider">Ordering physician</label>
              <input
                id="rec-provider"
                style={inputStyle}
                value={draft.provider}
                onChange={(e) => setField("provider", e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="rec-kind">Type</label>
              <select
                id="rec-kind"
                style={inputStyle}
                value={draft.kind}
                onChange={(e) => setField("kind", e.target.value)}
              >
                <option value="lab_panel">Lab panel</option>
                <option value="body_composition">Body composition</option>
                <option value="vitals">Vitals</option>
                <option value="imaging">Imaging</option>
                <option value="visit">Visit summary</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          {draft.summary && (
            <div>
              <label style={labelStyle} htmlFor="rec-summary">Summary</label>
              <textarea
                id="rec-summary"
                style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                value={draft.summary}
                onChange={(e) => setField("summary", e.target.value)}
              />
            </div>
          )}
        </div>
      </Group>

      {draft.body_composition && (
        <Group header="Body composition" footer="Values read from the scan. Clear a field to leave it out.">
          <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {BODY_COMP_FIELDS.map((f) => (
              <div key={f.key}>
                <label style={labelStyle} htmlFor={`bc-${f.key}`}>
                  {f.label}{f.unit ? ` (${f.unit})` : ""}
                </label>
                <input
                  id={`bc-${f.key}`}
                  style={inputStyle}
                  inputMode="decimal"
                  value={draft.body_composition?.[f.key] ?? ""}
                  onChange={(e) =>
                    setField("body_composition", {
                      ...draft.body_composition,
                      [f.key]: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Group>
      )}

      {draft.vitals && (
        <Group header="Vitals">
          <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {VITALS_FIELDS.map((f) => (
              <div key={f.key}>
                <label style={labelStyle} htmlFor={`v-${f.key}`}>
                  {f.label}{f.unit ? ` (${f.unit})` : ""}
                </label>
                <input
                  id={`v-${f.key}`}
                  style={inputStyle}
                  inputMode="decimal"
                  value={draft.vitals?.[f.key] ?? ""}
                  onChange={(e) =>
                    setField("vitals", {
                      ...draft.vitals,
                      [f.key]: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Group>
      )}

      <Group
        header={`Results (${includedCount})`}
        footer="Check each value against the report before saving. Untick anything you don't want stored."
      >
        {draft.results.length === 0 && (
          <Cell chevron={false} title="No results yet" subtitle="Add one below." />
        )}
        {draft.results.map((r) => {
          const marker = r.biomarker_key
            ? BIOMARKER_BY_KEY[r.biomarker_key]
            : findBiomarker(r.name);
          const range = formatRange(r.ref_low, r.ref_high, r.ref_text, r.unit);
          return (
            <div key={r.rowId} className="ios-cell" style={{ alignItems: "flex-start", gap: 10 }}>
              <input
                type="checkbox"
                checked={r.include}
                aria-label={`Include ${r.name || "this result"}`}
                onChange={(e) => updateResult(r.rowId, { include: e.target.checked })}
                style={{ marginTop: 12, width: 20, height: 20, flexShrink: 0, accentColor: "var(--ios-tint)" }}
              />
              <span className="ios-cell-body" style={{ opacity: r.include ? 1 : 0.45 }}>
                <input
                  style={{ ...inputStyle, fontSize: 15, padding: "7px 9px" }}
                  value={r.name}
                  placeholder="Test name"
                  aria-label="Test name"
                  onChange={(e) =>
                    updateResult(r.rowId, {
                      name: e.target.value,
                      biomarker_key: findBiomarker(e.target.value)?.key ?? null,
                    })
                  }
                />
                <span style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input
                    style={{ ...inputStyle, fontSize: 15, padding: "7px 9px", flex: "1 1 0" }}
                    inputMode="decimal"
                    value={r.value ?? ""}
                    placeholder="Value"
                    aria-label="Value"
                    onChange={(e) =>
                      updateResult(r.rowId, { value: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                  <input
                    style={{ ...inputStyle, fontSize: 15, padding: "7px 9px", flex: "1 1 0" }}
                    value={r.unit ?? ""}
                    placeholder="Unit"
                    aria-label="Unit"
                    onChange={(e) => updateResult(r.rowId, { unit: e.target.value || null })}
                  />
                </span>
                <span className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 5, display: "block" }}>
                  {marker ? `Tracked as ${marker.name}` : "Not in the marker catalog — stored, but not trended"}
                  {range ? ` · Ref ${range}` : ""}
                  {r.flag ? ` · Lab flag ${r.flag}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeResultRow(r.rowId)}
                aria-label={`Remove ${r.name || "result"}`}
                style={{ background: "none", border: "none", color: "var(--ios-red)", fontSize: 13, padding: "12px 0 0", flexShrink: 0 }}
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="ios-cell"
          onClick={addResultRow}
          style={{ color: "var(--ios-tint)", width: "100%", background: "none", border: "none", textAlign: "left" }}
        >
          <span className="ios-cell-body">
            <span className="ios-cell-title" style={{ color: "var(--ios-tint)" }}>Add a result</span>
          </span>
        </button>
      </Group>

      {error && (
        <div className="ios-list" style={{ margin: "12px 16px 0", padding: 14 }}>
          <span className="ios-subhead" style={{ color: "var(--ios-red)" }}>{error}</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, padding: "18px 16px 0" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: "13px 18px",
            borderRadius: 11,
            background: "var(--ios-tint)",
            color: "var(--ios-on-tint)",
            fontWeight: 600,
            fontSize: 16,
            border: "none",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save record"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setDraft(null);
            setFile(null);
            setError(null);
            setPhase("pick");
          }}
          style={{
            padding: "13px 18px",
            borderRadius: 11,
            background: "var(--ios-fill, rgba(120,120,128,0.12))",
            color: "var(--ios-label)",
            fontWeight: 600,
            fontSize: 16,
            border: "none",
          }}
        >
          Cancel
        </button>
      </div>

      <div style={{ height: 24 }} />
    </>
  );
}
