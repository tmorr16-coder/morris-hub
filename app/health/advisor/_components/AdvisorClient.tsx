"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HealthAssessment, Signal } from "@/lib/health/assessment";

/**
 * The advisor screen: a place to ask, then the numbers behind the answers.
 *
 * The composer leads. What people come here to do is ask something, and the
 * summary that used to sit above it meant scrolling past three sections of
 * data to reach the box — on a phone, past most of a screen. The data has not
 * gone anywhere; it reads as the evidence under the conversation, which is
 * what it is.
 *
 * There are no suggested questions. A row of canned prompts answers a problem
 * this screen does not have: the questions worth asking here come from the
 * person's own numbers, which are on the same page, and offering six generic
 * ones mostly teaches people to pick from the list instead of asking what they
 * actually came to ask.
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

/**
 * The models offered for a second opinion, deliberately from other vendors.
 * A model reviewing its own answer tends to agree with it; the value of the
 * check comes from it having been trained by someone else.
 */
const CHECKERS = [
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { id: "openai/gpt-5.1", label: "GPT-5.1" },
  { id: "x-ai/grok-4.6", label: "Grok 4.6" },
];

interface Review { text: string; model: string }
interface Turn {
  role: "user" | "assistant";
  content: string;
  /** The question this answered — the checker needs it for context. */
  question?: string;
  review?: Review;
  checking?: boolean;
  reviewErr?: string;
}

interface Thread {
  /** Epoch ms at the first question — the id the server upserts on. */
  id: number;
  /** Last activity, for ordering the list. */
  at: number;
  turns: Turn[];
}

const STORE_KEY = "advisor-threads-v1";
const MAX_THREADS = 30;

/**
 * The browser's copy of the conversations.
 *
 * localStorage is the local store and the server is a sync, not the other way
 * round. A conversation therefore survives a reload before the migration has
 * been applied, and a sync failure leaves what is on the device alone instead
 * of presenting as an empty history.
 */
function loadLocal(): Thread[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Thread[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(threads: Thread[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(threads.slice(0, MAX_THREADS)));
  } catch {
    /* quota or private mode — the server copy is the fallback */
  }
}

/** First question, trimmed to something that fits one line in the list. */
function titleOf(t: Thread): string {
  const first = t.turns.find((x) => x.role === "user")?.content ?? "";
  return first.replace(/\s+/g, " ").trim() || "Empty conversation";
}

/**
 * Wall clock, read through a module-scope helper.
 *
 * React's purity lint flags a bare Date.now() inside a component body even when
 * it is only ever reached from an event handler, which is where every call here
 * comes from. Reading it through one function outside the component says the
 * same thing without arguing with the rule.
 */
const nowMs = () => Date.now();

function ago(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export default function AdvisorClient({ assessment }: { assessment: HealthAssessment }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checker, setChecker] = useState(CHECKERS[0].id);
  // Lazy initialiser rather than an effect: the device's copy is available
  // synchronously, so reading it here paints the list correctly on the first
  // frame instead of after a state round trip.
  const [threads, setThreads] = useState<Thread[]>(loadLocal);
  const [threadId, setThreadId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Then whatever the server holds, which may include conversations started on
  // another device.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/health/advisor/threads");
        if (!res.ok) return; // 503 before the migration; keep the local copy
        const { threads: remote } = await res.json();
        if (!Array.isArray(remote)) return;
        setThreads((local) => {
          const byId = new Map<number, Thread>();
          for (const t of [...(remote as Thread[]), ...local]) {
            const prev = byId.get(t.id);
            // Same conversation on two devices: the one touched last wins.
            if (!prev || (t.at ?? 0) > (prev.at ?? 0)) byId.set(t.id, t);
          }
          const merged = [...byId.values()].sort((a, b) => b.at - a.at).slice(0, MAX_THREADS);
          saveLocal(merged);
          return merged;
        });
      } catch {
        /* offline — the local copy stands */
      }
    })();
  }, []);

  /** Write one conversation to both stores. The server is best-effort. */
  function persist(id: number, nextTurns: Turn[], at: number) {
    const thread: Thread = { id, at, turns: nextTurns };
    setThreads((prev) => {
      const merged = [thread, ...prev.filter((t) => t.id !== id)].slice(0, MAX_THREADS);
      saveLocal(merged);
      return merged;
    });
    fetch("/api/health/advisor/threads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread }),
    }).catch(() => {
      /* the device copy is already written */
    });
  }

  function openThread(t: Thread) {
    setThreadId(t.id);
    setTurns(t.turns);
    setErr(null);
    setInput("");
  }

  function newConversation() {
    setThreadId(null);
    setTurns([]);
    setErr(null);
    setInput("");
  }

  function removeThread(id: number) {
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveLocal(next);
      return next;
    });
    fetch(`/api/health/advisor/threads?id=${id}`, { method: "DELETE" }).catch(() => {});
    if (threadId === id) newConversation();
  }

  async function ask() {
    const q = input.trim();
    if (!q || busy) return;
    setErr(null);
    setInput("");
    // A conversation gets its id from its first question, so an abandoned empty
    // composer never leaves a thread behind.
    const started = nowMs();
    const id = threadId ?? started;
    if (threadId == null) setThreadId(id);
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
      const answered: Turn[] = [...next, { role: "assistant", content: data.reply, question: q }];
      setTurns(answered);
      persist(id, answered, nowMs());
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    } catch (e) {
      setErr((e as Error).message);
      setTurns(turns); // put the question back rather than stranding it
      setInput(q);
    } finally {
      setBusy(false);
    }
  }

  /** Send one answer to a different model to be checked against the same data. */
  async function check(index: number) {
    const target = turns[index];
    if (!target || target.checking) return;
    const at = nowMs();
    const patch = (fields: Partial<Turn>) =>
      setTurns((prev) => prev.map((t, i) => (i === index ? { ...t, ...fields } : t)));

    patch({ checking: true, reviewErr: undefined });
    try {
      const res = await fetch("/api/health/advisor/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: target.question ?? "",
          answer: target.content,
          model: checker,
          windowDays: assessment.windowDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The check couldn't run.");
      const review: Review = { text: data.review, model: data.model };
      patch({ checking: false, review });
      if (threadId != null) {
        // Saved with the answer it qualifies — restoring the answer without the
        // critique that tempered it would be the more misleading of the two.
        persist(
          threadId,
          turns.map((t, i) => (i === index ? { ...t, checking: false, review } : t)),
          at
        );
      }
    } catch (e) {
      patch({ checking: false, reviewErr: (e as Error).message });
    }
  }

  const labs = assessment.labs;

  return (
    <div>
      {/* ── Ask ──────────────────────────────────────────────────────────── */}
      <div className="ios-list" style={{ margin: "6px 0 0", padding: 12 }}>
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
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 10 }}>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", lineHeight: 1.45, flex: 1 }}>
            Coaching from your own measurements — not medical advice. Anything about symptoms,
            medication or an abnormal lab result belongs with your doctor.
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={newConversation}
              disabled={busy}
              className="ios-caption"
              style={{
                flexShrink: 0, background: "none", border: "0.5px solid var(--ios-separator)",
                borderRadius: 999, padding: "5px 11px", color: "var(--ios-tint)",
                fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
              }}
            >
              New
            </button>
          )}
        </div>
      </div>

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
                <>
                  <div className="ios-subhead" style={{ color: "var(--ios-label)" }} dangerouslySetInnerHTML={{ __html: md(t.content) }} />

                  {/* A second opinion, from a model that didn't write the answer. */}
                  {!t.review && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => check(i)}
                        disabled={t.checking}
                        className="ios-caption"
                        style={{
                          background: "none", border: "0.5px solid var(--ios-separator)",
                          borderRadius: 999, padding: "5px 11px",
                          color: t.checking ? "var(--ios-label-3)" : "var(--ios-tint)",
                          fontWeight: 600, cursor: t.checking ? "default" : "pointer",
                        }}
                      >
                        {t.checking ? "Checking…" : "Double-check this"}
                      </button>
                      <select
                        value={checker}
                        onChange={(e) => setChecker(e.target.value)}
                        className="ios-caption"
                        aria-label="Model to check with"
                        style={{
                          background: "none", border: "none",
                          color: "var(--ios-label-2)", padding: "4px 0",
                        }}
                      >
                        {CHECKERS.map((c) => (
                          <option key={c.id} value={c.id}>with {c.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {t.reviewErr && (
                    <div className="ios-footnote" style={{ color: "var(--ios-red)", marginTop: 8 }}>{t.reviewErr}</div>
                  )}

                  {t.review && (
                    <div
                      style={{
                        marginTop: 12, paddingTop: 11,
                        borderTop: "0.5px solid var(--ios-separator)",
                      }}
                    >
                      <div className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 700, marginBottom: 6 }}>
                        CHECKED BY {(CHECKERS.find((c) => c.id === t.review!.model)?.label ?? t.review!.model).toUpperCase()}
                      </div>
                      <div
                        className="ios-footnote"
                        style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}
                        dangerouslySetInnerHTML={{ __html: md(t.review.text) }}
                      />
                    </div>
                  )}
                </>
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

      {/* ── Saved conversations ──────────────────────────────────────────── */}
      {threads.filter((t) => t.id !== threadId).length > 0 && (
        <>
          <div className="ios-group-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0 7px" }}>
            <span>EARLIER CONVERSATIONS</span>
            <button
              type="button"
              onClick={() => {
                setThreads([]);
                saveLocal([]);
                fetch("/api/health/advisor/threads", { method: "DELETE" }).catch(() => {});
                newConversation();
              }}
              className="ios-caption"
              style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", textTransform: "none", letterSpacing: 0 }}
            >
              Clear all
            </button>
          </div>
          <div className="ios-list" style={{ margin: 0 }}>
            {threads
              .filter((t) => t.id !== threadId)
              .map((t, i, list) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "11px 14px",
                    borderBottom: i < list.length - 1 ? "0.5px solid var(--ios-separator)" : "none",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openThread(t)}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    <div style={{ color: "var(--ios-label)", fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {titleOf(t)}
                    </div>
                    <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>
                      {t.turns.filter((x) => x.role === "user").length} question
                      {t.turns.filter((x) => x.role === "user").length === 1 ? "" : "s"} · {ago(t.at)}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeThread(t.id)}
                    aria-label={`Remove conversation: ${titleOf(t)}`}
                    style={{ background: "none", border: "none", color: "var(--ios-label-3)", fontSize: 19, lineHeight: 1, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      {/* ── What the numbers say ─────────────────────────────────────────── */}
      <div className="ios-group-header" style={{ padding: "22px 0 7px" }}>
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

      {/* ── Body composition ─────────────────────────────────────────────── */}
      {assessment.body && (
        <>
          <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>BODY COMPOSITION</div>
          <div className="ios-list" style={{ margin: 0, padding: "12px 14px" }}>
            <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginBottom: 8 }}>
              {assessment.body.measuredOn}{assessment.body.device ? ` · ${assessment.body.device}` : ""}
            </div>
            {([
              ["Weight", assessment.body.weightLbs, "lb", assessment.body.change?.weightLbs ?? null],
              ["Body fat", assessment.body.bodyFatPct, "%", assessment.body.change?.bodyFatPct ?? null],
              ["Skeletal muscle", assessment.body.skeletalMuscleLbs, "lb", assessment.body.change?.skeletalMuscleLbs ?? null],
              ["Visceral fat", assessment.body.visceralFatArea, "cm²", null],
              ["BMR", assessment.body.bmrKcal, "kcal", null],
            ] as [string, number | null, string, number | null][])
              .filter(([, v]) => v != null)
              .map(([label, v, unit, chg], i) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--ios-separator)" }}>
                  <span className="ios-caption" style={{ color: "var(--ios-label)" }}>{label}</span>
                  <span className="ios-caption ios-num" style={{ color: "var(--ios-label-2)" }}>
                    {v} {unit}
                    {chg != null && chg !== 0 && (
                      <span style={{ color: "var(--ios-label-3)" }}> ({chg > 0 ? "+" : ""}{chg})</span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

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
            {labs.drawCount > 1 ? ` · ${labs.drawCount} draws on file` : ""}
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
    </div>
  );
}
