"use client";

// A parent's controls for the child's own iPad.
//
// Three jobs, in the order a parent does them the first time: choose the
// four-digit secret number, set up the iPad with a one-time code, and then
// see the iPad in a list where it can be locked or removed. Every write goes
// through kid-access-actions.ts, which re-checks the caller is a parent.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KidAccessSummary } from "../_lib/children";
import { createKidPairing, lockKidDevice, removeKidDevice, setKidPin } from "../_lib/kid-access-actions";

function ago(iso: string | null): string {
  if (!iso) return "not yet";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const field: React.CSSProperties = { fontSize: 17, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "var(--ios-cell)", color: "var(--ios-label)", minWidth: 0 };

export default function KidIpadPanel({ childId, first, access }: { childId: string; first: string; access: KidAccessSummary | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ ok?: string; err?: string } | null>(null);
  const [label, setLabel] = useState(`${first}'s iPad`);
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [pairErr, setPairErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  if (!access) {
    return (
      <div className="ios-list" style={{ margin: "0 var(--ios-gutter)", padding: 16 }}>
        <p className="ios-subhead" style={{ margin: 0, color: "var(--ios-label-2)" }}>
          One step before this works: run <code>supabase/migrations/20261117_kid_devices.sql</code> in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const link = pairing && typeof window !== "undefined" ? `${window.location.origin}/kid?code=${pairing.code}` : "";

  function savePin(e: React.FormEvent) {
    e.preventDefault();
    setPinMsg(null);
    start(async () => {
      const r = await setKidPin(childId, pin);
      if (r.error) { setPinMsg({ err: r.error }); return; }
      setPin("");
      setPinMsg({ ok: `Saved. ${first} types this on the iPad.` });
      router.refresh();
    });
  }

  function makeCode() {
    setPairErr(null);
    start(async () => {
      const r = await createKidPairing(childId, label);
      if (r.error || !r.code) { setPairErr(r.error ?? "Could not make a code."); return; }
      setPairing({ code: r.code, expiresAt: r.expiresAt! });
      setCopied(false);
    });
  }

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  }

  return (
    <div style={{ display: "grid", gap: 14, margin: "0 var(--ios-gutter)" }}>
      {/* 1. The secret number */}
      <form onSubmit={savePin} className="ios-list" style={{ padding: 16, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <strong style={{ fontSize: 17 }}>1. {first}&rsquo;s secret number</strong>
          <span className="ios-caption" style={{ color: access.hasPin ? "var(--ios-green)" : "var(--ios-orange)", fontWeight: 700 }}>{access.hasPin ? "Set ✓" : "Not set"}</span>
        </div>
        <p className="ios-footnote" style={{ margin: 0, color: "var(--ios-label-2)" }}>
          Four digits {first} can remember. Avoid 1234 or 1111. {access.hasPin ? "Typing a new one replaces the old one." : ""}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <label htmlFor={`kid-pin-${childId}`} className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Four-digit number</label>
          <input id={`kid-pin-${childId}`} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric" autoComplete="off" type="password" placeholder="••••" maxLength={4}
            style={{ ...field, width: 120, letterSpacing: "0.3em", textAlign: "center", fontSize: 22 }} />
          <button type="submit" className="ios-btn" disabled={pending || pin.length !== 4} style={{ flex: 1 }}>{access.hasPin ? "Change number" : "Save number"}</button>
        </div>
        {pinMsg?.ok && <p role="status" className="ios-footnote" style={{ margin: 0, color: "var(--ios-green)" }}>{pinMsg.ok}</p>}
        {pinMsg?.err && <p role="alert" className="ios-footnote" style={{ margin: 0, color: "var(--ios-red)" }}>{pinMsg.err}</p>}
      </form>

      {/* 2. Set up the iPad */}
      <div className="ios-list" style={{ padding: 16, display: "grid", gap: 10 }}>
        <strong style={{ fontSize: 17 }}>2. Set up the iPad</strong>
        {!pairing ? (
          <>
            <p className="ios-footnote" style={{ margin: 0, color: "var(--ios-label-2)" }}>
              Makes a one-time code that lasts 15 minutes. Nobody signs in on {first}&rsquo;s iPad, so it can only ever open {first}&rsquo;s own screen.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label htmlFor={`kid-label-${childId}`} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Name for this iPad</label>
              <input id={`kid-label-${childId}`} value={label} onChange={(e) => setLabel(e.target.value.slice(0, 40))} style={{ ...field, flex: "1 1 160px" }} />
              <button type="button" className="ios-btn ios-btn--primary" onClick={makeCode} disabled={pending} style={{ flex: "1 1 160px", width: "auto" }}>Set up an iPad</button>
            </div>
            {pairErr && <p role="alert" className="ios-footnote" style={{ margin: 0, color: "var(--ios-red)" }}>{pairErr}</p>}
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 34, fontWeight: 700, letterSpacing: "0.12em", padding: "6px 0" }}>{pairing.code}</div>
            <ol className="ios-footnote" style={{ margin: 0, paddingLeft: 20, color: "var(--ios-label-2)", display: "grid", gap: 4 }}>
              <li>On {first}&rsquo;s iPad, open Safari and go to <strong>{typeof window !== "undefined" ? window.location.host : "morrisai.family"}/kid</strong>, or send the link below to the iPad.</li>
              <li>Type the code and tap <strong>Set up this iPad</strong>.</li>
              <li>Tap Share, then <strong>Add to Home Screen</strong>. That icon is {first}&rsquo;s front door.</li>
            </ol>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <code style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "var(--ios-label-2)", userSelect: "all" }}>{link}</code>
              <button type="button" className="ios-btn" onClick={copy} style={{ width: "auto" }}>{copied ? "Copied" : "Copy link"}</button>
            </div>
            <p className="ios-caption" style={{ margin: 0, color: "var(--ios-label-3)" }}>
              Works once, until {new Date(pairing.expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.{" "}
              <button type="button" onClick={() => { setPairing(null); router.refresh(); }} style={{ background: "none", border: "none", padding: 0, color: "var(--ios-tint)", font: "inherit", cursor: "pointer" }}>Done</button>
            </p>
          </>
        )}
      </div>

      {/* 3. The iPads */}
      <div className="ios-list" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px" }}><strong style={{ fontSize: 17 }}>3. {first}&rsquo;s iPads</strong></div>
        {access.devices.length === 0 && (
          <p className="ios-footnote" style={{ margin: 0, padding: "0 16px 14px", color: "var(--ios-label-2)" }}>None yet. An iPad appears here once its code has been used.</p>
        )}
        {access.devices.map((d) => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--ios-separator)", flexWrap: "wrap" }}>
            <span aria-hidden style={{ fontSize: 24 }}>📱</span>
            <span style={{ flex: "1 1 160px", minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600 }}>{d.label}</span>
              <span className="ios-caption" style={{ color: "var(--ios-label-2)" }}>
                {d.lockedUntil ? "Keypad resting after wrong tries" : d.unlocked ? "Unlocked" : "Locked"} · used {ago(d.lastSeenAt)}
              </span>
            </span>
            {confirmRemove === d.id ? (
              <span style={{ display: "flex", gap: 8 }}>
                <button type="button" className="ios-btn" style={{ width: "auto", color: "var(--ios-red)" }} disabled={pending}
                  onClick={() => start(async () => { await removeKidDevice(childId, d.id); setConfirmRemove(null); router.refresh(); })}>Remove it</button>
                <button type="button" className="ios-btn" style={{ width: "auto" }} onClick={() => setConfirmRemove(null)}>Keep</button>
              </span>
            ) : (
              <span style={{ display: "flex", gap: 8 }}>
                {d.unlocked && <button type="button" className="ios-btn" style={{ width: "auto" }} disabled={pending}
                  onClick={() => start(async () => { await lockKidDevice(childId, d.id); router.refresh(); })}>Lock now</button>}
                <button type="button" className="ios-btn" style={{ width: "auto" }} onClick={() => setConfirmRemove(d.id)}>Remove</button>
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="ios-caption" style={{ margin: 0, color: "var(--ios-label-3)", lineHeight: 1.45 }}>
        {first} stays unlocked for 12 hours, then types the number again. To keep {first} inside this one app, turn on Guided Access on the iPad: Settings → Accessibility → Guided Access.
      </p>
    </div>
  );
}
