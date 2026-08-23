"use client";

import { useState } from "react";

/**
 * Image generation, on its own screen.
 *
 * This used to sit in the middle of the panel page, between the model picker
 * and the conversation — a different job wedged into a Q&A transcript, which
 * pushed the thing people came for further down the page. Same endpoint, same
 * behaviour; it just no longer interrupts something unrelated.
 */
const slug = (s: string) =>
  (s || "morris").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "morris";

function fmtCost(c: number | null): string {
  if (c == null) return "";
  if (c <= 0) return "$0";
  if (c < 0.001) return "<$0.001";
  return "$" + c.toFixed(c < 0.1 ? 4 : 2);
}

export default function ImageClient({ connected }: { connected: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cost, setCost] = useState<number | null>(null);

  async function make() {
    const p = prompt.trim();
    if (!p || busy) return;
    setBusy(true); setErr(null); setUrl(null);
    try {
      const res = await fetch("/api/ask/compare/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed");
      setUrl(data.image);
      setCost(data.cost ?? null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!connected) {
    return (
      <div className="ios-list" style={{ margin: 0, padding: 14 }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
          Add an <strong>OPENROUTER_API_KEY</strong> to generate images. Get one at openrouter.ai.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="ios-list" style={{ margin: 0, padding: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") make(); }}
            placeholder="Describe an image — e.g. a clean infographic of…"
            style={{ flex: 1, minWidth: 0, background: "var(--ios-fill)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 16, color: "var(--ios-label)" }}
          />
          <button onClick={make} disabled={busy || !prompt.trim()}
            style={{ padding: "0 18px", borderRadius: 12, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: busy || !prompt.trim() ? 0.5 : 1 }}>
            {busy ? "…" : "Make"}
          </button>
        </div>

        {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 10 }}>{err}</div>}

        {busy && (
          <div className="ios-caption ios-pending" style={{ color: "var(--ios-label-3)", marginTop: 12, textAlign: "center" }}>
            Drawing…
          </div>
        )}

        {url && (
          <div style={{ marginTop: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={prompt} style={{ width: "100%", borderRadius: 12, display: "block" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
              <a href={url} download={`${slug(prompt)}.png`} style={{ color: "var(--ios-tint)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                Download image ↓
              </a>
              {cost != null && <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>cost {fmtCost(cost)}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
