"use client";

import { useState, useTransition } from "react";
import { Chip } from "@/components/ios";
import { saveBudget, deleteBudget } from "../actions";

// Budgets, as a list a person can edit in place.
//
// One row per budget: the bar is this month, the tick on it is the pace, the
// tag says which side of the line the month is on. Editing happens on the
// row, not on another screen; a budget is three numbers and a switch.

export interface BudgetRowData {
  id: string;
  category: string;
  label: string;
  limit: number;
  spent: number;
  pct: number;
  projected: number | null;
  remaining: number;
  daysLeft: number;
  perDayLeft: number | null;
  state: "ok" | "warn" | "projected" | "over";
  warnAtPct: number;
  notifySms: boolean;
  count: number;
}

export interface CategoryOption { value: string; label: string; suggested: number | null; recentMonthly: number | null }

const STATE: Record<BudgetRowData["state"], { label: string; color: string }> = {
  ok: { label: "On track", color: "var(--ios-green)" },
  warn: { label: "Close", color: "var(--ios-orange)" },
  projected: { label: "On pace to go over", color: "var(--ios-orange)" },
  over: { label: "Over", color: "var(--ios-red)" },
};

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function BudgetList({ rows, categories, smsAvailable }: { rows: BudgetRowData[]; categories: CategoryOption[]; smsAvailable: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);   // budget id, or "new"
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const taken = new Set(rows.map((r) => r.category));
  const available = categories.filter((c) => !taken.has(c.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {notice && (
        <div className="ios-list" style={{ margin: 0, padding: "10px 14px" }}>
          <span className="ios-subhead">{notice}</span>
        </div>
      )}

      <div className="ios-list" style={{ margin: 0, overflow: "hidden" }} id="budgets">
        {rows.length === 0 && editing !== "new" && (
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "24px 16px", margin: 0 }}>
            No budgets yet. Add one below — the suggested limit is what the category has actually cost on average over the last three months.
          </p>
        )}
        {rows.map((r, idx) => {
          const st = STATE[r.state];
          const fill = Math.min(100, r.pct * 100);
          const paceMark = r.projected != null ? Math.min(100, (r.projected / r.limit) * 100) : null;
          const isEditing = editing === r.id;
          return (
            <div key={r.id} style={{ padding: "12px 16px", boxShadow: idx === 0 ? undefined : "inset 0 0.5px 0 0 var(--ios-separator)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                  <span className="ios-callout" style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                  <span className="ios-caption" style={{ color: st.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{st.label}</span>
                </span>
                <span className="ios-num ios-callout" style={{ whiteSpace: "nowrap" }}>
                  <span style={{ fontWeight: 700, color: r.state === "over" ? "var(--ios-red)" : "inherit" }}>{fmt(r.spent)}</span>
                  <span style={{ color: "var(--ios-label-3)" }}> / {fmt(r.limit)}</span>
                </span>
              </div>

              <div style={{ position: "relative", height: 8, borderRadius: 4, background: "var(--ios-fill)", marginTop: 8, overflow: "visible" }}>
                <div style={{ width: `${fill}%`, height: "100%", borderRadius: 4, background: st.color, transition: "width 0.3s ease" }} />
                {paceMark != null && paceMark > fill && (
                  <span title={`On pace for ${fmt(r.projected ?? 0)}`} aria-hidden style={{ position: "absolute", left: `${paceMark}%`, top: -3, width: 2, height: 14, background: "var(--ios-label-2)", transform: "translateX(-1px)" }} />
                )}
              </div>

              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <span>
                  {r.remaining >= 0 ? `${fmt(r.remaining)} left` : `${fmt(-r.remaining)} over`} · {r.daysLeft} day{r.daysLeft === 1 ? "" : "s"} to go
                  {r.perDayLeft != null && r.state !== "over" ? ` · about ${fmt(r.perDayLeft)} a day` : ""}
                  {r.projected != null ? ` · pace ${fmt(r.projected)}` : ""}
                </span>
                <span style={{ display: "flex", gap: 12 }}>
                  <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>warn at {r.warnAtPct}%{r.notifySms ? " · texts on" : ""}</span>
                  <button type="button" className="ios-btn--plain" onClick={() => setEditing(isEditing ? null : r.id)} style={{ color: "var(--ios-tint)", fontWeight: 600, fontSize: 13 }}>{isEditing ? "Close" : "Edit"}</button>
                </span>
              </div>

              {isEditing && (
                <BudgetForm
                  key={r.id}
                  initial={{ id: r.id, category: r.category, label: r.label, limit: r.limit, warnAtPct: r.warnAtPct, notifySms: r.notifySms }}
                  categories={[]}
                  smsAvailable={smsAvailable}
                  pending={pending}
                  onSave={(v) => start(async () => {
                    const res = await saveBudget({ id: r.id, category: r.category, monthlyLimit: v.limit, warnAtPct: v.warnAtPct, notifySms: v.notifySms });
                    setNotice(res.error ? `Couldn't save: ${res.error}` : `${r.label} budget set to ${fmt(v.limit)}.`);
                    if (!res.error) setEditing(null);
                  })}
                  onDelete={() => start(async () => {
                    const res = await deleteBudget(r.id);
                    setNotice(res.error ? `Couldn't remove: ${res.error}` : `${r.label} budget removed.`);
                    if (!res.error) setEditing(null);
                  })}
                />
              )}
            </div>
          );
        })}
      </div>

      {editing === "new" ? (
        <div className="ios-list" style={{ margin: 0, padding: "12px 16px" }}>
          <div className="ios-headline" style={{ marginBottom: 6 }}>New budget</div>
          <BudgetForm
            initial={null}
            categories={available}
            smsAvailable={smsAvailable}
            pending={pending}
            onCancel={() => setEditing(null)}
            onSave={(v) => start(async () => {
              const res = await saveBudget({ category: v.category, monthlyLimit: v.limit, warnAtPct: v.warnAtPct, notifySms: v.notifySms });
              setNotice(res.error ? `Couldn't save: ${res.error}` : `Budget added.`);
              if (!res.error) setEditing(null);
            })}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing("new")} disabled={available.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "12px 14px", background: "var(--ios-fill)", border: "none", borderRadius: 12, cursor: "pointer", color: "var(--ios-tint)", fontSize: 15, fontWeight: 600, fontFamily: "inherit", textAlign: "left", opacity: available.length === 0 ? 0.5 : 1 }}>
          + Add a budget
        </button>
      )}
    </div>
  );
}

function BudgetForm({ initial, categories, smsAvailable, pending, onSave, onDelete, onCancel }: {
  initial: { id: string; category: string; label: string; limit: number; warnAtPct: number; notifySms: boolean } | null;
  categories: CategoryOption[];
  smsAvailable: boolean;
  pending: boolean;
  onSave: (v: { category: string; limit: number; warnAtPct: number; notifySms: boolean }) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  const [category, setCategory] = useState(initial?.category ?? categories[0]?.value ?? "");
  const [limit, setLimit] = useState<string>(initial ? String(initial.limit) : (categories[0]?.suggested != null ? String(categories[0].suggested) : ""));
  const [warnAtPct, setWarn] = useState(initial?.warnAtPct ?? 80);
  const [notifySms, setSms] = useState(initial?.notifySms ?? false);
  const chosen = categories.find((c) => c.value === category);

  const input: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "var(--ios-fill-2)", color: "var(--ios-label)", fontSize: 16, fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
      {!initial && (
        <label style={{ display: "block" }}>
          <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Category</span>
          <select value={category} onChange={(e) => { setCategory(e.target.value); const c = categories.find((x) => x.value === e.target.value); if (c?.suggested != null) setLimit(String(c.suggested)); }} style={{ ...input, marginTop: 4 }}>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}{c.recentMonthly != null ? ` — about ${fmt(c.recentMonthly)}/mo lately` : ""}</option>
            ))}
          </select>
        </label>
      )}
      <label style={{ display: "block" }}>
        <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Monthly limit{chosen?.suggested != null ? ` · suggested ${fmt(chosen.suggested)} from the last three months` : ""}</span>
        <input type="number" inputMode="decimal" min={1} step={10} value={limit} onChange={(e) => setLimit(e.target.value)} style={{ ...input, marginTop: 4 }} />
      </label>
      <div>
        <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>Warn me at</span>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {[50, 70, 80, 90, 100].map((p) => (
            <Chip key={p} small selected={warnAtPct === p} onClick={() => setWarn(p)}>{p}%</Chip>
          ))}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={notifySms} onChange={(e) => setSms(e.target.checked)} disabled={!smsAvailable} />
        <span className="ios-footnote" style={{ color: smsAvailable ? "var(--ios-label)" : "var(--ios-label-3)" }}>
          Text me as well{smsAvailable ? "" : " — add a phone number and turn on texts in Settings first"}. Alerts always appear on Today.
        </span>
      </label>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="ios-btn ios-btn--primary" disabled={pending || !category || !(Number(limit) > 0)} onClick={() => onSave({ category, limit: Number(limit), warnAtPct, notifySms })}>
          {pending ? "Saving…" : "Save"}
        </button>
        {onCancel && <button type="button" className="ios-btn--plain" onClick={onCancel} style={{ color: "var(--ios-label-2)" }}>Cancel</button>}
        {onDelete && <button type="button" className="ios-btn--plain" onClick={onDelete} disabled={pending} style={{ color: "var(--ios-red)", marginLeft: "auto" }}>Remove budget</button>}
      </div>
    </div>
  );
}
