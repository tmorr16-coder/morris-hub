"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AUTO_MODEL, AUTO_MODEL_META, COMPARE_MODELS, LIVE_MODELS, MORE_MODELS, SYNTH_MODEL,
  isPremiumRate, perMillion, PREMIUM_PER_M, type CatalogModel, type CompareModel,
} from "@/lib/openrouter";
import type { Pricing } from "./page";
import { describeAttachments, estimateTokens, estimateOcrCost, type PanelAttachment } from "@/lib/panel-context";
import "./panel.css";

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
const BUDGET_KEY = "panel-budget-v1";
/** Enough for a few dozen ordinary runs; raised in one tap when it bites. */
const DEFAULT_BUDGET = 5;

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
  ALL.find((m) => m.id === id) ?? extra.find((m) => m.id === id) ?? { id, label: id, vendor: "Model", color: "var(--pc-text-2)" };

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
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
function md(text: string) {
  const out: string[] = []; let list: "ul" | "ol" | null = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { close(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { close(); out.push(`<h${Math.min(h[1].length + 2, 4)}>${inline(h[2])}</h${Math.min(h[1].length + 2, 4)}>`); continue; }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/); const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(ul[1])}</li>`); continue; }
    if (ol) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); continue; }
    close(); out.push(`<p>${inline(line)}</p>`);
  }
  close(); return out.join("");
}

const MAX_ATTACHMENTS = 10;

/**
 * Attachments that carry a base64 payload rather than text — an image, or a
 * PDF being sent for OCR. These are what blow the localStorage budget, so they
 * are the first thing shed when a save doesn't fit.
 */
function isHeavy(a: PanelAttachment): boolean {
  return a.kind === "image" || Boolean(a.remoteParse);
}

/**
 * Line icons.
 *
 * The screen used to speak in emoji — a paperclip, a globe, a speech bubble, a
 * four-pointed star, an up arrow rendered as the character "↑". Emoji are drawn
 * by the OS, so they arrived at the wrong weight and colour on every platform
 * and made a working surface look like a chat sticker tray. These are stroked
 * paths that inherit currentColor and sit on the text baseline.
 */
function Icon({ d, size = 16, fill = false }: { d: string; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden
      fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}
const P = {
  clip: "M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.67 3.67 0 0 1 5.19 5.19l-8.49 8.48a1.83 1.83 0 0 1-2.6-2.59l7.78-7.78",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z",
  chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z",
  sparkle: "M12 2.6c0 4.1 2.7 6.8 6.8 6.8-4.1 0-6.8 2.7-6.8 6.8 0-4.1-2.7-6.8-6.8-6.8 4.1 0 6.8-2.7 6.8-6.8Z",
  sliders: "M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M7 16v4",
  square: "M4 5h7v14H4zM13 5h7v14h-7z",
  stop: "M6 6h12v12H6z",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  image: "M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6",
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  book: "M4 4h9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4zM20 4h-1a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20z",
};

/**
 * A capped scroll box that admits what it is hiding.
 *
 * Long answers scroll inside their card so one essay does not stretch the row
 * past a two-line answer beside it. A plain `overflow: auto` cuts the last
 * visible line in half and looks like a rendering fault, so the bottom is
 * faded — but only while there is genuinely more below. A fade applied
 * unconditionally would grey out the final line of a short answer that fits,
 * which is the same lie in the other direction, so this measures instead of
 * assuming and drops the fade once you have scrolled to the end.
 */
function Scroller({ maxHeight, children }: { maxHeight: number | string; children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    const update = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 8);
    update();
    el.addEventListener("scroll", update, { passive: true });
    // Watch the content, not the box: the box's height is pinned by maxHeight,
    // so it does not resize when an answer streams in underneath it.
    const ro = new ResizeObserver(update);
    ro.observe(inner);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, []);
  return (
    <div ref={boxRef} className={`pc-scroll${more ? "" : " pc-scroll--end"}`} style={{ maxHeight }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

/** Icon for an attachment chip, by kind. */
function FileIcon({ kind }: { kind: PanelAttachment["kind"] }) {
  const d = kind === "image" ? P.image : kind === "pdf" || kind === "docx" ? P.book : P.doc;
  return <Icon d={d} size={14} />;
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
  // One ceiling on what a session can spend, instead of a warning on every
  // surface. The old per-model rate gate asked you to accept a $/M figure —
  // which is not the thing anyone actually wants bounded. This is.
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [overBudget, setOverBudget] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set()); // collapsed turns (by turn.at)
  const abortRef = useRef<AbortController | null>(null);

  const toggleCollapse = (key: number) => setCollapsed((s) => {
    const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n;
  });

  // ── Attachments + debate ────────────────────────────────────────────────
  // `attachments` is the working set for the next turn. When a thread is open
  // it mirrors thread.attachments, so files stay put across follow-ups.
  const [attachments, setAttachments] = useState<PanelAttachment[]>([]);
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // The attachment whose extracted text is being inspected. "OCR ✓" is a claim;
  // this is how someone checks it before trusting an answer about the numbers.
  const [previewFile, setPreviewFile] = useState<PanelAttachment | null>(null);
  // The turn currently streaming in — rendered at the foot of the transcript
  // so answers appear one by one instead of all at once after a long wait.
  const [liveTurn, setLiveTurn] = useState<Turn | null>(null);
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
    if (!libraryOpen && !panelOpen && !previewFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setLibraryOpen(false);
      setPanelOpen(false);
      setPreviewFile(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [libraryOpen, panelOpen, previewFile]);

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

  // The ceiling is a preference, not a per-session decision.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BUDGET_KEY);
      if (raw != null) {
        const n = parseFloat(raw);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (Number.isFinite(n) && n >= 0) setBudget(n);
      }
    } catch { /* private mode — the default stands */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(BUDGET_KEY, String(budget)); } catch { /* ignore */ }
  }, [budget]);

  const anyOptionOn = web || debate || synthesize;

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

    // Then reconcile with the server, so a conversation started elsewhere shows
    // up here. Local wins on a tie: it is the copy with this browser's
    // attachments still attached.
    (async () => {
      try {
        const res = await fetch("/api/ask/compare/threads");
        if (!res.ok) return;
        const { threads: remote } = await res.json();
        if (!Array.isArray(remote) || !remote.length) return;
        const byId = new Map<number, Thread>();
        for (const t of remote as Thread[]) if (t?.id) byId.set(t.id, t);
        for (const t of saved) if (t?.id) byId.set(t.id, t);
        const merged = [...byId.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, MAX_ENTRIES);
        setThreads(merged);
      } catch { /* keep the local list */ }
    })();
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

  /**
   * Mirror a thread to the server, best-effort.
   *
   * localStorage stays the source of truth for this browser — it is instant and
   * works offline — and the server copy is what lets the same conversation open
   * on another device. A failed sync is silent on purpose: losing the network
   * should not interrupt someone mid-question.
   */
  function syncThread(t: Thread) {
    fetch("/api/ask/compare/threads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread: t }),
    }).catch(() => { /* offline, or the table isn't there yet */ });
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
    fetch(`/api/ask/compare/threads?id=${id}`, { method: "DELETE" }).catch(() => { /* best effort */ });
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
  // Would this run take the session past its ceiling?
  const wouldExceed = budget > 0 && sessionCost + estCost > budget;

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

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]);
    setOverBudget(false);
  }

  /** Ask, unless this run would take the session past its ceiling. */
  function submit(text?: string, startNew?: boolean) {
    if (wouldExceed) { setOverBudget(true); return; }
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

    // A re-ask starts clean; a follow-up carries whatever the thread holds.
    const turnFiles = startNew ? attachments : (base?.attachments ?? attachments);
    const at = Date.now();

    // The turn is built up live. Models that haven't answered yet simply aren't
    // in `results` — the card grid shows a waiting placeholder for each one it
    // is still expecting, so the screen is never motionless.
    let live: Turn = {
      q, at, results: [], synthesis: null, synthCost: null, cost: null,
      files: turnFiles.map((a) => a.name), skippedVision: [],
    };
    const publish = () => setLiveTurn({ ...live, results: [...(live.results ?? [])] });
    publish();

    let banked = turnFiles;
    let totalCost = 0;

    try {
      const res = await fetch("/api/ask/compare", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q, models: selected, synthesize, web, debate,
          history: base ? toHistory(base.turns) : [],
          attachments: turnFiles,
        }),
        signal: controller.signal,
      });

      // Errors still come back as ordinary JSON with a status — only a 200
      // opens the event stream.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? data.error ?? `Failed (${res.status})`);
      }
      if (!res.body) throw new Error("No response from the panel.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let streamErr: string | null = null;

      // SSE frames are separated by a blank line; a frame can straddle two
      // chunks, so whatever follows the last separator is held back for the
      // next read rather than parsed half-formed.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";

        for (const frame of frames) {
          const evLine = frame.split("\n").find((l) => l.startsWith("event: "));
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!evLine || !dataLine) continue;
          const event = evLine.slice(7).trim();
          let payload: Record<string, unknown>;
          try { payload = JSON.parse(dataLine.slice(6)); } catch { continue; }

          if (event === "answer") {
            live = { ...live, results: [...(live.results ?? []), payload as unknown as Result] };
            publish();
          } else if (event === "reaction") {
            live = {
              ...live,
              results: (live.results ?? []).map((r) =>
                r.model === payload.model
                  ? { ...r, reaction: payload.reaction as string, reactionCost: payload.reactionCost as number | null }
                  : r
              ),
            };
            publish();
          } else if (event === "synthesis") {
            live = { ...live, synthesis: payload.synthesis as string, synthCost: (payload.synthesisCost as number) ?? null };
            publish();
          } else if (event === "vision") {
            live = { ...live, skippedVision: (payload.skippedVision as string[]) ?? [] };
            publish();
          } else if (event === "files") {
            // Swap each OCR'd PDF for the text that came back and drop the file.
            // The base64 must not travel again: PDF plus annotation images blew
            // Vercel's 4.5MB request limit on the second turn and the request
            // died with no response at all. Once we hold the text, it's ballast.
            const parsed = (payload.parsedFiles as { name: string | null; text: string; truncated: boolean }[]) ?? [];
            if (parsed.length) {
              let nextIdx = 0;
              banked = turnFiles.map((a) => {
                if (!a.remoteParse) return a;
                // Match on filename where OpenRouter echoed one, else in order.
                const hit = parsed.find((f) => f.name && f.name === a.name) ?? parsed[nextIdx++];
                if (!hit) return a;
                return { ...a, text: hit.text, truncated: hit.truncated, dataUrl: undefined, remoteParse: false, ocrDone: true };
              });
              setAttachments(banked);
            }
          } else if (event === "done") {
            totalCost = (payload.totalCost as number) ?? 0;
            live = { ...live, cost: totalCost };
          } else if (event === "error") {
            streamErr = (payload.message as string) ?? "The run failed.";
          }
        }
      }

      if (streamErr) throw new Error(streamErr);
      if (!live.results?.length) throw new Error("The panel returned nothing. Try again.");

      if (totalCost) setSessionCost((s) => s + totalCost);

      // Keep the whole turn, so re-opening this conversation is free.
      const next: Thread = base
        ? { ...base, at, models: selected, web, turns: [...base.turns, live], attachments: banked }
        : { id: at, at, models: selected, web, turns: [live], attachments: banked };
      setThread(next);
      persistThreads([next, ...threads.filter((t) => t.id !== next.id)]);
      syncThread(next);
    } catch (e) {
      setQuestion(q); // don't lose what they typed
      if ((e as Error).name === "AbortError") {
        // Cancelling stops the waiting, not the models — say so rather than
        // implying the run was free.
        setNotice("Cancelled — models already asked may still be billed.");
        setTimeout(() => setNotice(null), 5000);
      } else setErr((e as Error).message);
    } finally {
      abortRef.current = null;
      setBusy(false);
      setLiveTurn(null);
    }
  }

  return (
    <div className="pc">
      {!connected && (
        <div className="pc-sheet">
          <div className="pc-note">
            Add an <strong>OPENROUTER_API_KEY</strong> to enable the panel. Get one at openrouter.ai.
          </div>
        </div>
      )}

      {err && <div className="pc-sheet pc-alert"><div className="pc-note" style={{ color: "var(--pc-text)" }}>{err}</div></div>}

      {restored && thread && !busy && (
        <div className="pc-sheet" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "11px 16px" }}>
          <span className="pc-note" style={{ flex: 1, minWidth: 140 }}>
            Saved conversation from {ago(thread.at)} · no new cost
          </span>
          <button onClick={newThread} className="pc-btn">New chat</button>
        </div>
      )}


      {/* The conversation, oldest first — it reads downward like a chat. The
          turn still streaming in is appended so it renders through exactly the
          same path as a finished one, gaining placeholders for the models it is
          still waiting on. */}
      {[...(thread?.turns ?? []), ...(liveTurn ? [liveTurn] : [])].map((turn, idx, allTurns) => {
        const isLive = liveTurn != null && idx === allTurns.length - 1 && turn.at === liveTurn.at;
        const answered = new Set((turn.results ?? []).map((r) => r.model));
        const pending = isLive ? selected.filter((m) => !answered.has(m)) : [];
        const isCollapsed = collapsed.has(turn.at);
        const hasBody = Boolean(turn.synthesis || (turn.results && turn.results.length));
        return (
          <div key={turn.at} className="pc-turn">
            {/* The question, set the way Claude sets a user message: a warm
                block against the right edge, so the eye can find where each
                exchange starts without a rule labelled "FOLLOW-UP 2" across
                the page. */}
            <div className="pc-user-row">
              <div className="pc-user">
                <span style={{ whiteSpace: "pre-wrap" }}>{turn.q}</span>
                {turn.files && turn.files.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {turn.files.map((name) => (
                      <span key={name} className="pc-chip" style={{ background: "var(--pc-sand-2)" }}>
                        <Icon d={P.clip} size={13} />
                        <span className="pc-chip-name">{name}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 2px" }}>
              <span className="pc-meta">{ago(turn.at)}</span>
              <span style={{ flex: 1 }} />
              {hasBody && (
                <button onClick={() => toggleCollapse(turn.at)} className="pc-link">
                  {isCollapsed ? "Show answers" : "Hide"}
                </button>
              )}
            </div>

            {turn.skippedVision && turn.skippedVision.length > 0 && (
              <div className="pc-note" style={{ color: "var(--pc-accent)", margin: "2px 0 6px" }}>
                {turn.skippedVision.map((m) => META(m).label).join(", ")} can&rsquo;t see images — {turn.skippedVision.length === 1 ? "it answered" : "they answered"} from the text alone.
              </div>
            )}

            {!isCollapsed && turn.synthesis && (
              <div className="pc-synth">
                <div className="pc-synth-h"><Icon d={P.sparkle} size={14} fill /> Merged answer</div>
                <Scroller maxHeight="min(64vh, 620px)">
                  <div className="pc-prose" dangerouslySetInnerHTML={{ __html: md(turn.synthesis) }} />
                </Scroller>
                <ExportBar content={turn.synthesis} title={turn.q} cost={turn.synthCost} exporting={exporting} onExport={exportAs} />
              </div>
            )}

            {!isCollapsed && ((turn.results && turn.results.length > 0) || pending.length > 0) && (
              <>
                <div className="pc-meta" style={{ padding: "4px 0 10px" }}>
                  {pending.length > 0
                    ? `${answered.size} of ${answered.size + pending.length} in`
                    : `${answered.size} answer${answered.size === 1 ? "" : "s"}`}
                </div>
                {/* A grid, not a carousel. The whole point of the panel is reading
                    answers against each other; the old 84%-wide snap track showed
                    exactly one at a time on every screen, so a wide display was no
                    more useful than a phone. auto-fit gives one column on a phone,
                    two on a tablet, three or four on a desktop. */}
                <div className="pc-cards">
                  {(turn.results ?? []).map((r) => {
                    const m = META(r.model);
                    return (
                      <div key={r.model} className="pc-card">
                        <div className="pc-card-h">
                          <span className="pc-dot" style={{ background: m.color }} />
                          <span className="pc-card-name">{m.label}</span>
                          {r.served && r.served !== r.model && (
                            <span className="pc-via">via {metaOf(r.served, newest).label}</span>
                          )}
                        </div>
                        {r.error
                          ? <div className="pc-note" style={{ color: "var(--pc-accent)" }}>Couldn&apos;t answer: {r.error}</div>
                          : <>
                              {/* Long answers scroll inside the card so a wall of text
                                  doesn't stretch the row past the short ones. The clip
                                  is now faded rather than cut, so it reads as "more
                                  below" instead of a sentence ending mid-word. */}
                              <Scroller maxHeight="min(62vh, 560px)">
                                <div className="pc-prose" dangerouslySetInnerHTML={{ __html: md(r.answer) }} />
                                {r.citations && r.citations.length > 0 && <Sources items={r.citations} />}
                                {r.reaction && (
                                  <div className="pc-reaction">
                                    <div className="pc-reaction-h" style={{ color: m.color }}>
                                      <Icon d={P.chat} size={13} /> On the other answers
                                    </div>
                                    <div className="pc-prose" style={{ color: "var(--pc-text-2)", fontSize: 15 }} dangerouslySetInnerHTML={{ __html: md(r.reaction) }} />
                                  </div>
                                )}
                              </Scroller>
                              <ExportBar content={r.reaction ? `${r.answer}\n\n## On the other answers\n${r.reaction}` : r.answer} title={`${m.label} — ${turn.q}`} cost={(r.cost ?? 0) + (r.reactionCost ?? 0) || r.cost} exporting={exporting} onExport={exportAs} /></>}
                      </div>
                    );
                  })}

                  {/* One placeholder per model still working. Named, so it's
                      obvious which one is slow rather than just "loading". */}
                  {pending.map((id) => {
                    const m = META(id);
                    return (
                      <div key={`pending-${id}`} className="pc-card pc-card--pending">
                        <div className="pc-card-h">
                          <span className="pc-dot" style={{ background: m.color }} />
                          <span className="pc-card-name">{m.label}</span>
                        </div>
                        <div className="pc-meta pc-pulse">Thinking…</div>
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                          {[92, 78, 85, 61].map((w, i) => (
                            <div key={i} className="pc-skel pc-pulse" style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
                          ))}
                        </div>
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
      <div className="pc-composer-wrap">
        {/* The one interruption left. A ceiling on real spend replaces the old
            per-model rate gate: nobody wants to reason about $/M, they want to
            know this session cannot run away. Never folded behind Options. */}
        {overBudget && !busy && (
          <div className="pc-sheet pc-alert">
            <div className="pc-alert-title">That would pass your session limit</div>
            <div className="pc-note" style={{ marginBottom: 12 }}>
              You&rsquo;ve spent <strong style={{ color: "var(--pc-text)" }}>{fmtCost(sessionCost)}</strong> of{" "}
              <strong style={{ color: "var(--pc-text)" }}>{fmtCost(budget)}</strong>, and this run is estimated at about{" "}
              <strong style={{ color: "var(--pc-text)" }}>{fmtCost(estCost)}</strong>.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => { setBudget((b: number) => b + 5); setOverBudget(false); run(); }} className="pc-btn pc-btn--accent">
                Add $5 and ask
              </button>
              <button onClick={() => setOverBudget(false)} className="pc-btn">Not now</button>
            </div>
          </div>
        )}

        {/* Options — everything that used to be stacked in the bar. */}
        {optionsOpen && (
          <div className="pc-sheet" style={{ maxHeight: "45vh", overflowY: "auto" }}>
            {thread && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span className="pc-note" style={{ flex: 1, minWidth: 150 }}>
                  In conversation · the panel remembers {thread.turns.length} earlier question{thread.turns.length === 1 ? "" : "s"}
                </span>
                <button onClick={() => { newThread(); setOptionsOpen(false); }} className="pc-btn">New chat</button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => { setPanelOpen(true); setOptionsOpen(false); }} className="pc-btn">
                <Icon d={P.square} size={14} /> Change panel
              </button>
              <button onClick={openLibrary} disabled={attachBusy} className="pc-btn">
                <Icon d={P.doc} size={14} /> Attach from Morris Hub
              </button>
              {attachments.length > 0 && (
                <span className="pc-meta">{describeAttachments(attachments)} · sent every turn</span>
              )}
            </div>
            <div className="pc-note" style={{ marginTop: 9, color: "var(--pc-text-3)" }}>
              Up to {MAX_ATTACHMENTS} files, 10MB each — or 2.5MB for a scan that needs reading by OCR.
              {attachmentTokens > 0 && <> Attached text adds about {attachmentTokens.toLocaleString()} tokens to every model, every turn.</>}
            </div>

            <div style={{ marginTop: 12, borderTop: "1px solid var(--pc-line)", paddingTop: 4 }}>
              <label className="pc-check">
                <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
                <span>Live web <em>— ground answers in current search results</em></span>
              </label>
              <label className="pc-check">
                <input type="checkbox" checked={debate} onChange={(e) => setDebate(e.target.checked)} />
                <span>Let the models respond to each other <em>— a second round, so roughly double the cost</em></span>
              </label>
              <label className="pc-check">
                <input type="checkbox" checked={synthesize} onChange={(e) => setSynthesize(e.target.checked)} />
                <span>Merge into one answer</span>
              </label>
            </div>

            {/* One place for money. This used to be six separate warnings —
                estimate, rate gate, per-answer, session total, OCR per page and
                a per-turn token note — which made every question read as a
                purchase. A ceiling set once does the protecting instead. */}
            <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid var(--pc-line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 140, fontSize: 14.5 }}>
                  Spent <strong>{fmtCost(sessionCost)}</strong> of{" "}
                  <strong>{fmtCost(budget)}</strong> this session
                </span>
                <label className="pc-meta" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Limit $
                  <input
                    type="number" min={0} step={1} value={budget} className="pc-field"
                    onChange={(e) => { const n = parseFloat(e.target.value); setBudget(Number.isFinite(n) && n >= 0 ? n : 0); setOverBudget(false); }}
                    style={{ width: 66 }}
                  />
                </label>
              </div>
              <div className="pc-note" style={{ color: "var(--pc-text-3)", marginTop: 8 }}>
                {estCost > 0
                  ? <>This run is about <strong style={{ color: "var(--pc-text-2)" }}>{fmtCost(estCost)}</strong>{hasUnpriced ? ", plus Auto (varies)" : ""}. </>
                  : hasUnpriced ? <>Auto Router&rsquo;s price depends on the model it picks. </> : null}
                Set the limit to 0 to turn the ceiling off.
              </div>
            </div>
          </div>
        )}

        {/* ── The composer ────────────────────────────────────────────────
            One box. The attachments, the text and every control that acts on
            them live inside the same rounded, bordered, slightly raised
            container, the way Claude's does — instead of a thin grey pill with
            a row of loose blue links floating underneath it. The border is the
            only strong line on the screen, which is what makes the composer
            read as the thing you act with. */}
        <div
          className={`pc-composer${dragging ? " pc-composer--drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
        >
          {/* Attached files — chips stay put across follow-ups, and now sit
              inside the box with the text they belong to. */}
          {attachments.length > 0 && (
            <div className="pc-chips">
              {attachments.map((a) => (
                <span key={a.id} className="pc-chip">
                  <FileIcon kind={a.kind} />
                  {a.text ? (
                    <button onClick={() => setPreviewFile(a)}
                      title={`See what was read out of ${a.name}`}
                      className="pc-chip-name"
                      style={{ color: "var(--pc-text)", textDecoration: "underline", textDecorationColor: "var(--pc-line-2)", textUnderlineOffset: 2 }}>
                      {a.name}
                    </button>
                  ) : (
                    <span className="pc-chip-name" style={{ color: "var(--pc-text)" }}>{a.name}</span>
                  )}
                  {(a.remoteParse || a.ocrDone) && (
                    <span
                      style={{ color: a.ocrDone ? "var(--pc-text-3)" : "var(--pc-accent)", fontSize: 11.5, fontWeight: 600 }}
                      title={a.ocrDone
                        ? "Read by OCR — the text is held here now, so follow-ups cost nothing extra"
                        : `No text layer — a scan, or a form whose values were never drawn onto the page. It'll be read by OCR${a.pages ? ` (${a.pages} page${a.pages === 1 ? "" : "s"})` : ""}.`}
                    >
                      {a.ocrDone ? "OCR ✓" : "OCR"}
                    </span>
                  )}
                  {a.truncated && <span style={{ color: "var(--pc-accent)", fontSize: 11.5 }} title="Only the beginning of this file was read">clipped</span>}
                  <button onClick={() => removeAttachment(a.id)} aria-label={`Remove ${a.name}`} className="pc-chip-x">
                    <Icon d={P.close} size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {attachErr && <div className="pc-note" style={{ color: "var(--pc-accent)", marginBottom: 8 }}>{attachErr}</div>}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.tsv,.json,.yaml,.yml,.xml,.html,.log,.ts,.tsx,.js,.jsx,.py,.rb,.go,.java,.sql,.sh,.css,image/*"
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }}
            style={{ display: "none" }}
          />

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
              ? "Reply to the panel…"
              : "How can the panel help you today?"}
            rows={1}
            className="pc-ta"
            style={{ height: "auto" }}
            onInput={(e) => {
              // Grow with the text, up to the max-height the stylesheet sets.
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />

          {/* Controls, inside the box: what acts on the message sits with it. */}
          <div className="pc-composer-bar">
            <button onClick={() => fileInputRef.current?.click()} disabled={attachBusy}
              className="pc-icon-btn" aria-label="Attach a file" title="Attach a file">
              {attachBusy ? <span className="pc-pulse" style={{ fontSize: 13 }}>···</span> : <Icon d={P.clip} size={17} />}
            </button>

            <button onClick={() => setOptionsOpen((v) => !v)} aria-expanded={optionsOpen}
              className={`pc-tag${anyOptionOn ? " pc-tag--on" : ""}`} title="Web, debate, merge and the spend limit">
              <Icon d={P.sliders} size={14} />
              {/* On a phone the label goes and the icon carries it — truncating
                  "Web · Merge" to "Web · M…" says less than the icon does. */}
              <span className="pc-hide-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {anyOptionOn
                  ? [web && "Web", debate && "Debate", synthesize && "Merge"].filter(Boolean).join(" · ")
                  : "Options"}
              </span>
            </button>

            {/* Which models answer — named where you are about to ask them. */}
            <button onClick={() => setPanelOpen(true)} className="pc-tag" title="Choose which models answer">
              <span className="pc-tag-dots">
                {selected.slice(0, 4).map((id) => (
                  <i key={id} style={{ background: META(id).color }} />
                ))}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected.length}<span className="pc-hide-sm"> model{selected.length === 1 ? "" : "s"}</span>
              </span>
            </button>

            <span className="pc-spacer" />

            {estCost > 0 && !busy && (
              <span className="pc-meta" style={{ whiteSpace: "nowrap" }}>~{fmtCost(estCost)}</span>
            )}

            {busy ? (
              <button onClick={() => abortRef.current?.abort()} className="pc-send" aria-label="Stop" title="Stop">
                <Icon d={P.stop} size={13} fill />
              </button>
            ) : (
              <button onClick={() => submit()} disabled={!question.trim() || selected.length === 0}
                className="pc-send" aria-label="Ask the panel"
                title={`Ask ${selected.length} model${selected.length === 1 ? "" : "s"}`}>
                <Icon d={P.arrowUp} size={17} />
              </button>
            )}
          </div>
        </div>
      </div>

      {!busy && threads.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px 9px" }}>
            <span className="pc-meta">Recents</span>
            <button onClick={() => { fetch("/api/ask/compare/threads", { method: "DELETE" }).catch(() => {}); persistThreads([]); newThread(); }} className="pc-link">Clear all</button>
          </div>
          <div className="pc-recents">
            {threads.map((t) => {
              const answers = t.turns.reduce((n, x) => n + (x.results?.filter((r) => r.answer && !r.error).length ?? 0), 0);
              const cost = t.turns.reduce((n, x) => n + (x.cost ?? 0), 0);
              const qs = t.turns.length;
              return (
                <div key={t.id} className={`pc-recent${thread?.id === t.id ? " pc-recent--on" : ""}`}>
                  <button onClick={() => open(t)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                    <div className="pc-recent-q">{t.turns[0].q}</div>
                    <div className="pc-recent-sub">
                      {answers
                        ? `${qs} question${qs === 1 ? "" : "s"} · ${answers} saved answer${answers === 1 ? "" : "s"} · ${ago(t.at)}${cost > 0 ? ` · ${fmtCost(cost)}` : ""}`
                        : "tap to ask again"}
                    </div>
                  </button>
                  {answers > 0 && (
                    <button onClick={() => submit(t.turns[t.turns.length - 1].q, true)} className="pc-btn"
                      aria-label="Ask again in a new chat" title="Ask again in a new chat (runs the models, costs money)">
                      Re-ask
                    </button>
                  )}
                  <button onClick={() => removeThread(t.id)} aria-label="Remove conversation" className="pc-icon-btn" style={{ width: 26, height: 26 }}>
                    <Icon d={P.close} size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Change the panel. Everything about *which* models answer now lives
          behind one control instead of occupying the first screen — the page
          used to open on six configuration sections before the conversation. */}
      {panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose the panel"
          onClick={() => setPanelOpen(false)}
          className="pc pc-scrim"
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pc-modal"
            style={{ width: "100%", maxWidth: 640, maxHeight: "82vh", overflowY: "auto", padding: "18px 18px calc(22px + env(safe-area-inset-bottom, 0px))" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span className="pc-sheet-title">Choose the panel</span>
              <button onClick={() => setPanelOpen(false)} className="pc-btn">Done</button>
            </div>
            {/* Limits stated where they apply, rather than discovered by hitting them. */}
            <div className="pc-meta" style={{ color: "var(--pc-text-3)", marginBottom: 12, lineHeight: 1.45 }}>
              Up to four models at once, and twelve runs a minute. More models means a
              broader spread of views, a longer wait and a bigger bill.
            </div>

        {/* Model picker */}
        <div className="pc-meta" style={{ padding: "2px 0 9px" }}>Pick up to 4</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {ALL.map((m) => {
            const on = selected.includes(m.id);
            const premium = isPremiumRate(rates[m.id]);
            return (
              <button key={m.id} onClick={() => toggle(m.id)}
                title={m.id === AUTO_MODEL ? "OpenRouter picks the best model for each question" : `${m.id}${rateLabel(rates[m.id]) ? ` · ${rateLabel(rates[m.id])} out` : ""}`}
                style={{ padding: "7px 13px", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${on ? "transparent" : "var(--pc-line)"}`,
                  background: on ? m.color : "transparent", color: on ? "#fff" : "var(--pc-text)" }}>
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
                    border: `1px solid ${on ? "transparent" : "var(--pc-line)"}`,
                    background: on ? m.color : "transparent", color: on ? "#fff" : "var(--pc-text)" }}>
                  {m.label}
                  <span style={{ opacity: on ? 0.8 : 0.55 }}> · {rateLabel(m) || "free"}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="pc-meta" style={{ color: "var(--pc-text-3)", marginBottom: 12, lineHeight: 1.45 }}>
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
            style={{ width: "100%", background: "var(--pc-sand)", border: "none", borderRadius: 12, padding: "10px 14px", fontSize: 15, color: "var(--pc-text)" }}
          />
          {searching && <div className="pc-meta" style={{ color: "var(--pc-text-3)", marginTop: 6 }}>Searching…</div>}
          {searchErr && <div className="pc-meta" style={{ color: "var(--pc-accent)", marginTop: 6 }}>{searchErr}</div>}
          {found && found.length === 0 && !searching && (
            <div className="pc-meta" style={{ color: "var(--pc-text-3)", marginTop: 6 }}>No models match “{query.trim()}”.</div>
          )}
          {found && found.length > 0 && (
            <div className="pc-recents" style={{ margin: "8px 0 0", maxHeight: 260, overflowY: "auto" }}>
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
                      border: "none", borderBottom: i < found.length - 1 ? "1px solid var(--pc-line)" : "none", textAlign: "left", opacity: already || selected.length >= 4 ? 0.45 : 1 }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", color: "var(--pc-text)", fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.label}</span>
                      <span className="pc-meta" style={{ color: "var(--pc-text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{m.id}</span>
                    </span>
                    <span className="pc-meta" style={{ color: isPremiumRate(m) ? "var(--pc-accent)" : "var(--pc-text-3)", flexShrink: 0 }}>
                      {rateLabel(m) || "free"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {selected.length >= 4 && found && found.length > 0 && (
            <div className="pc-meta" style={{ color: "var(--pc-text-3)", marginTop: 6 }}>Panel is full — drop a model to add another.</div>
          )}
        </div>

        {/* Newest models, straight from OpenRouter's catalog */}
        {newest.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <button onClick={() => setShowNewest((v) => !v)} className="pc-meta"
              style={{ background: "none", border: "none", color: "var(--pc-accent)", fontWeight: 700, cursor: "pointer", padding: "2px 0" }}>
              {showNewest ? "▾" : "▸"} Newest models on OpenRouter ({newest.length})
            </button>
            {showNewest && (
              <>
                <div className="pc-meta" style={{ color: "var(--pc-text-3)", margin: "4px 0 8px", lineHeight: 1.45 }}>
                  Just-released models, listed live — anything at {`$${PREMIUM_PER_M}`}/M output or more asks you to accept the rate before it runs.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {newest.map((m) => {
                    const on = selected.includes(m.id);
                    const premium = isPremiumRate(m);
                    return (
                      <button key={m.id} onClick={() => toggle(m.id)} title={m.id}
                        style={{ padding: "7px 13px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                          border: `1px solid ${on ? "transparent" : premium ? "var(--pc-accent)" : "var(--pc-line)"}`,
                          background: on ? m.color : "transparent", color: on ? "#fff" : "var(--pc-text)" }}>
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


          </div>
        </div>
      )}

      {/* What the panel actually read out of a file. For a scanned form, "OCR ✓"
          asks you to trust numbers you cannot see; this shows them. */}
      {previewFile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Text read from ${previewFile.name}`}
          onClick={() => setPreviewFile(null)}
          className="pc pc-scrim"
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pc-modal"
            style={{ width: "100%", maxWidth: 640, maxHeight: "78vh", display: "flex", flexDirection: "column", padding: "18px 18px calc(18px + env(safe-area-inset-bottom, 0px))" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
              <span className="pc-sheet-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previewFile.name}</span>
              <button onClick={() => setPreviewFile(null)} className="pc-btn" style={{ flexShrink: 0 }}>Done</button>
            </div>
            <div className="pc-meta" style={{ color: "var(--pc-text-3)", marginBottom: 10 }}>
              {previewFile.ocrDone ? "Read by OCR" : "Read from the file"}
              {previewFile.text ? ` · ${previewFile.text.length.toLocaleString()} characters` : ""}
              {previewFile.truncated ? " · clipped to the beginning" : ""}
              {" — this is exactly what the models were given."}
            </div>
            <div style={{ flex: 1, overflowY: "auto", background: "var(--pc-sand)", borderRadius: 10, padding: "12px 13px" }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13, lineHeight: 1.5, color: "var(--pc-text)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {previewFile.text}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* "From Morris Hub" — documents the app already holds. */}
      {libraryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Attach a file from Morris Hub"
          onClick={() => setLibraryOpen(false)}
          className="pc pc-scrim"
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pc-modal"
            style={{ width: "100%", maxWidth: 520, maxHeight: "70vh", overflowY: "auto", padding: "18px 18px calc(22px + env(safe-area-inset-bottom, 0px))" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span className="pc-sheet-title">From Morris Hub</span>
              <button onClick={() => setLibraryOpen(false)} className="pc-btn">Done</button>
            </div>

            {libraryBusy && <div className="pc-body" style={{ color: "var(--pc-text-2)", padding: "12px 0" }}>Loading your files…</div>}

            {!libraryBusy && library?.length === 0 && (
              <div className="pc-note" style={{ color: "var(--pc-text-2)", lineHeight: 1.5, padding: "8px 0 4px" }}>
                No documents yet. The panel can read files you&rsquo;ve uploaded to a course under{" "}
                <strong style={{ color: "var(--pc-text)" }}>Me → Courses</strong> — that&rsquo;s the only place the app keeps
                your documents today. Anything else, attach from your device.
              </div>
            )}

            {!libraryBusy && library && library.length > 0 && (
              <div className="pc-recents" style={{ margin: 0 }}>
                {library.map((f) => {
                  const already = attachments.some((a) => a.id === f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => !already && attachFromLibrary(f.id)}
                      disabled={already || attachBusy}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", borderBottom: "0.5px solid var(--pc-line)", padding: "11px 2px", textAlign: "left", cursor: already ? "default" : "pointer", opacity: already ? 0.5 : 1 }}
                    >
                      <span aria-hidden>📄</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="pc-body" style={{ color: "var(--pc-text)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.title}
                        </span>
                        <span className="pc-meta" style={{ color: "var(--pc-text-3)" }}>
                          {f.group}{f.sizeKb ? ` · ${f.sizeKb}KB` : ""}
                        </span>
                      </span>
                      <span className="pc-meta" style={{ color: already ? "var(--pc-text-3)" : "var(--pc-accent)", fontWeight: 700, flexShrink: 0 }}>
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

      {notice && <div className="pc-note" style={{ color: "var(--pc-text-3)", marginTop: 10, textAlign: "center" }}>{notice}</div>}

    </div>
  );
}

function Sources({ items }: { items: Citation[] }) {
  let host = (u: string) => u;
  host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  return (
    <div style={{ marginTop: 15, paddingTop: 12, borderTop: "1px solid var(--pc-line)" }}>
      <div className="pc-meta" style={{ marginBottom: 6 }}>Sources</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.slice(0, 8).map((c, i) => (
          <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--pc-text-2)", fontSize: 13, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ color: "var(--pc-text-3)" }}>{i + 1}.</span> {c.title || host(c.url)}{" "}
            <span style={{ color: "var(--pc-text-3)" }}>· {host(c.url)}</span>
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
    <button onClick={() => onExport(content, fmt, title)} disabled={exporting != null} className="pc-btn pc-btn--quiet">
      {exporting === fmt ? "…" : label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginTop: 14, paddingTop: 11, borderTop: "1px solid var(--pc-line)" }}>
      <button onClick={copy} className={`pc-btn pc-btn--quiet${copied ? " pc-btn--accent" : ""}`}>
        {copied ? "Copied" : "Copy"}
      </button>
      {btn("docx", "Word")}
      {btn("pptx", "PowerPoint")}
      {btn("md", "Markdown")}
      {cost != null && <span className="pc-meta" style={{ marginLeft: "auto" }}>{fmtCost(cost)}</span>}
    </div>
  );
}
