"use client";

import { useState } from "react";

export default function ExportDataButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `morrisai-data-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <button
        onClick={download}
        disabled={busy}
        style={{
          padding: "12px 18px", borderRadius: 12, background: "var(--ios-tint)", color: "var(--ios-on-tint)",
          fontSize: 16, fontWeight: 600, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1, border: "none",
        }}
      >
        {busy ? "Preparing…" : "Download my data"}
      </button>
      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 10, lineHeight: 1.5 }}>
        Exports your own records (finance, retirement, career, courses, Bible, health) as a JSON file. Encrypted bank
        access tokens are never included.
      </p>
      {err && (
        <p className="ios-footnote" style={{ color: "var(--ios-red)", marginTop: 8 }}>{err}</p>
      )}
    </div>
  );
}
