"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    COOKIE_DOMAIN
      ? { cookieOptions: { domain: COOKIE_DOMAIN, path: "/", sameSite: "lax" } }
      : undefined
  );
}

export default function PinSettings({ currentPin }: { currentPin: string | null }) {
  const [mode, setMode] = useState<"view" | "set" | "remove">("view");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!/^\d{4}$/.test(pin)) { setErr("PIN must be exactly 4 digits"); return; }
    if (pin !== confirm) { setErr("PINs don't match"); return; }
    setSaving(true);
    try {
      const supabase = makeClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr("Not signed in"); return; }
      // Use public.profiles.id to match; hub.preferences is keyed by user_id.
      const { error } = await supabase
        .schema("hub")
        .from("preferences")
        .upsert({ user_id: user.id, finance_pin: pin }, { onConflict: "user_id" });
      if (error) { setErr(error.message); return; }
      setMsg("PIN saved"); setMode("view"); setPin(""); setConfirm("");
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed — try again");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      const supabase = makeClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErr("Not signed in"); return; }
      const { error } = await supabase
        .schema("hub")
        .from("preferences")
        .upsert({ user_id: user.id, finance_pin: null }, { onConflict: "user_id" });
      if (error) { setErr(error.message); return; }
      setMsg("PIN removed"); setMode("view");
      setTimeout(() => { setMsg(null); window.location.reload(); }, 1000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Remove failed — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h2 className="serif" style={{ fontSize: 20, marginBottom: 4 }}>Finance PIN</h2>
          <p style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
            {currentPin ? "A 4-digit PIN is set. Session unlocks for 15 minutes after entry." : "No PIN set — anyone with your account can open finance."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {currentPin && (
            <button
              onClick={() => setMode(mode === "remove" ? "view" : "remove")}
              style={removeBtn}
            >
              Remove
            </button>
          )}
          <button
            onClick={() => setMode(mode === "set" ? "view" : "set")}
            style={primaryBtn}
          >
            {currentPin ? "Change PIN" : "Set PIN"}
          </button>
        </div>
      </div>

      {msg && <p style={{ fontSize: 12, color: "var(--color-green)", marginBottom: 8 }}>✓ {msg}</p>}

      {mode === "set" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280 }}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="New 4-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/, "").slice(0, 4))}
            style={inputStyle}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="Confirm PIN"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/, "").slice(0, 4))}
            style={inputStyle}
          />
          {err && <p style={{ fontSize: 12, color: "var(--color-red)" }}>{err}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setMode("view"); setPin(""); setConfirm(""); setErr(null); }} style={cancelBtn}>Cancel</button>
            <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? "Saving…" : "Save PIN"}</button>
          </div>
        </div>
      )}

      {mode === "remove" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)" }}>Remove PIN?</p>
          <button onClick={() => setMode("view")} style={cancelBtn}>Cancel</button>
          <button onClick={remove} disabled={saving} style={removeBtn}>{saving ? "Removing…" : "Yes, remove"}</button>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 8, border: "1px solid var(--color-rule)",
  background: "var(--color-paper)", color: "var(--color-ink)", fontSize: 18,
  fontFamily: "var(--font-mono)", letterSpacing: "0.3em", outline: "none",
  boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-bronze)",
  background: "var(--color-bronze)", color: "#fff", fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};
const removeBtn: React.CSSProperties = {
  ...primaryBtn, background: "transparent",
  border: "1px solid var(--color-red)", color: "var(--color-red)",
};
const cancelBtn: React.CSSProperties = {
  ...primaryBtn, background: "transparent",
  border: "1px solid var(--color-rule)", color: "var(--color-ink-3)",
};
