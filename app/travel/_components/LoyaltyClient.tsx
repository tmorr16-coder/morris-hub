"use client";

import { useState } from "react";
import { LOYALTY_CATEGORIES, type LoyaltyProgram } from "../types";

function points(n: number | null): string {
  if (n == null) return "";
  return `${new Intl.NumberFormat("en-US").format(n)} pts`;
}

const BLANK = { category: "air", program_name: "", member_number: "", tier: "", points_balance: "", notes: "" };

export default function LoyaltyClient({ initial }: { initial: LoyaltyProgram[] }) {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!form.program_name.trim()) return;
    setBusy(true);
    try {
      const body = {
        category: form.category,
        program_name: form.program_name.trim(),
        member_number: form.member_number.trim() || null,
        tier: form.tier.trim() || null,
        points_balance: form.points_balance ? parseFloat(form.points_balance) : null,
        notes: form.notes.trim() || null,
      };
      const res = await fetch("/api/travel/loyalty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        setPrograms((p) => [...p, { id: data.id, ...body } as LoyaltyProgram]);
        setForm({ ...BLANK });
        setAdding(false);
      }
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    setPrograms((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/travel/loyalty?id=${id}`, { method: "DELETE" });
  }

  const grouped = LOYALTY_CATEGORIES.map((c) => ({ ...c, items: programs.filter((p) => p.category === c.key) })).filter((g) => g.items.length > 0);

  return (
    <div>
      {grouped.map((g) => (
        <div key={g.key}>
          <div className="ios-group-header" style={{ padding: "12px 0 7px" }}>{g.label.toUpperCase()}</div>
          <div className="ios-list" style={{ margin: 0 }}>
            {g.items.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderBottom: i < g.items.length - 1 ? "1px solid var(--ios-separator)" : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="ios-headline" style={{ fontSize: 16 }}>{p.program_name}</div>
                  <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                    {[p.tier, p.member_number, points(p.points_balance)].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <button onClick={() => remove(p.id)} aria-label="Remove" style={{ background: "none", border: "none", color: "var(--ios-red, #FF3B30)", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>×</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {programs.length === 0 && !adding && (
        <div className="ios-list" style={{ margin: "8px 0", padding: 18 }}>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>No programs yet. Add your airline, hotel, car, rail, and travel-card memberships.</div>
        </div>
      )}

      {adding ? (
        <div className="ios-list" style={{ margin: "12px 0", padding: 16 }}>
          <Field label="Type">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={sel}>
              {LOYALTY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Program"><Inp value={form.program_name} onChange={(v) => setForm({ ...form, program_name: v })} placeholder="United MileagePlus" /></Field>
          <Field label="Member #"><Inp value={form.member_number} onChange={(v) => setForm({ ...form, member_number: v })} placeholder="optional" /></Field>
          <Field label="Tier / status"><Inp value={form.tier} onChange={(v) => setForm({ ...form, tier: v })} placeholder="Gold" /></Field>
          <Field label="Points balance"><Inp value={form.points_balance} onChange={(v) => setForm({ ...form, points_balance: v.replace(/[^0-9.]/g, "") })} placeholder="0" /></Field>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button onClick={add} disabled={busy || !form.program_name.trim()} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
            <button onClick={() => { setAdding(false); setForm({ ...BLANK }); }} style={{ padding: "11px 18px", borderRadius: 10, background: "var(--ios-fill)", color: "var(--ios-label)", border: "none", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: "100%", marginTop: 14, padding: "12px 0", borderRadius: 12, background: "var(--ios-fill)", color: "var(--ios-tint)", border: "none", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
          + Add program
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}><span className="ios-subhead">{label}</span>{children}</div>;
}
function Inp({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ width: 180, background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 15, color: "var(--ios-label)", textAlign: "right" }} />;
}
const sel: React.CSSProperties = { width: 180, background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 15, color: "var(--ios-label)", textAlign: "right" };
