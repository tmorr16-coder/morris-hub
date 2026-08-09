"use client";

import { useState } from "react";
import { GENDERS, SEAT_PREFS, type Traveler } from "../types";
import type { FamilySuggestion } from "../travelers/page";

type Draft = Partial<Traveler>;

const BLANK: Draft = { seat_pref: "no_pref", gender: "x" };

export default function TravelersClient({
  initial, suggestions, selfName,
}: {
  initial: Traveler[]; suggestions: FamilySuggestion[]; selfName: string;
}) {
  const [travelers, setTravelers] = useState<Traveler[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const usedNames = new Set(travelers.map((t) => `${t.given_name ?? ""} ${t.family_name ?? ""}`.trim().toLowerCase()));

  function startFromSuggestion(s: FamilySuggestion) {
    const isSelf = s.id === "self";
    const parts = (isSelf ? selfName : s.name).replace(/\s*\(you\)$/, "").trim().split(/\s+/);
    setDraft({
      ...BLANK,
      is_self: isSelf,
      family_member_id: isSelf ? null : s.id,
      given_name: parts[0] ?? "",
      family_name: parts.slice(1).join(" "),
    });
  }

  async function save() {
    if (!draft || (!draft.given_name && !draft.family_name)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/travel/travelers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await res.json();
      if (res.ok) {
        if (draft.id) setTravelers((t) => t.map((x) => (x.id === draft.id ? { ...(x), ...(draft as Traveler) } : x)));
        else setTravelers((t) => [...t, { ...(draft as Traveler), id: data.id }]);
        setDraft(null);
      }
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    setTravelers((t) => t.filter((x) => x.id !== id));
    await fetch(`/api/travel/travelers?id=${id}`, { method: "DELETE" });
  }

  return (
    <div>
      {/* Saved travelers */}
      {travelers.length > 0 && (
        <div className="ios-list" style={{ margin: "0 0 8px" }}>
          {travelers.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderBottom: i < travelers.length - 1 ? "1px solid var(--ios-separator)" : "none" }}>
              <div style={{ minWidth: 0 }}>
                <div className="ios-headline" style={{ fontSize: 16 }}>
                  {[t.given_name, t.family_name].filter(Boolean).join(" ") || "Traveler"}
                  {t.is_self && <span className="ios-caption" style={{ color: "var(--ios-tint)", marginLeft: 6 }}>you</span>}
                </div>
                <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                  {[t.date_of_birth, t.passport_number ? "passport ✓" : null, t.known_traveler_number ? "KTN ✓" : null].filter(Boolean).join(" · ") || "tap to complete details"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setDraft(t)} style={{ background: "none", border: "none", color: "var(--ios-tint)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                <button onClick={() => remove(t.id)} aria-label="Remove" style={{ background: "none", border: "none", color: "var(--ios-red, #FF3B30)", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick-add from Family */}
      {!draft && (
        <>
          <div className="ios-group-header" style={{ padding: "12px 0 7px" }}>ADD A TRAVELER</div>
          <div className="ios-list" style={{ margin: 0, padding: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {suggestions.filter((s) => !usedNames.has(s.name.replace(/\s*\(you\)$/, "").trim().toLowerCase())).map((s) => (
              <button key={s.id} onClick={() => startFromSuggestion(s)}
                style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-label)", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                + {s.name}
              </button>
            ))}
            <button onClick={() => setDraft({ ...BLANK })}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-tint)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              + Someone else
            </button>
          </div>
        </>
      )}

      {/* Editor */}
      {draft && (
        <>
          <div className="ios-group-header" style={{ padding: "12px 0 7px" }}>{draft.id ? "EDIT TRAVELER" : "NEW TRAVELER"}</div>
          <div className="ios-list" style={{ margin: 0, padding: 16 }}>
            <Two>
              <Field label="First name"><Inp value={draft.given_name ?? ""} onChange={(v) => setDraft({ ...draft, given_name: v })} /></Field>
              <Field label="Last name"><Inp value={draft.family_name ?? ""} onChange={(v) => setDraft({ ...draft, family_name: v })} /></Field>
            </Two>
            <Field label="Date of birth"><Inp type="date" value={draft.date_of_birth ?? ""} onChange={(v) => setDraft({ ...draft, date_of_birth: v })} /></Field>
            <Field label="Gender">
              <Seg opts={GENDERS} value={draft.gender ?? "x"} onChange={(v) => setDraft({ ...draft, gender: v })} />
            </Field>
            <Field label="Seat preference">
              <Seg opts={SEAT_PREFS} value={draft.seat_pref ?? "no_pref"} onChange={(v) => setDraft({ ...draft, seat_pref: v })} />
            </Field>
            <Field label="Known Traveler # (PreCheck)"><Inp value={draft.known_traveler_number ?? ""} onChange={(v) => setDraft({ ...draft, known_traveler_number: v })} placeholder="optional" /></Field>

            <div className="ios-group-header" style={{ padding: "12px 0 6px" }}>PASSPORT (INTERNATIONAL ONLY)</div>
            <Field label="Passport number"><Inp value={draft.passport_number ?? ""} onChange={(v) => setDraft({ ...draft, passport_number: v })} placeholder="optional" /></Field>
            <Two>
              <Field label="Expiry"><Inp type="date" value={draft.passport_expiry ?? ""} onChange={(v) => setDraft({ ...draft, passport_expiry: v })} /></Field>
              <Field label="Country"><Inp value={draft.passport_country ?? ""} onChange={(v) => setDraft({ ...draft, passport_country: v.toUpperCase() })} placeholder="US" /></Field>
            </Two>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={save} disabled={busy || (!draft.given_name && !draft.family_name)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save traveler"}</button>
              <button onClick={() => setDraft(null)} style={{ padding: "11px 18px", borderRadius: 10, background: "var(--ios-fill)", color: "var(--ios-label)", border: "none", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Two({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 42 }}>
      <span className="ios-subhead" style={{ color: "var(--ios-label)", whiteSpace: "nowrap" }}>{label}</span>
      {children}
    </div>
  );
}
function Inp({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
    style={{ width: 150, background: "var(--ios-fill)", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 15, color: "var(--ios-label)", textAlign: "right" }} />;
}
function Seg<T extends { key: string; label: string }>({ opts, value, onChange }: { opts: readonly T[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {opts.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key)}
          style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--ios-separator)", fontSize: 13, fontWeight: 600, cursor: "pointer", background: value === o.key ? "var(--ios-tint)" : "transparent", color: value === o.key ? "var(--ios-on-tint)" : "var(--ios-label)" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
