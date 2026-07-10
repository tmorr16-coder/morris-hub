"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Chip } from "@/components/ios";

const COOKIE_DOMAIN = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

function makeClient() {
  return createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key"),
    COOKIE_DOMAIN
      ? { cookieOptions: { domain: COOKIE_DOMAIN, path: "/", sameSite: "lax" } }
      : undefined
  );
}

const Check = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="ios-headline">Finance PIN</div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
            {currentPin ? "A 4-digit PIN is set. Session unlocks for 15 minutes after entry." : "No PIN set — anyone with your account can open finance."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {currentPin && (
            <button
              type="button"
              className="ios-btn ios-btn--plain"
              style={{ color: "var(--ios-red)", width: "auto" }}
              onClick={() => setMode(mode === "remove" ? "view" : "remove")}
            >
              Remove
            </button>
          )}
          <Chip small selected onClick={() => setMode(mode === "set" ? "view" : "set")}>
            {currentPin ? "Change PIN" : "Set PIN"}
          </Chip>
        </div>
      </div>

      {msg && (
        <div className="ios-footnote" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ios-green)", marginTop: 12 }}>
          <Check /> {msg}
        </div>
      )}

      {mode === "set" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14, maxWidth: 300 }}>
          <input
            className="ios-num"
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="New 4-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/, "").slice(0, 4))}
            style={inputStyle}
          />
          <input
            className="ios-num"
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="Confirm PIN"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/, "").slice(0, 4))}
            style={inputStyle}
          />
          {err && <p className="ios-footnote" style={{ color: "var(--ios-red)" }}>{err}</p>}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              className="ios-btn ios-btn--plain"
              style={{ width: "auto" }}
              onClick={() => { setMode("view"); setPin(""); setConfirm(""); setErr(null); }}
            >
              Cancel
            </button>
            <button type="button" className="ios-btn ios-btn--primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save PIN"}
            </button>
          </div>
        </div>
      )}

      {mode === "remove" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <p className="ios-subhead" style={{ color: "var(--ios-label)", flex: 1, minWidth: 100 }}>Remove PIN?</p>
          <button type="button" className="ios-btn ios-btn--plain" style={{ width: "auto" }} onClick={() => setMode("view")}>
            Cancel
          </button>
          <button
            type="button"
            className="ios-btn ios-btn--primary"
            style={{ width: "auto", background: "var(--ios-red)" }}
            onClick={remove}
            disabled={saving}
          >
            {saving ? "Removing…" : "Yes, remove"}
          </button>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  background: "var(--ios-fill)", border: "none", color: "var(--ios-label)",
  fontSize: 17, outline: "none", textAlign: "center", letterSpacing: "0.3em",
  boxSizing: "border-box",
};
