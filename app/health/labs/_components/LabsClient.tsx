"use client";

import { useRef, useState } from "react";

export interface LabRow {
  analyte: string;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: string;
}

export interface PanelSummary {
  id: string;
  collectedOn: string;
  panelName: string;
  labName: string | null;
  results: LabRow[];
}

/** Draft returned by extraction, before anything is written. */
interface Draft {
  collected_on: string | null;
  panel_name: string;
  lab_name: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[];
}

const flagged = (f: string) => f === "low" || f === "high" || f === "abnormal";

function refLabel(r: LabRow): string {
  if (r.refLow != null && r.refHigh != null) return `${r.refLow}–${r.refHigh}`;
  if (r.refText) return r.refText;
  if (r.refHigh != null) return `< ${r.refHigh}`;
  if (r.refLow != null) return `> ${r.refLow}`;
  return "";
}

export default function LabsClient({
  panels,
  tableMissing,
}: {
  panels: PanelSummary[];
  tableMissing: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>(panels[0]?.id ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    setDraft(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/health/labs/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read that report.");
      setDraft(data.draft as Draft);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!draft) return;
    if (!draft.collected_on) { setErr("Set the collection date before saving."); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/health/labs/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setDraft(null);
      window.location.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {tableMissing && (
        <div className="ios-list" style={{ margin: "0 0 12px", padding: 14, border: "1.5px solid var(--ios-orange, #D9772B)" }}>
          <div className="ios-subhead" style={{ fontWeight: 700, marginBottom: 4 }}>Labs aren&rsquo;t set up yet</div>
          <div className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Apply <code>20260901_lab_results.sql</code> to create the tables. Until then reports
            can be read but not saved.
          </div>
        </div>
      )}

      {/* ── Add a report ──────────────────────────────────────────────────── */}
      <div className="ios-list" style={{ margin: 0, padding: 14 }}>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.docx"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="ios-btn ios-btn--primary"
          style={{ width: "100%", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Reading…" : "Add a lab report"}
        </button>
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, lineHeight: 1.5 }}>
          The results are read out of the PDF and shown for you to check before anything is saved.
          Only the analytes are stored — not the file, and not the identifiers printed on it.
        </div>
        {err && <div className="ios-footnote" style={{ color: "var(--ios-red)", marginTop: 8 }}>{err}</div>}
      </div>

      {/* ── Review before saving ──────────────────────────────────────────── */}
      {draft && (
        <div className="ios-list" style={{ margin: "12px 0 0", padding: 14, border: "1.5px solid var(--ios-tint)" }}>
          <div className="ios-subhead" style={{ fontWeight: 700, marginBottom: 8 }}>
            Check this before saving
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <label style={{ flex: 1, minWidth: 130 }}>
              <span className="ios-caption" style={{ color: "var(--ios-label-2)", display: "block", marginBottom: 3 }}>Collected</span>
              <input
                type="date"
                value={draft.collected_on ?? ""}
                onChange={(e) => setDraft({ ...draft, collected_on: e.target.value || null })}
                style={{ width: "100%", background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 15, color: "var(--ios-label)", fontFamily: "inherit" }}
              />
            </label>
            <label style={{ flex: 2, minWidth: 160 }}>
              <span className="ios-caption" style={{ color: "var(--ios-label-2)", display: "block", marginBottom: 3 }}>Panel</span>
              <input
                value={draft.panel_name}
                onChange={(e) => setDraft({ ...draft, panel_name: e.target.value })}
                style={{ width: "100%", background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 15, color: "var(--ios-label)", fontFamily: "inherit" }}
              />
            </label>
          </div>

          <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginBottom: 6 }}>
            {draft.results.length} result{draft.results.length === 1 ? "" : "s"} read
          </div>
          <div style={{ maxHeight: "40vh", overflowY: "auto", background: "var(--ios-fill-2)", borderRadius: 8, padding: "8px 10px" }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {draft.results.map((r: any, i: number) => (
              <div key={i} className="ios-caption" style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "4px 0", color: "var(--ios-label-2)" }}>
                <span style={{ minWidth: 0 }}>{r.analyte}</span>
                <span className="ios-num" style={{ flexShrink: 0 }}>
                  {r.value_num ?? r.value_text ?? "—"}{r.unit ? ` ${r.unit}` : ""}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={busy} className="ios-btn ios-btn--primary" style={{ flex: 1 }}>
              {busy ? "Saving…" : "Save panel"}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="ios-caption"
              style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 10, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "8px 14px" }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── History ──────────────────────────────────────────────────────── */}
      {panels.length > 0 && (
        <>
          <div className="ios-group-header" style={{ padding: "18px 0 7px" }}>PANELS</div>
          {panels.map((p) => {
            const out = p.results.filter((r) => flagged(r.flag));
            const open = openPanel === p.id;
            return (
              <div key={p.id} className="ios-list" style={{ margin: "0 0 8px", padding: "12px 14px" }}>
                <button
                  onClick={() => setOpenPanel(open ? null : p.id)}
                  style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "baseline", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)", display: "block" }}>{p.panelName}</span>
                    <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>
                      {p.collectedOn} · {p.results.length} results
                      {out.length > 0 ? ` · ${out.length} outside range` : ""}
                    </span>
                  </span>
                  <span className="ios-caption" style={{ color: "var(--ios-tint)", flexShrink: 0 }}>{open ? "Hide" : "Show"}</span>
                </button>

                {open && (
                  <div style={{ marginTop: 10 }}>
                    {p.results.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--ios-separator)" }}>
                        <span className="ios-caption" style={{ color: "var(--ios-label)", minWidth: 0 }}>
                          {r.analyte}
                          {refLabel(r) && <span style={{ color: "var(--ios-label-3)" }}> · ref {refLabel(r)}</span>}
                        </span>
                        <span className="ios-caption ios-num" style={{ flexShrink: 0, fontWeight: flagged(r.flag) ? 700 : 400, color: flagged(r.flag) ? "var(--ios-orange, #D9772B)" : "var(--ios-label-2)" }}>
                          {r.value ?? r.valueText ?? "—"}{r.unit ? ` ${r.unit}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      <div className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "14px 4px 0", lineHeight: 1.5 }}>
        Reference ranges come from the report itself and differ between labs, so a value flagged
        here is flagged against that lab&rsquo;s own range. Interpreting a result is your
        doctor&rsquo;s job — this is a record, not a reading.
      </div>
    </div>
  );
}
