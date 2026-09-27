"use client";

// Pairing and managing phones that run the native sync app.
//
// The app is the near-real-time path: Apple Health wakes it when the watch
// records something, and it sends the change. This card hands a phone its
// one-time pairing code and shows when each paired phone last reported.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cell, IconBadge } from "@/components/ios";
import { createPairingCode, revokeDevice } from "../device-actions";

export interface PairedDevice {
  id: string;
  label: string | null;
  pairedAt: string | null;
  lastSeenAt: string | null;
}

/** Module scope: clock reads stay out of render. */
function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function isQuiet(iso: string | null): boolean {
  return !iso || Date.now() - new Date(iso).getTime() > 24 * 3_600_000;
}

const PhoneGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </svg>
);

export default function NativeSyncCard({ available, devices }: { available: boolean; devices: PairedDevice[] }) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pair() {
    setError(null);
    start(async () => {
      const r = await createPairingCode();
      if (r.error || !r.code) { setError(r.error ?? "Could not create a code."); return; }
      setCode(r.code);
      setExpiresAt(r.expiresAt ?? null);
    });
  }
  function revoke(id: string) {
    start(async () => {
      const r = await revokeDevice(id);
      if (r.error) setError(r.error);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="ios-list" style={{ margin: 0 }}>
        <Cell
          chevron={false}
          lead={<IconBadge color="#1C1C1E"><PhoneGlyph /></IconBadge>}
          title="Morris Health app"
          subtitle="Sends Apple Health as it arrives"
          trailing={
            <span style={{ fontSize: 15, color: devices.length > 0 ? "var(--ios-green)" : "var(--ios-label-2)" }}>
              {devices.length > 0 ? `${devices.length} paired` : "Not paired"}
            </span>
          }
        />

        {devices.map((d) => (
          <Cell
            key={d.id}
            chevron={false}
            title={d.label ?? "iPhone"}
            subtitle={<span style={{ color: isQuiet(d.lastSeenAt) ? "var(--ios-orange)" : undefined }}>Last reported {ago(d.lastSeenAt)}</span>}
            trailing={
              <button type="button" disabled={pending} onClick={() => revoke(d.id)} style={{ color: "var(--ios-red)", fontSize: 15 }}>
                Unpair
              </button>
            }
          />
        ))}

        {code ? (
          <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="ios-cell-sub" style={{ marginTop: 0 }}>Pairing code</span>
            <code className="ios-num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "0.12em", textAlign: "center", background: "var(--ios-fill)", borderRadius: 10, padding: "12px 8px", userSelect: "all", WebkitUserSelect: "all" }}>
              {code}
            </code>
            <a
              href={`morrishealthsync://pair?code=${encodeURIComponent(code)}`}
              className="ios-btn ios-btn--primary"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Open in Morris Health
            </a>
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
              On this iPhone, tap the button. On another device, type the code into the app. It works once
              {expiresAt ? ` and expires at ${new Date(expiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}.
            </span>
          </div>
        ) : (
          <Cell
            chevron={false}
            onClick={available && !pending ? pair : undefined}
            title={<span style={{ color: available ? "var(--ios-tint)" : "var(--ios-label-3)" }}>{pending ? "Creating a code…" : devices.length > 0 ? "Pair another iPhone" : "Pair an iPhone"}</span>}
          />
        )}
      </div>

      {error && <p className="ios-footnote" style={{ color: "var(--ios-red)", padding: "0 16px" }}>{error}</p>}

      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0", lineHeight: 1.5 }}>
        {available
          ? "The app is built from ios/MorrisHealthSync in Xcode and installed on the phone. Apple Health wakes it when the watch records something; if the phone is locked at that moment, it sends when you next unlock."
          : "Pairing needs a database migration first: run supabase/migrations/20260927_health_devices.sql."}
      </p>
    </div>
  );
}
