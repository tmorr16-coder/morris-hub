"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeEstimate,
  emptyInput,
  type EstimateInput,
  type W2,
} from "../_lib/estimate";
import type { TaxDocExtract } from "@/app/api/finance/tax/extract/route";

function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function pct(n: number): string { return `${n.toFixed(1)}%`; }

interface SavedRow { tax_year: number; inputs: EstimateInput; results: unknown; updated_at: string; }

let w2Counter = 100;
function newW2(): W2 {
  w2Counter += 1;
  return { id: `w2-${w2Counter}`, employer: "", wages: 0, federalWithholding: 0, stateWithholding: 0, localWithholding: 0 };
}

export default function TaxEstimatorClient({
  seedFiling,
  seedStateRate,
}: {
  seedFiling: "mfj" | "single";
  seedStateRate?: number;
}) {
  const currentYear = new Date().getFullYear();
  const [input, setInput] = useState<EstimateInput>(() => {
    const base = emptyInput(currentYear);
    base.filing = seedFiling;
    if (seedStateRate != null && seedStateRate > 0) base.stateRate = seedStateRate;
    return base;
  });
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [upload, setUpload] = useState<{ busy: boolean; msg: string | null; error: boolean }>({ busy: false, msg: null, error: false });
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => computeEstimate(input), [input]);

  // Load saved estimates; auto-load the one for this year if present.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/finance/tax/estimate");
        if (!res.ok) return;
        const data = await res.json();
        if (!alive || !Array.isArray(data.estimates)) return;
        setSaved(data.estimates);
        const match = data.estimates.find((e: SavedRow) => e.tax_year === currentYear);
        if (match?.inputs) setInput({ ...emptyInput(currentYear), ...match.inputs });
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [currentYear]);

  function patch(p: Partial<EstimateInput>) {
    setInput((cur) => ({ ...cur, ...p }));
    setSaveState("idle");
  }
  function patchW2(id: string, p: Partial<W2>) {
    setInput((cur) => ({ ...cur, w2s: cur.w2s.map((w) => (w.id === id ? { ...w, ...p } : w)) }));
    setSaveState("idle");
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUpload({ busy: true, msg: "Reading document…", error: false });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/finance/tax/extract", { method: "POST", body: fd });
      const data: TaxDocExtract & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");

      if (data.doc_type === "w2" && data.w2) {
        const w = data.w2;
        setInput((cur) => {
          // Fill the first blank W-2, else append a new one.
          const blankIdx = cur.w2s.findIndex((x) => !x.employer && !x.wages && !x.federalWithholding);
          const filled: W2 = {
            id: blankIdx >= 0 ? cur.w2s[blankIdx].id : newW2().id,
            employer: w.employer || "",
            wages: w.wages || 0,
            federalWithholding: w.federal_withholding || 0,
            stateWithholding: w.state_withholding || 0,
            localWithholding: w.local_withholding || 0,
          };
          const w2s = blankIdx >= 0
            ? cur.w2s.map((x, i) => (i === blankIdx ? filled : x))
            : [...cur.w2s, filled];
          return { ...cur, w2s };
        });
        setUpload({ busy: false, msg: `Added W-2${w.employer ? ` — ${w.employer}` : ""} (${money(w.wages || 0)} wages).`, error: false });
      } else if (data.doc_type === "1040" && data.prior_return) {
        const r = data.prior_return;
        setInput((cur) => ({
          ...cur,
          filing: r.filing ?? cur.filing,
          itemize: r.itemized_deductions != null && r.itemized_deductions > 0 ? true : cur.itemize,
          itemizedTotal: r.itemized_deductions ?? cur.itemizedTotal,
          qualifiedDividends: r.qualified_dividends ?? cur.qualifiedDividends,
          capitalGains: r.capital_gains ?? cur.capitalGains,
        }));
        setUpload({ busy: false, msg: `Loaded prior return${r.agi != null ? ` — AGI ${money(r.agi)}` : ""} as a starting point. Adjust figures for next year.`, error: false });
      } else {
        setUpload({ busy: false, msg: "Couldn't recognize that as a W-2 or 1040. Enter figures manually.", error: true });
      }
    } catch (err) {
      setUpload({ busy: false, msg: (err as Error).message, error: true });
    }
  }

  async function save() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/finance/tax/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tax_year: input.taxYear, inputs: input, results: result }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
      setSaved((cur) => {
        const others = cur.filter((e) => e.tax_year !== input.taxYear);
        return [{ tax_year: input.taxYear, inputs: input, results: result, updated_at: new Date().toISOString() }, ...others]
          .sort((a, b) => b.tax_year - a.tax_year);
      });
    } catch {
      setSaveState("error");
    }
  }

  const refund = result.totalRefundOrOwe >= 0;
  const otherYears = saved.filter((e) => e.tax_year !== input.taxYear);

  return (
    <div>
      {/* ── Result hero ─────────────────────────────────────────── */}
      <div className="ios-list" style={{ margin: "0 0 8px", padding: 20 }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {refund ? "Estimated refund" : "Estimated amount you'll owe"} · {input.taxYear}
        </div>
        <div className="ios-num" style={{ fontSize: 38, fontWeight: 700, marginTop: 4, color: refund ? "var(--ios-green)" : "var(--ios-red, #FF3B30)" }}>
          {money(Math.abs(result.totalRefundOrOwe))}
        </div>
        <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
          {refund ? "expected back" : "expected due at filing"} · federal {money(Math.abs(result.federalRefundOrOwe))} {result.federalRefundOrOwe >= 0 ? "refund" : "owed"} · state {money(Math.abs(result.stateRefundOrOwe))} {result.stateRefundOrOwe >= 0 ? "refund" : "owed"}
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
          <Stat label="Total tax" value={money(result.totalTax)} />
          <Stat label="Effective rate" value={pct(result.effectiveRate * 100)} />
          <Stat label="Marginal rate" value={pct(result.marginalRate * 100)} />
          <Stat label="AGI" value={money(result.agi)} />
        </div>
      </div>

      {/* ── Upload ──────────────────────────────────────────────── */}
      <div className="ios-list" style={{ margin: "0 0 8px", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="ios-headline">Upload a W-2 or prior return</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>PDF or photo — we read the figures to pre-fill. Not stored.</div>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={upload.busy}
            style={{ padding: "9px 16px", borderRadius: 10, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 600, fontSize: 15, cursor: "pointer", opacity: upload.busy ? 0.6 : 1 }}
          >
            {upload.busy ? "Reading…" : "Upload"}
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={onUpload} style={{ display: "none" }} />
        </div>
        {upload.msg && (
          <div className="ios-footnote" style={{ marginTop: 10, lineHeight: 1.5, color: upload.error ? "var(--ios-red, #FF3B30)" : "var(--ios-green)" }}>
            {upload.msg}
          </div>
        )}
      </div>

      {/* ── Filing & year ───────────────────────────────────────── */}
      <Section title="Filing">
        <Row label="Tax year">
          <NumField value={input.taxYear} onChange={(v) => patch({ taxYear: Math.round(v) })} money={false} width={90} />
        </Row>
        <Row label="Filing status">
          <div style={{ display: "flex", gap: 6 }}>
            {(["mfj", "single"] as const).map((f) => (
              <button key={f} onClick={() => patch({ filing: f })}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--ios-separator)", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  background: input.filing === f ? "var(--ios-tint)" : "transparent", color: input.filing === f ? "var(--ios-on-tint)" : "var(--ios-label)" }}>
                {f === "mfj" ? "Married joint" : "Single"}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      {/* ── W-2 income ──────────────────────────────────────────── */}
      <div className="ios-group-header" style={{ padding: "12px 0 7px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>W-2 WAGE INCOME</span>
        <button onClick={() => patch({ w2s: [...input.w2s, newW2()] })} style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>+ Add W-2</button>
      </div>
      <div className="ios-list" style={{ margin: 0, padding: 0 }}>
        {input.w2s.map((w, i) => (
          <div key={w.id} style={{ padding: 16, borderBottom: i < input.w2s.length - 1 ? "1px solid var(--ios-separator)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <input value={w.employer} onChange={(e) => patchW2(w.id, { employer: e.target.value })} placeholder={`Employer ${i + 1}`}
                style={{ flex: 1, background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 15, color: "var(--ios-label)" }} />
              {input.w2s.length > 1 && (
                <button onClick={() => patch({ w2s: input.w2s.filter((x) => x.id !== w.id) })}
                  style={{ background: "none", border: "none", color: "var(--ios-red, #FF3B30)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
              )}
            </div>
            <Row label="Wages (box 1)"><NumField value={w.wages} onChange={(v) => patchW2(w.id, { wages: v })} /></Row>
            <Row label="Federal withheld (box 2)"><NumField value={w.federalWithholding} onChange={(v) => patchW2(w.id, { federalWithholding: v })} /></Row>
            <Row label="State withheld (box 17)"><NumField value={w.stateWithholding} onChange={(v) => patchW2(w.id, { stateWithholding: v })} /></Row>
            <Row label="Local withheld (box 19)"><NumField value={w.localWithholding} onChange={(v) => patchW2(w.id, { localWithholding: v })} /></Row>
          </div>
        ))}
      </div>

      {/* ── Other income ────────────────────────────────────────── */}
      <Section title="Other income">
        <Row label="Interest"><NumField value={input.interestIncome} onChange={(v) => patch({ interestIncome: v })} /></Row>
        <Row label="Ordinary dividends"><NumField value={input.ordinaryDividends} onChange={(v) => patch({ ordinaryDividends: v })} /></Row>
        <Row label="…of which qualified"><NumField value={input.qualifiedDividends} onChange={(v) => patch({ qualifiedDividends: v })} /></Row>
        <Row label="Long-term capital gains"><NumField value={input.capitalGains} onChange={(v) => patch({ capitalGains: v })} /></Row>
        <Row label="Business / K-1"><NumField value={input.businessIncome} onChange={(v) => patch({ businessIncome: v })} /></Row>
        <Row label="Rental / other"><NumField value={input.otherIncome} onChange={(v) => patch({ otherIncome: v })} /></Row>
      </Section>

      {/* ── Adjustments ─────────────────────────────────────────── */}
      <Section title="Adjustments (reduce AGI)">
        <Row label="Deductible IRA"><NumField value={input.iraDeduction} onChange={(v) => patch({ iraDeduction: v })} /></Row>
        <Row label="HSA contribution"><NumField value={input.hsaDeduction} onChange={(v) => patch({ hsaDeduction: v })} /></Row>
        <Row label="Other adjustments"><NumField value={input.otherAdjustments} onChange={(v) => patch({ otherAdjustments: v })} /></Row>
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "2px 0 0", lineHeight: 1.4 }}>
          401(k)/pre-tax payroll deferrals are already excluded from W-2 box 1 — don&apos;t re-enter them here.
        </div>
      </Section>

      {/* ── Deductions ──────────────────────────────────────────── */}
      <Section title="Deductions">
        <Row label="Itemize?">
          <div style={{ display: "flex", gap: 6 }}>
            {[false, true].map((v) => (
              <button key={String(v)} onClick={() => patch({ itemize: v })}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--ios-separator)", fontSize: 14, fontWeight: 600, cursor: "pointer",
                  background: input.itemize === v ? "var(--ios-tint)" : "transparent", color: input.itemize === v ? "var(--ios-on-tint)" : "var(--ios-label)" }}>
                {v ? "Itemize" : "Standard"}
              </button>
            ))}
          </div>
        </Row>
        {input.itemize && (
          <Row label="Itemized total"><NumField value={input.itemizedTotal} onChange={(v) => patch({ itemizedTotal: v })} /></Row>
        )}
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "2px 0 0", lineHeight: 1.4 }}>
          Using {result.deductionKind === "itemized" ? "itemized" : "standard"} deduction of {money(result.deduction)}
          {input.itemize && result.deductionKind === "standard" ? " — standard is higher, so it wins." : ""}.
        </div>
      </Section>

      {/* ── Credits & payments ──────────────────────────────────── */}
      <Section title="Credits & estimated payments">
        <Row label="Tax credits (CTC, etc.)"><NumField value={input.credits} onChange={(v) => patch({ credits: v })} /></Row>
        <Row label="Federal est. payments"><NumField value={input.federalEstPayments} onChange={(v) => patch({ federalEstPayments: v })} /></Row>
        <Row label="State est. payments"><NumField value={input.stateEstPayments} onChange={(v) => patch({ stateEstPayments: v })} /></Row>
      </Section>

      {/* ── State / local ───────────────────────────────────────── */}
      <Section title="State & local tax">
        <Row label="Effective state+local rate">
          <NumField value={input.stateRate} onChange={(v) => patch({ stateRate: v })} money={false} suffix="%" width={90} />
        </Row>
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "2px 0 0", lineHeight: 1.4 }}>
          Combined state income + county/local rate applied to AGI. Indiana is ~3.05% state + your county rate.
        </div>
      </Section>

      {/* ── Breakdown ───────────────────────────────────────────── */}
      <Section title="How it's calculated">
        <BreakRow label="Total income" value={money(result.totalIncome)} />
        <BreakRow label="Adjustments" value={`− ${money(result.adjustments)}`} />
        <BreakRow label="AGI" value={money(result.agi)} strong />
        <BreakRow label={`${result.deductionKind === "itemized" ? "Itemized" : "Standard"} deduction`} value={`− ${money(result.deduction)}`} />
        <BreakRow label="Taxable (ordinary)" value={money(result.taxableOrdinary)} />
        <div style={{ height: 8 }} />
        <BreakRow label="Federal income tax" value={money(result.federalIncomeTax)} />
        {result.ltcgTax > 0 && <BreakRow label={`— incl. LTCG @ ${pct(result.ltcgRatePct)}`} value={money(result.ltcgTax)} sub />}
        {result.additionalMedicare > 0 && <BreakRow label="Additional Medicare (0.9%)" value={money(result.additionalMedicare)} />}
        {result.niit > 0 && <BreakRow label="Net investment income tax (3.8%)" value={money(result.niit)} />}
        {input.credits > 0 && <BreakRow label="Credits" value={`− ${money(input.credits)}`} />}
        <BreakRow label="Federal total" value={money(result.federalTotal)} strong />
        <BreakRow label="Federal paid (w/h + est.)" value={money(result.federalPaid)} />
        <div style={{ height: 8 }} />
        <BreakRow label="State & local tax" value={money(result.stateTax)} />
        <BreakRow label="State paid (w/h + est.)" value={money(result.statePaid)} />
      </Section>

      {/* ── Save ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 8px" }}>
        <button onClick={save} disabled={saveState === "saving"}
          style={{ padding: "12px 22px", borderRadius: 12, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer", opacity: saveState === "saving" ? 0.6 : 1 }}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save estimate"}
        </button>
        {saveState === "error" && <span className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)" }}>Couldn&apos;t save — try again.</span>}
        {saveState === "saved" && <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Saved to your account for {input.taxYear}.</span>}
      </div>

      {/* ── Saved years ─────────────────────────────────────────── */}
      {otherYears.length > 0 && (
        <>
          <div className="ios-group-header" style={{ padding: "12px 0 7px" }}>SAVED ESTIMATES</div>
          <div className="ios-list" style={{ margin: 0 }}>
            {otherYears.map((e) => (
              <button key={e.tax_year} onClick={() => setInput({ ...emptyInput(e.tax_year), ...e.inputs })}
                className="ios-cell" style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: 16, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <span className="ios-headline">{e.tax_year} estimate</span>
                <span className="ios-subhead" style={{ color: "var(--ios-tint)" }}>Load →</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Small building blocks ─────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="ios-num" style={{ fontSize: 17, fontWeight: 600 }}>{value}</div>
      <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="ios-group-header" style={{ padding: "12px 0 7px" }}>{title.toUpperCase()}</div>
      <div className="ios-list" style={{ margin: 0, padding: 16 }}>{children}</div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 38 }}>
      <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>{label}</span>
      {children}
    </div>
  );
}

function BreakRow({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", paddingLeft: sub ? 12 : 0 }}>
      <span className={sub ? "ios-caption" : "ios-subhead"} style={{ color: sub ? "var(--ios-label-3)" : "var(--ios-label-2)", fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span className={sub ? "ios-caption" : "ios-subhead"} style={{ color: strong ? "var(--ios-label)" : "var(--ios-label-2)", fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  );
}

function NumField({ value, onChange, money: isMoney = true, suffix, width = 130 }: {
  value: number; onChange: (v: number) => void; money?: boolean; suffix?: string; width?: number;
}) {
  const [text, setText] = useState<string>(value ? String(value) : "");
  const lastValue = useRef(value);
  // Sync when the value changes externally (upload prefill, load saved).
  useEffect(() => {
    if (value !== lastValue.current) { setText(value ? String(value) : ""); lastValue.current = value; }
  }, [value]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--ios-fill)", borderRadius: 8, padding: "0 10px", width }}>
      {isMoney && <span style={{ color: "var(--ios-label-3)", fontSize: 15 }}>$</span>}
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9.]/g, "");
          setText(t);
          const n = parseFloat(t);
          lastValue.current = isNaN(n) ? 0 : n;
          onChange(isNaN(n) ? 0 : n);
        }}
        style={{ flex: 1, background: "none", border: "none", padding: "8px 0", fontSize: 15, color: "var(--ios-label)", textAlign: "right", width: "100%", minWidth: 0 }}
      />
      {suffix && <span style={{ color: "var(--ios-label-3)", fontSize: 15 }}>{suffix}</span>}
    </div>
  );
}
