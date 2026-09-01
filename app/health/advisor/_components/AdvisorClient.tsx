"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { HealthAssessment, Signal } from "@/lib/health/assessment";

/**
 * The advisor screen: what the numbers say, then a place to ask about them.
 *
 * The prompts under the composer are the point of the design. "Assess my
 * results" is a hard thing to type from a blank box, and the questions worth
 * asking are the same handful every time — so they are offered rather than
 * left to be invented.
 */

const TONE: Record<Signal["kind"], { color: string; label: string }> = {
  watch: { color: "var(--ios-orange, #D9772B)", label: "Watch" },
  gap: { color: "var(--ios-label-3)", label: "No data" },
  good: { color: "var(--ios-green)", label: "Good" },
};

const AREA_LABEL: Record<Signal["area"], string> = {
  weight: "Weight",
  sleep: "Sleep",
  activity: "Activity",
  recovery: "Recovery",
  training: "Training",
  nutrition: "Nutrition",
  medication: "Medication",
  labs: "Labs",
};

const STARTERS = [
  "What should I change first?",
  "Build me a week of training from this",
  "How should I eat to match my training?",
  "Why might my sleep be off?",
];

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Enough markdown for an answer: headings, bullets, bold, paragraphs. */
function md(text: string): string {
  const out: string[] = [];
  let list = false;
  const close = () => { if (list) { out.push("</ul>"); list = false; } };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) { close(); out.push(`<div style="font-weight:700;margin:10px 0 4px">${esc(h[1])}</div>`); continue; }
    const li = line.match(/^[-*•]\s+(.*)$/);
    if (li) {
      if (!list) { out.push('<ul style="margin:4px 0 8px;padding-left:20px">'); list = true; }
      out.push(`<li style="margin:3px 0">${inline(li[1])}</li>`);
      continue;
    }
    close();
    out.push(`<p style="margin:0 0 9px;line-height:1.55">${inline(line)}</p>`);
  }
  close();
  return out.join("");
}
function inline(s: string) {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

interface Turn { role: "user" | "assistant"; content: string }

export default function AdvisorClient({ assessment }: { assessment: HealthAssessment }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setErr(null);
    setInput("");
    const next: Turn[] = [...turns, { role: "user", content: q }];
    setTurns(next);
    setBusy(true);
    try {
      const res = await fetch("/api/health/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, windowDays: assessment.windowDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "The advisor couldn't answer.");
      setTurns([...next, { role: "assistant", content: data.reply }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    } catch (e) {
      setErr((e as Error).message);
      setTurns(turns); // put the question back rather than stranding it
      setInput(q);
    } finally {
      setBusy(false);
    }
  }

  const labs = assessment.labs;

  return (
    <div>
      {/* ── What the numbers say ─────────────────────────────────────────── */}
      <div className="ios-group-header" style={{ padding: "6px 0 7px" }}>
        LAST {assessment.windowDays} DAYS
      </div>
      <div className="ios-list" style={{ margin: 0, padding: "4px 14px" }}>
        {assessment.signals.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex", gap: 10, padding: "11px 0",
              borderTop: i === 0 ? "none" : "0.5px solid var(--ios-separator)",
            }}
          >
            <span
              className="ios-caption"
              style={{
                color: TONE[s.kind].color, fontWeight: 700, flexShrink: 0,
                minWidth: 62, paddingTop: 1,
              }}
            >
              {AREA_LABEL[s.area]}
            </span>
            <span className="ios-subhead" style={{ color: "var(--ios-label)", lineHeight: 1.45 }}>
              {s.text}
            </span>
          </div>
        ))}
      </div>

      {/* ── Labs ─────────────────────────────────────────────────────────── */}
      <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>
        LABS
      </div>
      {labs ? (
        <div className="ios-list" style={{ margin: 0, padding: "12px 14px" }}>
          <div className="ios-subhead" style={{ fontWeight: 600 }}>{labs.panelName}</div>
          <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 2, marginBottom: 8 }}>
            Collected {labs.collectedOn} · {labs.results.length} results
            {labs.outOfRange.length > 0 ? ` · ${labs.outOfRange.length} flagged` : ""}
            {labs.borderline.length > 0 ? ` · ${labs.borderline.length} borderline` : ""}
            {labs.outOfRange.length === 0 && labs.borderline.length === 0 ? " · nothing flagged" : ""}
          </div>
          {/* Out-of-range first — the rest is a reference list, not a finding. */}
          {[...labs.outOfRange, ...labs.results.filter((r) => !labs.outOfRange.includes(r))]
            .slice(0, 12)
            .map((r, i) => {
              const flagged = r.flag === "low" || r.flag === "high";
              const soft = r.flag === "borderline";
              return (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--ios-separator)" }}>
                  <span className="ios-caption" style={{ color: "var(--ios-label)", minWidth: 0 }}>{r.analyte}</span>
                  <span className="ios-caption ios-num" style={{ flexShrink: 0, color: flagged ? "var(--ios-red)" : soft ? "var(--ios-orange, #D9772B)" : "var(--ios-label-2)" }}>
                    {r.value ?? r.valueText ?? "—"}{r.unit ? ` ${r.unit}` : ""}
                    {r.change != null && (
                      <span style={{ color: "var(--ios-label-3)" }}> ({r.change > 0 ? "+" : ""}{r.change})</span>
                    )}
                  </span>
                </div>
              );
            })}
          <Link href="/health/records" className="ios-caption" style={{ display: "inline-block", marginTop: 10, color: "var(--ios-tint)", fontWeight: 700, textDecoration: "none" }}>
            All records &amp; add a report →
          </Link>
        </div>
      ) : (
        <div className="ios-list" style={{ margin: 0, padding: 14 }}>
          <div className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            No lab results yet. Add a report under Records and the advisor will reason from your
            bloodwork alongside the wearable data, and show what moved since it was last measured.
          </div>
          <Link href="/health/records" className="ios-caption" style={{ display: "inline-block", marginTop: 8, color: "var(--ios-tint)", fontWeight: 700, textDecoration: "none" }}>
            Add a health record →
          </Link>
        </div>
      )}

      {/* ── Conversation ─────────────────────────────────────────────────── */}
      {turns.length > 0 && (
        <>
          <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>CONVERSATION</div>
          {turns.map((t, i) => (
            <div
              key={i}
              className="ios-list"
              style={{
                margin: "0 0 8px", padding: "12px 14px",
                background: t.role === "user" ? "var(--ios-fill-2)" : "var(--ios-cell)",
              }}
            >
              {t.role === "user" ? (
                <div className="ios-subhead" style={{ color: "var(--ios-label)", whiteSpace: "pre-wrap" }}>{t.content}</div>
              ) : (
                <div className="ios-subhead" style={{ color: "var(--ios-label)" }} dangerouslySetInnerHTML={{ __html: md(t.content) }} />
              )}
            </div>
          ))}
        </>
      )}
      {busy && (
        <div className="ios-caption ios-pending" style={{ color: "var(--ios-label-3)", textAlign: "center", padding: "8px 0" }}>
          Reading your data…
        </div>
      )}
      {err && <div className="ios-footnote" style={{ color: "var(--ios-red)", padding: "6px 2px" }}>{err}</div>}
      <div ref={bottomRef} />

      {/* ── Ask ──────────────────────────────────────────────────────────── */}
      <div className="ios-list" style={{ margin: "12px 0 0", padding: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(); }
            }}
            placeholder="Ask about your training, diet, sleep…"
            rows={1}
            style={{ flex: 1, minWidth: 0, background: "var(--ios-fill)", border: "none", borderRadius: 17, padding: "9px 13px", fontSize: 16, lineHeight: 1.35, color: "var(--ios-label)", resize: "none", fontFamily: "inherit", maxHeight: 110, overflowY: "auto" }}
          />
          <button
            onClick={() => ask()}
            disabled={busy || !input.trim()}
            aria-label="Ask the advisor"
            style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 17, background: "var(--ios-tint)", border: "none", color: "var(--ios-on-tint)", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: busy || !input.trim() ? 0.4 : 1 }}
          >
            {busy ? "…" : "↑"}
          </button>
        </div>
        {turns.length === 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={busy}
                className="ios-caption"
                style={{ background: "var(--ios-fill)", border: "none", borderRadius: 8, color: "var(--ios-tint)", fontWeight: 600, cursor: "pointer", padding: "7px 11px", textAlign: "left" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 10, lineHeight: 1.45 }}>
          Coaching from your own measurements — not medical advice. Anything about symptoms,
          medication or an abnormal lab result belongs with your doctor.
        </div>
      </div>
    </div>
  );
}
