"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AUTO_MODEL, AUTO_MODEL_META, COMPARE_MODELS, LIVE_MODELS, MORE_MODELS, SYNTH_MODEL,
  isPremiumRate, perMillion, PREMIUM_PER_M, type CatalogModel, type CompareModel,
} from "@/lib/openrouter";
import type { Pricing } from "./page";
import { describeAttachments, estimateTokens, estimateOcrCost, type PanelAttachment } from "@/lib/panel-context";

interface Citation { url: string; title: string }

/** A document already in Morris Hub, offered by the "from the app" picker. */
interface LibraryFile {
  id: string;
  title: string;
  fileName: string | null;
  type: string | null;
  sizeKb: number | null;
  group: string;
}
interface Result {
  model: string;
  answer: string;
  error: string | null;
  cost: number | null;
  citations?: Citation[];
  served?: string | null;
  /** This model's response to what the others said, when the debate round ran. */
  reaction?: string | null;
  reactionCost?: number | null;
}

// One question and every answer it produced — saved, so revisiting costs nothing.
interface Turn {
  q: string;
  at: number;                 // epoch ms
  results: Result[] | null;   // null for legacy entries (question only)
  synthesis: string | null;
  synthCost: number | null;
  cost: number | null;
  /** Names of files this turn was asked with, for the transcript. */
  files?: string[];
  /** Models that couldn't see an attached image on this turn. */
  skippedVision?: string[];
}

// A thread of turns. Follow-ups reuse it, so the models answer in context.
interface Thread {
  id: number;                 // thread start (stable key)
  at: number;                 // last activity
  models: string[];
  web: boolean;
  turns: Turn[];
  /**
   * Files the thread carries. Attached once and re-sent on every turn, so a
   * follow-up still sees the document — the chat API is stateless, so "carried"
   * means the client keeps supplying it (and the input tokens are re-charged).
   */
  attachments?: PanelAttachment[];
}

const THREADS_KEY = "panel-threads-v1";
const RUNS_KEY = "panel-history-v1";          // one saved run per entry
const LEGACY_KEY = "compare-recent-searches"; // question-only strings
const MAX_ENTRIES = 15;
const MAX_BYTES = 1_500_000; // stay well inside the ~5MB localStorage budget

/** What the API needs to replay a thread: each turn's question and answers. */
function toHistory(turns: Turn[]) {
  return turns.filter((t) => t.results?.length).map((t) => ({
    q: t.q,
    answers: Object.fromEntries((t.results ?? []).filter((r) => r.answer && !r.error).map((r) => [r.model, r.answer])),
    synthesis: t.synthesis,
  }));
}

function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function fmtCost(c: number | null | undefined): string {
  if (c == null) return "";
  if (c <= 0) return "$0";
  if (c < 0.001) return "<$0.001";
  return "$" + c.toFixed(c < 0.1 ? 4 : 2);
}

const ALL: CompareModel[] = [AUTO_MODEL_META, ...COMPARE_MODELS, ...LIVE_MODELS, ...MORE_MODELS];
const LIVE_IDS = new Set(LIVE_MODELS.map((m) => m.id));

const metaOf = (id: string, extra: CompareModel[] = []): CompareModel =>
  ALL.find((m) => m.id === id) ?? extra.find((m) => m.id === id) ?? { id, label: id, vendor: "Model", color: "var(--ios-label-2)" };

/** "$3.00/M out" — the rate a chip is charging, for anything priced. */
function rateLabel(p?: { completion: number }): string {
  const perM = perMillion(p?.completion);
  if (perM <= 0) return "";
  return `$${perM.toFixed(perM < 1 ? 2 : perM < 10 ? 1 : 0).replace(/\.0$/, "")}/M`;
}

// ── tiny safe markdown → html ──────────────────────────────────────
function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function inline(s: string) {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--ios-tint)">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code style="background:rgba(120,120,128,0.16);padding:1px 5px;border-radius:5px;font-size:.9em">$1</code>');
}
function md(text: string) {
  const out: string[] = []; let list: "ul" | "ol" | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { close(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { close(); out.push(`<div style="font-weight:700;font-size:15px;margin:8px 0 4px">${inline(h[2])}</div>`); continue; }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/); const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul) { if (list !== "ul") { close(); out.push('<ul style="margin:4px 0 8px;padding-left:20px">'); list = "ul"; } out.push(`<li style="margin:3px 0">${inline(ul[1])}</li>`); continue; }
    if (ol) { if (list !== "ol") { close(); out.push('<ol style="margin:4px 0 8px;padding-left:20px">'); list = "ol"; } out.push(`<li style="margin:3px 0">${inline(ol[1])}</li>`); continue; }
    close(); out.push(`<p style="margin:0 0 8px;line-height:1.55">${inline(line)}</p>`);
  }
  close(); return out.join("");
}

const SUGGESTIONS = [
  "Explain the tradeoffs of Roth vs traditional 401(k)",
  "Draft a 3-day Tokyo itinerary for a family",
  "What are the risks of a portfolio concentrated in one stock?",
];

const MAX_ATTACHMENTS = 10;

/**
 * Attachments that carry a base64 payload rather than text — an image, or a
 * PDF being sent for OCR. These are what blow the localStorage budget, so they
 * are the first thing shed when a save doesn't fit.
 */
function isHeavy(a: PanelAttachment): boolean {
  return a.kind === "image" || Boolean(a.remoteParse);
}

/** Icon for an attachment chip, by kind. */
function fileIcon(kind: PanelAttachment["kind"]): string {
  if (kind === "image") return "🖼";
  if (kind === "pdf") return "📕";
  if (kind === "docx") return "📘";
  return "📄";
}

/**
 * Shrink an image in the browser before it ever leaves the device.
 *
 * Two reasons, both real: an attachment is re-sent on every turn of the thread,
 * so a 6MB photo is paid for again and again; and the thread is persisted to
 * localStorage, which has a hard few-MB ceiling. Vision models downscale to
 * roughly this size internally anyway, so capping the long edge at 1280px costs
 * no answer quality. Falls back to the original file if canvas is unavailable.
 */
async function downscaleImage(file: File, maxEdge = 1280, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    // Already small enough and not a heavyweight format — send as-is.
    if (scale === 1 && file.size < 400_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function CompareClient({ connected, pricing, newest = [] }: { connected: boolean; pricing: Pricing; newest?: CatalogModel[] }) {
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState<string[]>(COMPARE_MODELS.map((m) => m.id));
  const [synthesize, setSynthesize] = useState(false);
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null); // "docx"|"pptx"|"md" busy
  const [imgPrompt, setImgPrompt] = useState("");
  const [imgBusy, setImgBusy] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgErr, setImgErr] = useState<string | null>(null);
  const [imgCost, setImgCost] = useState<number | null>(null);
  const [sessionCost, setSessionCost] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [thread, setThread] = useState<Thread | null>(null); // the open conversation
  const [restored, setRestored] = useState(false);           // opened from history, nothing re-run
  const [showNewest, setShowNewest] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<CatalogModel[] | null>(null); // catalog search results
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<CatalogModel[]>([]);        // added from search
  const [acceptedRates, setAcceptedRates] = useState<string[]>([]); // higher-rate models you've okayed
  const [confirmRates, setConfirmRates] = useState(false);          // the extra-click panel is open
  const abortRef = useRef<AbortController | null>(null);

  // ── Attachments + debate ────────────────────────────────────────────────
  // `attachments` is the working set for the next turn. When a thread is open
  // it mirrors thread.attachments, so files stay put across follow-ups.
  const [attachments, setAttachments] = useState<PanelAttachment[]>([]);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [debate, setDebate] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<LibraryFile[] | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Every model we know a price for: the curated line-up, the newest list, and
  // anything picked out of the catalog. Estimates and the rate gate read this,
  // so a searched-for model is treated exactly like a built-in one.
  const known = useMemo(() => [...newest, ...picked], [newest, picked]);

  // ── Attachment handling ─────────────────────────────────────────────────

  /**
   * Merge new attachments in, respecting the cap and skipping duplicates.
   *
   * Computed from `attachments` directly rather than inside a setState updater:
   * this has to touch three pieces of state at once, and updaters must stay pure
   * (StrictMode double-invokes them, so a setState nested in one fires twice).
   */
  function mergeAttachments(incoming: PanelAttachment[]) {
    const seen = new Set(attachments.map((a) => `${a.source}:${a.name}`));
    const fresh = incoming.filter((a) => !seen.has(`${a.source}:${a.name}`));
    if (!fresh.length) return;

    const next = [...attachments, ...fresh].slice(0, MAX_ATTACHMENTS);
    setAttachments(next);
    // Keep the open thread in sync so follow-ups carry the same files.
    setThread((t) => (t ? { ...t, attachments: next } : t));
    if (attachments.length + fresh.length > MAX_ATTACHMENTS) {
      setAttachErr(`The panel takes up to ${MAX_ATTACHMENTS} files at a time.`);
    }
  }

  /** Upload files from the device — extracted server-side, once. */
  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list).slice(0, MAX_ATTACHMENTS);
    if (!files.length) return;
    setAttachBusy(true);
    setAttachErr(null);

    const added: PanelAttachment[] = [];
    const failures: string[] = [];
    for (const raw of files) {
      try {
        const file = await downscaleImage(raw);
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/ask/compare/attach", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) { failures.push(data.error ?? `${raw.name} failed`); continue; }
        added.push(data.attachment as PanelAttachment);
      } catch {
        failures.push(`${raw.name} couldn't be uploaded`);
      }
    }

    if (added.length) mergeAttachments(added);
    if (failures.length) setAttachErr(failures.join(" · "));
    setAttachBusy(false);
  }

  function removeAttachment(id: string) {
    const next = attachments.filter((a) => a.id !== id);
    setAttachments(next);
    setThread((t) => (t ? { ...t, attachments: next } : t));
    setAttachErr(null);
  }

  // The library sheet covers the screen, so it needs a way out that isn't the
  // Done button — Escape on a keyboard, and a tap anywhere on the backdrop.
  useEffect(() => {
    if (!libraryOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLibraryOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [libraryOpen]);

  /** Documents already in the app — loaded lazily, the first time the sheet opens. */
  async function openLibrary() {
    setLibraryOpen(true);
    if (library) return;
    setLibraryBusy(true);
    try {
      const res = await fetch("/api/ask/compare/library");
      const data = await res.json();
      setLibrary(res.ok ? (data.files ?? []) : []);
    } catch {
      setLibrary([]);
    } finally {
      setLibraryBusy(false);
    }
  }

  async function attachFromLibrary(id: string) {
    setAttachBusy(true);
    setAttachErr(null);
    try {
      const res = await fetch("/api/ask/compare/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't attach that file");
      mergeAttachments((data.attachments ?? []) as PanelAttachment[]);
      setLibraryOpen(false);
    } catch (e) {
      setAttachErr((e as Error).message);
    } finally {
      setAttachBusy(false);
    }
  }

  /** Roughly what the attached files add to each model, per turn. */
  const attachmentTokens = useMemo(
    () => attachments.reduce((n, a) => n + (a.text ? estimateTokens(a.text) : 0), 0),
    [attachments]
  );

  // Ride the transcript down to the newest answers — the chat behaviour of
  // staying at the bottom. Keyed on thread id *and* turn count so it fires both
  // when a turn lands and when a different conversation is opened; keying on
  // count alone would sit still when you open a saved thread with the same
  // number of turns as the one already on screen.
  const scrollKey = `${thread?.id ?? 0}:${thread?.turns.length ?? 0}`;
  const firstScroll = useRef(true);
  useEffect(() => {
    if (!thread?.turns.length) return;
    // The restore-on-mount pass jumps straight there; later ones animate.
    bottomRef.current?.scrollIntoView({
      behavior: firstScroll.current ? "auto" : "smooth",
      block: "end",
    });
    firstScroll.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);
  const rates: Pricing = useMemo(() => {
    const m: Pricing = { ...pricing };
    for (const x of known) m[x.id] = { prompt: x.prompt, completion: x.completion };
    return m;
  }, [pricing, known]);
  const META = (id: string) => metaOf(id, known);

  // Debounced catalog search — typing narrows the whole of OpenRouter.
  useEffect(() => {
    const q = query.trim();
    if (!q) return; // clearing the box clears results in the change handler
    const t = setTimeout(async () => {
      setSearching(true); setSearchErr(null);
      try {
        const res = await fetch(`/api/ask/compare/models?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? data.error ?? "Search failed");
        setFound(data.models ?? []);
      } catch (e) {
        setFound(null);
        setSearchErr((e as Error).message);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Load saved threads (migrating the older single-run and question-only
  // formats), then reopen the latest so the conversation survives a reload.
  // localStorage is unavailable during SSR, so this has to happen in an effect
  // after mount rather than in a lazy initializer (same as useChatHistory).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let saved: Thread[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(THREADS_KEY) || "[]");
      if (Array.isArray(raw)) saved = raw.filter((t) => t && Array.isArray(t.turns) && t.turns.length);
    } catch { /* ignore */ }
    if (!saved.length) {
      try {
        const runs = JSON.parse(localStorage.getItem(RUNS_KEY) || "[]");
        if (Array.isArray(runs)) {
          saved = runs.filter((e) => e && typeof e.q === "string").map((e) => ({
            id: e.at, at: e.at, models: e.models ?? [], web: !!e.web,
            turns: [{ q: e.q, at: e.at, results: e.results ?? null, synthesis: e.synthesis ?? null, synthCost: e.synthCost ?? null, cost: e.cost ?? null }],
          }));
        }
      } catch { /* ignore */ }
    }
    if (!saved.length) {
      try {
        const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
        if (Array.isArray(old)) {
          saved = old.filter((q: unknown) => typeof q === "string").map((q: string, i: number) => ({
            id: Date.now() - i, at: Date.now() - i, models: [], web: false,
            turns: [{ q, at: Date.now() - i, results: null, synthesis: null, synthCost: null, cost: null }],
          }));
        }
      } catch { /* ignore */ }
    }
    if (!saved.length) return;
    setThreads(saved);
    if (saved[0].turns.some((t) => t.results)) open(saved[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * Drop the base64 payloads — images, and PDFs held for OCR — from every
   * thread but the newest.
   *
   * An attached image is by far the heaviest thing a thread carries, and one
   * image-laden conversation can blow the whole localStorage budget on its own.
   * Shedding old images first keeps the text context — the part that actually
   * answers follow-ups — and keeps the history list intact, instead of the
   * previous behaviour where an oversized single thread wiped every saved
   * conversation. The images stay live in memory for the open session.
   */
  function shedOldImages(list: Thread[]): Thread[] {
    return list.map((t, i) =>
      i === 0 || !t.attachments?.some(isHeavy)
        ? t
        : { ...t, attachments: t.attachments.filter((a) => !isHeavy(a)) }
    );
  }

  function persistThreads(next: Thread[]) {
    let list = next.slice(0, MAX_ENTRIES);
    // Shed old images first, then drop the oldest threads until it fits.
    if (JSON.stringify(list).length > MAX_BYTES) list = shedOldImages(list);
    while (list.length > 1 && JSON.stringify(list).length > MAX_BYTES) list = list.slice(0, -1);
    setThreads(list);
    for (;;) {
      try { localStorage.setItem(THREADS_KEY, JSON.stringify(list)); break; } catch {
        // Last resort for a single thread too big to store (a large image on the
        // open conversation): save it without its image payloads rather than
        // discarding the conversation entirely.
        if (list.length <= 1) {
          const stripped = list.map((t) => ({ ...t, attachments: (t.attachments ?? []).filter((a) => !isHeavy(a)) }));
          try { localStorage.setItem(THREADS_KEY, JSON.stringify(stripped)); }
          catch { try { localStorage.removeItem(THREADS_KEY); } catch { /* ignore */ } }
          break;
        }
        list = list.slice(0, -1);
        setThreads(list);
      }
    }
    try { localStorage.removeItem(RUNS_KEY); localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  }

  function removeThread(id: number) {
    persistThreads(threads.filter((t) => t.id !== id));
    if (thread?.id === id) newThread();
  }

  /** Reopen a saved conversation — no model calls, no cost. */
  function open(t: Thread) {
    const answered = t.turns.filter((x) => x.results);
    if (!answered.length) { submit(t.turns[0].q); return; }
    setThread(t);
    setQuestion("");
    setWeb(t.web);
    setSynthesize(answered.some((x) => x.synthesis));
    if (t.models.length) setSelected(t.models.slice(0, 4));
    // Reopening a conversation brings its files back with it, so a follow-up
    // asked days later still lands with the document attached.
    setAttachments(t.attachments ?? []);
    setDebate(answered.some((x) => x.results?.some((r) => r.reaction)));
    setRestored(true);
    setErr(null);
    setAttachErr(null);
    // No scroll here on purpose. The transcript now runs oldest-to-newest, so
    // jumping to the top would land on the opening question; and a scroll fired
    // here would race the effect below, which already rides down to the latest
    // answers whenever the open conversation changes.
  }

  function newThread() {
    setThread(null); setRestored(false); setQuestion(""); setErr(null);
    setAttachments([]); setAttachErr(null);
  }

  // Rough pre-run estimate: ~700 output tokens/model (+ a synthesis pass). A
  // follow-up also replays the thread, so those tokens are priced in too.
  const estCost = useMemo(() => {
    const replay = thread ? toHistory(thread.turns).slice(-6).reduce(
      (n, t) => n + Math.ceil(t.q.length / 4) + Math.ceil(Math.min(1500, Object.values(t.answers)[0]?.length ?? 0) / 4), 0) : 0;
    // Attached documents are prepended to every model's system prompt, on every
    // turn — the single biggest thing that can move this number.
    const promptTok = Math.ceil(question.length / 4) + 60 + replay + attachmentTokens;
    let total = selected.reduce((sum, id) => {
      const p = rates[id];
      return p ? sum + promptTok * p.prompt + 700 * p.completion : sum;
    }, 0);
    // The reaction round asks each model again, with its own answer plus every
    // peer's clipped to ~300 tokens each, for a shorter (~350 token) reply.
    if (debate && selected.length >= 2) {
      const reactionPrompt = 400 + 300 * selected.length;
      total += selected.reduce((sum, id) => {
        const p = rates[id];
        return p ? sum + reactionPrompt * p.prompt + 350 * p.completion : sum;
      }, 0);
    }
    if (synthesize && selected.length >= 2) {
      const p = rates[SYNTH_MODEL];
      if (p) total += 1600 * p.prompt + 700 * p.completion;
    }
    // OCR for any PDF with no text layer. Charged once per file, not per model
    // and not per turn — once parsed, the annotation is reused.
    total += estimateOcrCost(attachments);
    return total;
  }, [question, selected, synthesize, debate, rates, thread, attachmentTokens, attachments]);

  // The Auto Router's price is whatever model it picks, so it can't be quoted.
  const hasUnpriced = selected.some((id) => id === AUTO_MODEL || !rates[id]);

  // Higher-rate models need one explicit tap before they can spend anything.
  const needsAccepting = selected.filter((id) => isPremiumRate(rates[id]) && !acceptedRates.includes(id));
  const gated = needsAccepting.length > 0;

  const slug = (s: string) => (s || "morris").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "morris";

  async function exportAs(content: string, format: "md" | "docx" | "pptx", title: string) {
    setExporting(format); setErr(null);
    try {
      const res = await fetch("/api/ask/compare/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format, title }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Export failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${slug(title)}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      const ch = res.headers.get("X-Generation-Cost");
      const c = ch ? parseFloat(ch) : 0;
      if (c > 0) { setSessionCost((s) => s + c); setNotice(`PowerPoint generated · ${fmtCost(c)}`); }
      else setNotice(`${format === "docx" ? "Word doc" : format === "pptx" ? "PowerPoint" : "Markdown"} downloaded · no model cost`);
      setTimeout(() => setNotice(null), 4000);
    } catch (e) { setErr((e as Error).message); } finally { setExporting(null); }
  }

  async function makeImage() {
    const p = imgPrompt.trim();
    if (!p || imgBusy) return;
    setImgBusy(true); setImgErr(null); setImgUrl(null);
    try {
      const res = await fetch("/api/ask/compare/image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed");
      setImgUrl(data.image);
      setImgCost(data.cost ?? null);
      if (data.cost) setSessionCost((s) => s + data.cost);
    } catch (e) { setImgErr((e as Error).message); } finally { setImgBusy(false); }
  }

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]);
    setConfirmRates(false);
  }

  /** Ask, unless a higher-rate model still needs the extra tap. */
  function submit(text?: string, startNew?: boolean) {
    if (gated) { setConfirmRates(true); return; }
    run(text, startNew);
  }

  async function run(text?: string, startNew?: boolean) {
    const q = (text ?? question).trim();
    if (!q || busy || selected.length === 0) return;
    // `startNew` forces a fresh thread (a re-ask), otherwise a question typed
    // while a thread is open continues it.
    const base = startNew ? null : thread;
    setErr(null); setBusy(true); setRestored(false);
    setQuestion("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // A re-ask starts clean; a follow-up carries whatever the thread holds.
      const turnFiles = startNew ? attachments : (base?.attachments ?? attachments);
      const res = await fetch("/api/ask/compare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q, models: selected, synthesize, web, debate,
          history: base ? toHistory(base.turns) : [],
          attachments: turnFiles,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed");
      if (data.totalCost) setSessionCost((s) => s + data.totalCost);
      // Keep the whole turn, so re-opening this conversation is free.
      const turn: Turn = {
        q, at: Date.now(),
        results: data.results ?? null,
        synthesis: data.synthesis ?? null,
        synthCost: data.synthesisCost ?? null,
        cost: data.totalCost ?? null,
        files: turnFiles.map((a) => a.name),
        skippedVision: data.skippedVision ?? [],
      };
      // Bank the file-parse annotations onto the attachments that needed OCR.
      // Sent back on the next turn, they make OpenRouter reuse the parse — the
      // difference between OCR'ing a scan once and paying for it every turn.
      // Swap each OCR'd PDF for the text that came back and drop the file. The
      // base64 must not travel again: PDF + annotation images together blew
      // Vercel's 4.5MB request limit on the second turn and the request died
      // with no response. Once we hold the text, the PDF is dead weight.
      const parsed: { name: string | null; text: string; truncated: boolean }[] = data.parsedFiles ?? [];
      let banked = turnFiles;
      if (parsed.length) {
        let next = 0;
        banked = turnFiles.map((a) => {
          if (!a.remoteParse) return a;
          // Match on filename where OpenRouter echoed one, else take them in order.
          const hit = parsed.find((f) => f.name && f.name === a.name) ?? parsed[next++];
          if (!hit) return a;
          return {
            ...a,
            text: hit.text,
            truncated: hit.truncated,
            dataUrl: undefined,
            remoteParse: false,
            ocrDone: true,
          };
        });
        setAttachments(banked);
      }

      const next: Thread = base
        ? { ...base, at: turn.at, models: selected, web, turns: [...base.turns, turn], attachments: banked }
        : { id: turn.at, at: turn.at, models: selected, web, turns: [turn], attachments: banked };
      setThread(next);
      persistThreads([next, ...threads.filter((t) => t.id !== next.id)]);
    } catch (e) {
      setQuestion(q); // don't lose what they typed
      if ((e as Error).name === "AbortError") {
        // Cancelling stops the waiting, not the models — say so rather than
        // implying the run was free.
        setNotice("Cancelled — models already asked may still be billed.");
        setTimeout(() => setNotice(null), 5000);
      } else setErr((e as Error).message);
    } finally { abortRef.current = null; setBusy(false); }
  }

  return (
    <div>
      {!connected && (
        <div className="ios-list" style={{ margin: "0 0 10px", padding: 14 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Add an <strong>OPENROUTER_API_KEY</strong> to enable the panel. Get one at openrouter.ai.
          </div>
        </div>
      )}

      {/* Model picker */}
      <div className="ios-group-header" style={{ padding: "4px 0 7px" }}>PANEL · pick up to 4</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {ALL.map((m) => {
          const on = selected.includes(m.id);
          const premium = isPremiumRate(rates[m.id]);
          return (
            <button key={m.id} onClick={() => toggle(m.id)}
              title={m.id === AUTO_MODEL ? "OpenRouter picks the best model for each question" : `${m.id}${rateLabel(rates[m.id]) ? ` · ${rateLabel(rates[m.id])} out` : ""}`}
              style={{ padding: "7px 13px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${on ? "transparent" : "var(--ios-separator)"}`,
                background: on ? m.color : "transparent", color: on ? "#fff" : "var(--ios-label)" }}>
              {m.id === AUTO_MODEL ? "✨ " : LIVE_IDS.has(m.id) ? "🌐 " : ""}{m.label}
              {premium && <span style={{ opacity: 0.75, fontWeight: 600 }}> · {rateLabel(rates[m.id])}</span>}
            </button>
          );
        })}
      </div>

      {/* Anything picked out of the full catalog gets its own chip row */}
      {picked.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {picked.map((m) => {
            const on = selected.includes(m.id);
            return (
              <button key={m.id} onClick={() => toggle(m.id)} title={m.id}
                style={{ padding: "7px 13px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${on ? "transparent" : "var(--ios-separator)"}`,
                  background: on ? m.color : "transparent", color: on ? "#fff" : "var(--ios-label)" }}>
                {m.label}
                <span style={{ opacity: on ? 0.8 : 0.55 }}> · {rateLabel(m) || "free"}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginBottom: 12, lineHeight: 1.45 }}>
        Default panel: {COMPARE_MODELS.map((m) => m.label).join(" · ")} — preselected each visit.
      </div>

      {/* Any model on OpenRouter, by search */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) { setFound(null); setSearchErr(null); }
          }}
          placeholder="Search all OpenRouter models — name or id…"
          aria-label="Search all OpenRouter models"
          style={{ width: "100%", background: "var(--ios-fill)", border: "none", borderRadius: 12, padding: "10px 14px", fontSize: 15, color: "var(--ios-label)" }}
        />
        {searching && <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>Searching…</div>}
        {searchErr && <div className="ios-caption" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 6 }}>{searchErr}</div>}
        {found && found.length === 0 && !searching && (
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>No models match “{query.trim()}”.</div>
        )}
        {found && found.length > 0 && (
          <div className="ios-list" style={{ margin: "8px 0 0", maxHeight: 260, overflowY: "auto" }}>
            {found.map((m, i) => {
              const already = selected.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setPicked((p) => (p.some((x) => x.id === m.id) ? p : [...p, m]));
                    if (!already) toggle(m.id);
                    setQuery("");
                  }}
                  disabled={already || selected.length >= 4}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "none", cursor: already || selected.length >= 4 ? "default" : "pointer",
                    border: "none", borderBottom: i < found.length - 1 ? "1px solid var(--ios-separator)" : "none", textAlign: "left", opacity: already || selected.length >= 4 ? 0.45 : 1 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", color: "var(--ios-label)", fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span>
                    <span className="ios-caption" style={{ color: "var(--ios-label-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{m.id}</span>
                  </span>
                  <span className="ios-caption" style={{ color: isPremiumRate(m) ? "var(--ios-orange, #D9772B)" : "var(--ios-label-3)", flexShrink: 0 }}>
                    {rateLabel(m) || "free"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {selected.length >= 4 && found && found.length > 0 && (
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>Panel is full — drop a model to add another.</div>
        )}
      </div>

      {/* Newest models, straight from OpenRouter's catalog */}
      {newest.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => setShowNewest((v) => !v)} className="ios-caption"
            style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "2px 0" }}>
            {showNewest ? "▾" : "▸"} Newest models on OpenRouter ({newest.length})
          </button>
          {showNewest && (
            <>
              <div className="ios-caption" style={{ color: "var(--ios-label-3)", margin: "4px 0 8px", lineHeight: 1.45 }}>
                Just-released models, listed live — anything at {`$${PREMIUM_PER_M}`}/M output or more asks you to accept the rate before it runs.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {newest.map((m) => {
                  const on = selected.includes(m.id);
                  const premium = isPremiumRate(m);
                  return (
                    <button key={m.id} onClick={() => toggle(m.id)} title={m.id}
                      style={{ padding: "7px 13px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${on ? "transparent" : premium ? "var(--ios-orange, #D9772B)" : "var(--ios-separator)"}`,
                        background: on ? m.color : "transparent", color: on ? "#fff" : "var(--ios-label)" }}>
                      {m.label}
                      <span style={{ opacity: on ? 0.8 : 0.55, fontWeight: 600 }}> · {rateLabel(m) || "—"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}


      {!busy && threads.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="ios-group-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 7px" }}>
            <span>RECENT · conversations saved</span>
            <button onClick={() => { persistThreads([]); newThread(); }} className="ios-caption" style={{ color: "var(--ios-tint)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Clear all</button>
          </div>
          <div className="ios-list" style={{ margin: 0 }}>
            {threads.map((t, i) => {
              const answers = t.turns.reduce((n, x) => n + (x.results?.filter((r) => r.answer && !r.error).length ?? 0), 0);
              const cost = t.turns.reduce((n, x) => n + (x.cost ?? 0), 0);
              const qs = t.turns.length;
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: i < threads.length - 1 ? "1px solid var(--ios-separator)" : "none", background: thread?.id === t.id ? "var(--ios-fill)" : "transparent" }}>
                  <button onClick={() => open(t)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <div style={{ color: "var(--ios-label)", fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.turns[0].q}</div>
                    <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>
                      {answers
                        ? `${qs} question${qs === 1 ? "" : "s"} · ${answers} saved answer${answers === 1 ? "" : "s"} · ${ago(t.at)}${cost > 0 ? ` · ${fmtCost(cost)}` : ""}`
                        : "tap to ask again"}
                    </div>
                  </button>
                  {answers > 0 && (
                    <button onClick={() => submit(t.turns[t.turns.length - 1].q, true)} aria-label="Ask again in a new thread" title="Ask again in a new thread (runs the models, costs money)"
                      style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 8, color: "var(--ios-tint)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "5px 9px", flexShrink: 0 }}>
                      Re-ask
                    </button>
                  )}
                  <button onClick={() => removeThread(t.id)} aria-label="Remove conversation" style={{ background: "none", border: "none", color: "var(--ios-label-3)", fontSize: 19, lineHeight: 1, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!thread && !busy && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => submit(s)}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-tint)", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {err && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 12 }}>{err}</div>}
      {busy && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 16 }}>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>Running against {selected.length} model{selected.length === 1 ? "" : "s"}…</div>
          <button onClick={() => abortRef.current?.abort()} className="ios-caption"
            style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 10, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "7px 16px" }}>
            Cancel
          </button>
        </div>
      )}

      {restored && thread && !busy && (
        <div className="ios-list" style={{ margin: "16px 0 0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="ios-caption" style={{ color: "var(--ios-label-2)", flex: 1, minWidth: 140 }}>
            Saved conversation from {ago(thread.at)} · no new cost
          </span>
          <button onClick={newThread} className="ios-caption" style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "5px 2px" }}>New thread</button>
        </div>
      )}

      {/* Image generation */}
      <div className="ios-group-header" style={{ padding: "18px 0 7px" }}>GENERATE AN IMAGE</div>
      <div className="ios-list" style={{ margin: 0, padding: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={imgPrompt}
            onChange={(e) => setImgPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") makeImage(); }}
            placeholder="Describe an image — e.g. a clean infographic of…"
            style={{ flex: 1, background: "var(--ios-fill)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, color: "var(--ios-label)" }}
          />
          <button onClick={makeImage} disabled={imgBusy || !imgPrompt.trim()}
            style={{ padding: "0 18px", borderRadius: 12, background: "var(--ios-tint)", color: "var(--ios-on-tint)", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: imgBusy || !imgPrompt.trim() ? 0.5 : 1 }}>
            {imgBusy ? "…" : "Create"}
          </button>
        </div>
        {imgErr && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginTop: 10 }}>{imgErr}</div>}
        {imgUrl && (
          <div style={{ marginTop: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt={imgPrompt} style={{ width: "100%", borderRadius: 12, display: "block" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
              <a href={imgUrl} download={`${slug(imgPrompt)}.png`} style={{ color: "var(--ios-tint)", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
                Download image ↓
              </a>
              {imgCost != null && <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>cost {fmtCost(imgCost)}</span>}
            </div>
          </div>
        )}
      </div>

      {/* The conversation, oldest first — it reads downward like a chat. */}
      {thread?.turns.map((turn, idx) => {
        const position = idx + 1; // 1 = the opening question
        return (
          <div key={turn.at}>
            <div className="ios-group-header" style={{ padding: "18px 0 7px" }}>
              {position === 1 ? "QUESTION" : `FOLLOW-UP ${position - 1}`} · {ago(turn.at)}
            </div>
            <div className="ios-list" style={{ margin: 0, padding: "10px 14px" }}>
              <div className="ios-subhead" style={{ color: "var(--ios-label)", whiteSpace: "pre-wrap" }}>{turn.q}</div>
              {turn.files && turn.files.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                  {turn.files.map((name) => (
                    <span key={name} className="ios-caption"
                      style={{ background: "var(--ios-fill)", borderRadius: 6, padding: "3px 7px", color: "var(--ios-label-2)", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📎 {name}
                    </span>
                  ))}
                </div>
              )}
              {turn.skippedVision && turn.skippedVision.length > 0 && (
                <div className="ios-caption" style={{ color: "var(--ios-orange, #D9772B)", marginTop: 7, lineHeight: 1.45 }}>
                  {turn.skippedVision.map((m) => META(m).label).join(", ")} can&rsquo;t see images — {turn.skippedVision.length === 1 ? "it answered" : "they answered"} from the text alone.
                </div>
              )}
            </div>

            {turn.synthesis && (
              <div className="ios-list" style={{ margin: "10px 0 8px", padding: 16, border: "1.5px solid var(--ios-tint)" }}>
                <div className="ios-caption" style={{ color: "var(--ios-tint)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 8 }}>✦ Synthesized answer</div>
                <div className="ios-subhead" style={{ color: "var(--ios-label)" }} dangerouslySetInnerHTML={{ __html: md(turn.synthesis) }} />
                <ExportBar content={turn.synthesis} title={turn.q} cost={turn.synthCost} exporting={exporting} onExport={exportAs} />
              </div>
            )}

            {turn.results && turn.results.length > 0 && (
              <>
                <div className="ios-group-header" style={{ padding: "12px 0 7px" }}>ANSWERS · swipe →</div>
                <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 6, margin: "0 -16px", paddingLeft: 16, paddingRight: 16 }}>
                  {turn.results.map((r) => {
                    const m = META(r.model);
                    return (
                      <div key={r.model} className="ios-list" style={{ margin: 0, flex: "0 0 84%", maxWidth: 340, scrollSnapAlign: "start", padding: 16, alignSelf: "flex-start" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color, flexShrink: 0 }} />
                          <span className="ios-headline" style={{ fontSize: 15 }}>{m.label}</span>
                          {r.served && r.served !== r.model && (
                            <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>via {metaOf(r.served, newest).label}</span>
                          )}
                        </div>
                        {r.error
                          ? <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", lineHeight: 1.5 }}>Couldn&apos;t answer: {r.error}</div>
                          : <><div className="ios-subhead" style={{ color: "var(--ios-label)", fontSize: 14.5 }} dangerouslySetInnerHTML={{ __html: md(r.answer) }} />
                              {r.citations && r.citations.length > 0 && <Sources items={r.citations} />}
                              {r.reaction && (
                                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `2px solid ${m.color}` }}>
                                  <div className="ios-caption" style={{ color: m.color, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 6 }}>
                                    ⇄ On the other answers
                                  </div>
                                  <div className="ios-subhead" style={{ color: "var(--ios-label-2)", fontSize: 14 }} dangerouslySetInnerHTML={{ __html: md(r.reaction) }} />
                                </div>
                              )}
                              <ExportBar content={r.reaction ? `${r.answer}\n\n## On the other answers\n${r.reaction}` : r.answer} title={`${m.label} — ${turn.q}`} cost={(r.cost ?? 0) + (r.reactionCost ?? 0) || r.cost} exporting={exporting} onExport={exportAs} /></>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Scroll anchor — the newest answers sit just above this. */}
      <div ref={bottomRef} />

      {/* ── Composer ────────────────────────────────────────────────────────
          Pinned to the bottom, so it has to stay SHORT. The first version put
          the toggles, the full-width button and a four-line cost caption in
          here too: ~450px of permanently-pinned bar, which on a phone covered
          the answers it was supposed to sit beneath. Everything that isn't
          "type and send" now lives behind Options. `bottom` clears the fixed
          tab bar (50px + the home-indicator inset). */}
      <div
        style={{
          position: "sticky",
          bottom: "calc(50px + env(safe-area-inset-bottom, 0px))",
          zIndex: 50,
          marginTop: 16,
          paddingTop: 8,
          background: "var(--ios-bg)",
          borderTop: "0.5px solid var(--ios-separator)",
        }}
      >
        {/* Higher rates still interrupt — never fold a spend behind a menu. */}
        {confirmRates && gated && !busy && (
          <div className="ios-list" style={{ margin: "0 0 8px", padding: 12, border: "1.5px solid var(--ios-orange, #D9772B)" }}>
            <div className="ios-subhead" style={{ color: "var(--ios-label)", fontWeight: 700, marginBottom: 6 }}>Higher rates on this run</div>
            {needsAccepting.map((id) => {
              const p = rates[id];
              return (
                <div key={id} className="ios-caption" style={{ color: "var(--ios-label-2)", display: "flex", justifyContent: "space-between", gap: 10, padding: "3px 0" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{META(id).label}</span>
                  <span style={{ flexShrink: 0 }}>{rateLabel(p)} out · {`$${perMillion(p?.prompt).toFixed(2)}`}/M in</span>
                </div>
              );
            })}
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", margin: "7px 0 9px", lineHeight: 1.45 }}>
              {estCost > 0 ? <>This run is estimated at <strong style={{ color: "var(--ios-label-2)" }}>~{fmtCost(estCost)}</strong>. </> : null}
              Accepting keeps {needsAccepting.length === 1 ? "this model" : "these models"} unlocked until you leave the page.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => { setAcceptedRates((a) => [...a, ...needsAccepting]); setConfirmRates(false); run(); }}
                className="ios-btn ios-btn--primary" style={{ flex: 1, minWidth: 160 }}>
                Accept rates &amp; ask
              </button>
              <button onClick={() => setConfirmRates(false)} className="ios-caption"
                style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 10, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "8px 14px" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Options — everything that used to be stacked in the bar. */}
        {optionsOpen && (
          <div className="ios-list" style={{ margin: "0 0 8px", padding: "12px 14px", maxHeight: "45vh", overflowY: "auto" }}>
            {thread && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span className="ios-caption" style={{ color: "var(--ios-label-2)", flex: 1, minWidth: 150, lineHeight: 1.4 }}>
                  In conversation · the panel remembers {thread.turns.length} earlier question{thread.turns.length === 1 ? "" : "s"}
                </span>
                <button onClick={() => { newThread(); setOptionsOpen(false); }} className="ios-caption"
                  style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 8, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "5px 10px", flexShrink: 0 }}>
                  New thread
                </button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button onClick={openLibrary} disabled={attachBusy} className="ios-caption"
                style={{ background: "none", border: "1px solid var(--ios-separator)", borderRadius: 8, color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "6px 10px" }}>
                Attach from Morris Hub
              </button>
              {attachments.length > 0 && (
                <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
                  {describeAttachments(attachments)} · sent every turn
                </span>
              )}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span className="ios-subhead">🌐 Live web — ground answers in current search results</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={debate} onChange={(e) => setDebate(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span className="ios-subhead">💬 Let the models respond to each other <span style={{ color: "var(--ios-label-3)" }}>— a second round, so roughly double the cost</span></span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={synthesize} onChange={(e) => setSynthesize(e.target.checked)} style={{ width: 18, height: 18 }} />
              <span className="ios-subhead">Synthesize into one merged answer</span>
            </label>

            <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 10, lineHeight: 1.5 }}>
              {estCost > 0 && <>Est. this run <strong style={{ color: "var(--ios-label-2)" }}>~{fmtCost(estCost)}</strong>{hasUnpriced ? " + Auto (varies)" : ""}. </>}
              {estCost === 0 && hasUnpriced && <>Auto Router price varies with the model it picks. </>}
              {thread && <>Follow-ups replay the thread, so they cost a little more. </>}
              {web && <>Live web adds ~$0.01–0.02 per model. </>}
              {attachmentTokens > 0 && (
                <>Attached files add ~{attachmentTokens.toLocaleString()} tokens to <em>each</em> model, every turn. </>
              )}
              {debate && <>The reaction round asks every model a second time. </>}
              {attachments.some((a) => a.remoteParse) && (
                <>A scanned PDF is read by OCR at $0.002/page — charged once; after that its text is held here. </>
              )}
              {sessionCost > 0 && <>Session <strong style={{ color: "var(--ios-label-2)" }}>{fmtCost(sessionCost)}</strong>. </>}
              Exact cost shown after each action.
            </div>
          </div>
        )}

        <div className="ios-list" style={{ margin: 0, padding: "8px 10px" }}>
          {/* Attached files — chips stay put across follow-ups. */}
          {attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
              {attachments.map((a) => (
                <span key={a.id} className="ios-caption"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--ios-fill)", borderRadius: 8, padding: "4px 6px 4px 8px", maxWidth: "100%" }}>
                  <span aria-hidden>{fileIcon(a.kind)}</span>
                  <span style={{ color: "var(--ios-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{a.name}</span>
                  {(a.remoteParse || a.ocrDone) && (
                    <span
                      style={{ color: a.ocrDone ? "var(--ios-green)" : "var(--ios-orange, #D9772B)" }}
                      title={a.ocrDone
                        ? "Read by OCR — the text is held here now, so follow-ups cost nothing extra"
                        : `No text layer — a scan, or a form whose values were never drawn onto the page. It'll be read by OCR${a.pages ? ` (${a.pages} page${a.pages === 1 ? "" : "s"})` : ""}.`}
                    >
                      {a.ocrDone ? "OCR ✓" : "OCR"}
                    </span>
                  )}
                  {a.truncated && <span style={{ color: "var(--ios-orange, #D9772B)" }} title="Only the beginning of this file was read">clipped</span>}
                  <button onClick={() => removeAttachment(a.id)} aria-label={`Remove ${a.name}`}
                    style={{ background: "none", border: "none", color: "var(--ios-label-3)", cursor: "pointer", fontSize: 15, lineHeight: 1, padding: "0 2px" }}>×</button>
                </span>
              ))}
            </div>
          )}
          {attachErr && <div className="ios-footnote" style={{ color: "var(--ios-red, #FF3B30)", marginBottom: 6, lineHeight: 1.45 }}>{attachErr}</div>}

          {/* The bar itself: attach · type · send. One row, always. */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
            style={{ display: "flex", alignItems: "flex-end", gap: 7, borderRadius: 12, outline: dragging ? "2px dashed var(--ios-tint)" : "none", outlineOffset: 3 }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.tsv,.json,.yaml,.yml,.xml,.html,.log,.ts,.tsx,.js,.jsx,.py,.rb,.go,.java,.sql,.sh,.css,image/*"
              onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }}
              style={{ display: "none" }}
            />
            <button onClick={() => fileInputRef.current?.click()} disabled={attachBusy}
              aria-label="Attach a file" title="Attach a file"
              style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 17, background: "var(--ios-fill)", border: "none", color: "var(--ios-tint)", fontSize: 15, cursor: attachBusy ? "wait" : "pointer", lineHeight: 1 }}>
              {attachBusy ? "…" : "📎"}
            </button>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter makes a newline — the chat convention.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={dragging
                ? "Drop to attach…"
                : thread
                ? "Ask a follow-up…"
                : "Ask the panel anything…"}
              rows={1}
              style={{ flex: 1, minWidth: 0, background: "var(--ios-fill)", border: "none", borderRadius: 17, padding: "8px 13px", fontSize: 16, lineHeight: 1.35, color: "var(--ios-label)", resize: "none", fontFamily: "inherit", maxHeight: 110, overflowY: "auto" }}
            />

            <button onClick={() => submit()} disabled={busy || !question.trim() || selected.length === 0}
              aria-label={gated ? "Review rates before asking" : "Ask the panel"}
              title={gated ? `Review rates · ${needsAccepting.length} higher-rate model${needsAccepting.length === 1 ? "" : "s"}` : `Ask ${selected.length} model${selected.length === 1 ? "" : "s"}`}
              style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 17, background: gated ? "var(--ios-orange, #D9772B)" : "var(--ios-tint)", border: "none", color: "var(--ios-on-tint)", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: busy || !question.trim() || selected.length === 0 ? 0.4 : 1, lineHeight: 1 }}>
              {busy ? "…" : gated ? "!" : "↑"}
            </button>
          </div>

          {/* One quiet line: what's on, what it'll cost, and the way to change it. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <button onClick={() => setOptionsOpen((v) => !v)} className="ios-caption"
              aria-expanded={optionsOpen}
              style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", padding: "2px 0", flexShrink: 0 }}>
              Options {optionsOpen ? "▾" : "▸"}
            </button>
            <span className="ios-caption" style={{ color: "var(--ios-label-3)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.length} model{selected.length === 1 ? "" : "s"}
              {web ? " · web" : ""}{debate ? " · debate" : ""}{synthesize ? " · synthesis" : ""}
              {thread ? ` · ${thread.turns.length} asked` : ""}
              {estCost > 0 ? ` · ~${fmtCost(estCost)}` : ""}
            </span>
            {busy && (
              <button onClick={() => abortRef.current?.abort()} className="ios-caption"
                style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* "From Morris Hub" — documents the app already holds. */}
      {libraryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Attach a file from Morris Hub"
          onClick={() => setLibraryOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--ios-bg-elevated)", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 520, maxHeight: "70vh", overflowY: "auto", padding: "16px 16px calc(20px + env(safe-area-inset-bottom, 0px))" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span className="ios-headline">From Morris Hub</span>
              <button onClick={() => setLibraryOpen(false)} className="ios-caption"
                style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer" }}>Done</button>
            </div>

            {libraryBusy && <div className="ios-subhead" style={{ color: "var(--ios-label-2)", padding: "12px 0" }}>Loading your files…</div>}

            {!libraryBusy && library?.length === 0 && (
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5, padding: "8px 0 4px" }}>
                No documents yet. The panel can read files you&rsquo;ve uploaded to a course under{" "}
                <strong style={{ color: "var(--ios-label)" }}>Me → Courses</strong> — that&rsquo;s the only place the app keeps
                your documents today. Anything else, attach from your device.
              </div>
            )}

            {!libraryBusy && library && library.length > 0 && (
              <div className="ios-list" style={{ margin: 0 }}>
                {library.map((f) => {
                  const already = attachments.some((a) => a.id === f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => !already && attachFromLibrary(f.id)}
                      disabled={already || attachBusy}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", borderBottom: "0.5px solid var(--ios-separator)", padding: "11px 2px", textAlign: "left", cursor: already ? "default" : "pointer", opacity: already ? 0.5 : 1 }}
                    >
                      <span aria-hidden>📄</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="ios-subhead" style={{ color: "var(--ios-label)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.title}
                        </span>
                        <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
                          {f.group}{f.sizeKb ? ` · ${f.sizeKb}KB` : ""}
                        </span>
                      </span>
                      <span className="ios-caption" style={{ color: already ? "var(--ios-label-3)" : "var(--ios-tint)", fontWeight: 700, flexShrink: 0 }}>
                        {already ? "Attached" : "Attach"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {notice && <div className="ios-footnote" style={{ color: "var(--ios-green)", marginTop: 10, textAlign: "center" }}>{notice}</div>}

    </div>
  );
}

function Sources({ items }: { items: Citation[] }) {
  let host = (u: string) => u;
  host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  return (
    <div style={{ marginTop: 10 }}>
      <div className="ios-caption" style={{ color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginBottom: 5 }}>Sources</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {items.slice(0, 8).map((c, i) => (
          <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="ios-caption"
            style={{ color: "var(--ios-tint)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {i + 1}. {c.title || host(c.url)} <span style={{ color: "var(--ios-label-3)" }}>· {host(c.url)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ExportBar({ content, title, cost, exporting, onExport }: {
  content: string; title: string; cost: number | null; exporting: string | null;
  onExport: (content: string, format: "md" | "docx" | "pptx", title: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  }
  const btn = (fmt: "md" | "docx" | "pptx", label: string) => (
    <button onClick={() => onExport(content, fmt, title)} disabled={exporting != null}
      style={{ padding: "6px 11px", borderRadius: 8, border: "1px solid var(--ios-separator)", background: "transparent", color: "var(--ios-tint)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", opacity: exporting != null ? 0.5 : 1 }}>
      {exporting === fmt ? "…" : label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--ios-separator)" }}>
      <button onClick={copy}
        style={{ padding: "6px 11px", borderRadius: 8, border: "1px solid var(--ios-separator)", background: copied ? "var(--ios-tint)" : "transparent", color: copied ? "var(--ios-on-tint)" : "var(--ios-tint)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
      {btn("docx", "Word")}
      {btn("pptx", "PowerPoint")}
      {btn("md", "Markdown")}
      {cost != null && <span className="ios-caption" style={{ color: "var(--ios-label-3)", marginLeft: "auto" }}>{fmtCost(cost)}</span>}
    </div>
  );
}
