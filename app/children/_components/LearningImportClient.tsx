"use client";

// Photograph what came home, read it, review what was read, keep it.
//
// Built for a phone at the kitchen table: the camera button opens the camera
// directly, several pages of one packet go in together, and the review shows
// exactly what will be saved and what will land on Today before anything is
// written.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Group, Cell, Chip, IconBadge, Icons } from "@/components/ios";
import type { DocumentExtraction } from "../_lib/learning";
import { saveChildDocument, findSimilarDocument, deleteChildDocument, type SimilarDocument } from "../_lib/learning-actions";

type Phase = "pick" | "reading" | "review" | "saving" | "batch";

/** SHA-256 of a file's bytes, hex. What makes "already read" independent of the file's name. */
async function fingerprint(file: File): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

type BatchStatus = "waiting" | "reading" | "kept" | "duplicate" | "failed";
interface BatchItem { file: File; url: string; status: BatchStatus; note: string; hash: string | null }

/**
 * Get a picked file into a shape that will actually arrive. Vercel drops any
 * body over 4.5MB before the handler runs, and iPhones shoot HEIC, which the
 * reader does not accept. Drawing through a canvas fixes both: always JPEG,
 * long edge capped at 1568px, which is what the vision model works at anyway.
 */
async function prepare(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 1568;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const KIND_LABEL: Record<string, string> = { newsletter: "Newsletter", graded_work: "Graded work", word_list: "Word list", other: "Document" };
const DATE_KIND_LABEL: Record<string, string> = { no_school: "No school", early_dismissal: "Early dismissal", field_trip: "Field trip", test: "Test", event: "Event", other: "" };
const FREQ_LABEL: Record<string, string> = { daily: "daily", three_a_week: "3× a week", weekly: "weekly", once: "once" };

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function LearningImportClient({ childId, childName }: { childId: string; childName: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("pick");
  const [pages, setPages] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [x, setX] = useState<DocumentExtraction | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [addDates, setAddDates] = useState(true);
  const [addTodos, setAddTodos] = useState(true);
  const [similar, setSimilar] = useState<SimilarDocument | null>(null);
  const [replace, setReplace] = useState(true);
  const [hashes, setHashes] = useState<string[]>([]);
  const [many, setMany] = useState(false);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const batchRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next: { file: File; url: string }[] = [];
    const nextHashes: string[] = [];
    for (const f of Array.from(list).slice(0, 3 - pages.length)) {
      const p = await prepare(f);
      next.push({ file: p, url: p.type === "application/pdf" ? "" : URL.createObjectURL(p) });
      const h = await fingerprint(p);
      if (h) nextHashes.push(h);
    }
    setPages((prev) => [...prev, ...next]);
    setHashes((prev) => [...prev, ...nextHashes]);
  }

  // ── Several documents, one at a time ──────────────────────────────────────
  // A folder of scans — from Photos, Files, or Google Drive through the Files
  // picker — each file its own document, read and kept in turn with the
  // defaults (every recommended exercise, dates to reminders, practice to
  // to-dos). A file already read is recognised by its bytes and skipped, so a
  // folder can be run again any time without a second copy of anything.
  async function addBatch(list: FileList | null) {
    if (!list) return;
    setError(null);
    const items: BatchItem[] = [];
    for (const f of Array.from(list).slice(0, 40)) {
      const p = await prepare(f);
      items.push({ file: p, url: p.type === "application/pdf" ? "" : URL.createObjectURL(p), status: "waiting", note: "", hash: await fingerprint(p) });
    }
    setBatch((prev) => [...prev, ...items]);
    setPhase("batch");
  }
  function setItem(i: number, patch: Partial<BatchItem>) {
    setBatch((prev) => prev.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  }
  async function runBatch() {
    setBatchRunning(true);
    for (let i = 0; i < batch.length; i++) {
      const it = batch[i];
      if (it.status !== "waiting" && it.status !== "failed") continue;
      setItem(i, { status: "reading", note: "Reading…" });
      try {
        const body = new FormData();
        body.append("childId", childId);
        body.append("files", it.file);
        const res = await fetch("/api/children/documents/extract", { method: "POST", body });
        const raw = await res.text();
        let data: { extraction?: DocumentExtraction; error?: string } | null = null;
        try { data = JSON.parse(raw); } catch { data = null; }
        if (!res.ok || !data?.extraction) throw new Error(data?.error ?? (res.status === 504 ? "Timed out" : `Reader error ${res.status}`));
        const ex = data.extraction;
        const sim = await findSimilarDocument(childId, ex, it.hash ? [it.hash] : []);
        if (sim.match) { setItem(i, { status: "duplicate", note: `Already kept: ${sim.match.title}` }); continue; }
        const r = await saveChildDocument({ childId, extraction: ex, exerciseIndexes: ex.exercises.map((_, k) => k), addDateReminders: true, addPracticeTodos: true, pageHashes: it.hash ? [it.hash] : [] });
        if (r.error || !r.documentId) throw new Error(r.error ?? "Could not save");
        const fd = new FormData();
        fd.append("childId", childId); fd.append("documentId", r.documentId); fd.append("files", it.file);
        await fetch("/api/children/documents/upload", { method: "POST", body: fd }).catch(() => {});
        setItem(i, { status: "kept", note: `${ex.title}${r.todos ? ` · ${r.todos} to-dos` : ""}${r.reminders ? ` · ${r.reminders} reminders` : ""}` });
      } catch (e) {
        setItem(i, { status: "failed", note: (e as Error).message });
      }
    }
    setBatchRunning(false);
  }

  function removePage(i: number) {
    setPages((prev) => prev.filter((_, k) => k !== i));
  }

  async function read() {
    if (pages.length === 0) return;
    setPhase("reading");
    setError(null);
    try {
      const body = new FormData();
      body.append("childId", childId);
      for (const p of pages) body.append("files", p.file);
      const res = await fetch("/api/children/documents/extract", { method: "POST", body });
      // A reply that is not JSON is the platform talking, not the reader: a
      // timeout page, a gateway error. Say so in words instead of failing on
      // "Unexpected token".
      const raw = await res.text();
      let data: { extraction?: DocumentExtraction; error?: string } | null = null;
      try { data = JSON.parse(raw); } catch { data = null; }
      if (!res.ok || !data) {
        if (res.status === 504 || /timed out|timeout/i.test(raw)) throw new Error("Reading took too long. Send fewer pages at once — one graded paper, or a newsletter's three pages.");
        if (res.status === 413) throw new Error("Those pages are too large to send together. Try fewer at once.");
        throw new Error(data?.error ?? `The reader did not answer (${res.status}). Try again in a moment.`);
      }
      if (!data.extraction) throw new Error(data.error ?? "The reader returned nothing.");
      const ex = data.extraction;
      setX(ex);
      setChosen(new Set(ex.exercises.map((_, i) => i)));
      setPhase("review");
      // Same document already kept? Ask before making a second copy.
      findSimilarDocument(childId, ex, hashes).then((r) => { if (r.match) { setSimilar(r.match); setReplace(true); } }).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
      setPhase("pick");
    }
  }

  async function save() {
    if (!x) return;
    setPhase("saving");
    setError(null);
    let r: Awaited<ReturnType<typeof saveChildDocument>>;
    try {
      if (similar && replace) {
        const d = await deleteChildDocument(childId, similar.id);
        if (d.error) throw new Error(d.error);
      }
      r = await saveChildDocument({
        childId,
        extraction: x,
        exerciseIndexes: [...chosen],
        addDateReminders: addDates,
        addPracticeTodos: addTodos,
        pageHashes: hashes,
      });
    } catch (e) {
      setError((e as Error).message || "Could not save.");
      setPhase("review");
      return;
    }
    if (r.error || !r.documentId) {
      setError(r.error ?? "Could not save.");
      setPhase("review");
      return;
    }
    // The pages themselves, after the read is safe — through a route
    // handler, since a server action's body is capped at 1 MB and photos are
    // bigger than that. A storage hiccup here costs the scan, not the plan,
    // and never keeps the screen on "Saving…": the document is already kept.
    let pagesNote = "";
    try {
      const fd = new FormData();
      fd.append("childId", childId);
      fd.append("documentId", r.documentId);
      for (const p of pages) fd.append("files", p.file);
      const res = await fetch("/api/children/documents/upload", { method: "POST", body: fd });
      if (!res.ok) pagesNote = "&pages=0";
    } catch {
      pagesNote = "&pages=0";
    }
    router.push(`/children/${childId}?saved=1&reminders=${r.reminders ?? 0}&todos=${r.todos ?? 0}${pagesNote}`);
  }

  // ── Batch ─────────────────────────────────────────────────────────────────
  if (phase === "batch") {
    const counts = { kept: batch.filter((b) => b.status === "kept").length, dup: batch.filter((b) => b.status === "duplicate").length, failed: batch.filter((b) => b.status === "failed").length, waiting: batch.filter((b) => b.status === "waiting").length };
    const STATUS_COLOR: Record<BatchStatus, string> = { waiting: "var(--ios-label-3)", reading: "var(--ios-tint)", kept: "var(--ios-green)", duplicate: "var(--ios-orange)", failed: "var(--ios-red)" };
    const STATUS_LABEL: Record<BatchStatus, string> = { waiting: "Waiting", reading: "Reading…", kept: "Kept", duplicate: "Skipped", failed: "Failed" };
    return (
      <>
        <input ref={batchRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addBatch(e.target.files); e.target.value = ""; }} />
        <Group header={`${batch.length} document${batch.length === 1 ? "" : "s"}`} footer="Each file is read as its own document and kept with the defaults. A file that was read before is recognised by its contents and skipped, however it is named.">
          {batch.map((b, i) => (
            <Cell
              key={i}
              chevron={false}
              // eslint-disable-next-line @next/next/no-img-element -- local preview
              lead={b.url ? <img src={b.url} alt="" style={{ width: 40, height: 52, objectFit: "cover", borderRadius: 6, border: "1px solid var(--ios-separator)" }} /> : <IconBadge color="#8E8E93"><Icons.BookIcon /></IconBadge>}
              title={b.note || b.file.name}
              subtitle={b.note ? b.file.name : `${(b.file.size / 1024).toFixed(0)} KB`}
              trailing={<span className="ios-caption" style={{ color: STATUS_COLOR[b.status], fontWeight: 700 }}>{STATUS_LABEL[b.status]}</span>}
            />
          ))}
          <Cell chevron={false} onClick={() => !batchRunning && batchRef.current?.click()} lead={<IconBadge color="#8E8E93"><Icons.BookIcon /></IconBadge>} title="Add more files" subtitle="Photos, Files, or Google Drive through Files" />
        </Group>
        {error && <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: "8px var(--ios-gutter)" }}>{error}</p>}
        <div style={{ margin: "12px var(--ios-gutter) 0", display: "grid", gap: 10 }}>
          <button type="button" className="ios-btn ios-btn--primary" disabled={batchRunning || counts.waiting + counts.failed === 0} onClick={runBatch} style={{ opacity: batchRunning || counts.waiting + counts.failed === 0 ? 0.5 : 1 }}>
            {batchRunning ? `Processing… ${counts.kept + counts.dup + counts.failed} of ${batch.length}` : counts.failed > 0 && counts.waiting === 0 ? `Retry ${counts.failed} failed` : `Process ${counts.waiting} one at a time`}
          </button>
          {!batchRunning && counts.kept + counts.dup > 0 && (
            <button type="button" className="ios-btn" onClick={() => router.push(`/children/${childId}?saved=1`)}>Done — {counts.kept} kept{counts.dup ? `, ${counts.dup} already there` : ""}{counts.failed ? `, ${counts.failed} failed` : ""}</button>
          )}
          <button type="button" className="ios-btn" disabled={batchRunning} onClick={() => { setBatch([]); setPhase("pick"); }} style={{ opacity: batchRunning ? 0.5 : 1 }}>Back</button>
        </div>
      </>
    );
  }

  // ── Pick ──────────────────────────────────────────────────────────────────
  if (phase === "pick" || phase === "reading") {
    return (
      <>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={pickerRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={batchRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addBatch(e.target.files); e.target.value = ""; }} />

        <div style={{ margin: "0 var(--ios-gutter) 8px", display: "flex", gap: 8 }}>
          <Chip small selected={!many} onClick={() => setMany(false)}>One document</Chip>
          <Chip small selected={many} onClick={() => setMany(true)}>A folder of documents</Chip>
        </div>
        {many && (
          <Group header="Several documents, one at a time" footer="Pick as many files as you like — from Photos, from Files, or from a Google Drive folder through the Files picker. Each file is read as its own document. Files already read are recognised by their contents and skipped, so there are never two copies.">
            <Cell chevron={false} onClick={() => batchRef.current?.click()} lead={<IconBadge color="var(--ios-tint)"><Icons.BookIcon /></IconBadge>} title="Choose the files" subtitle="Then process them one at a time" />
          </Group>
        )}

        {!many && <Group header="Pages" footer="Up to three pages per read. A newsletter's front, its spelling sheet and the word list go in together. A graded paper goes in on its own.">
          {pages.map((p, i) => (
            <Cell
              key={i}
              chevron={false}
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL preview; next/image cannot optimise it
              lead={p.url ? <img src={p.url} alt="" style={{ width: 44, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid var(--ios-separator)" }} /> : <IconBadge color="#8E8E93"><Icons.BookIcon /></IconBadge>}
              title={`Page ${i + 1}`}
              subtitle={`${(p.file.size / 1024).toFixed(0)} KB`}
              trailing={<button type="button" className="ios-btn--plain" onClick={() => removePage(i)} style={{ color: "var(--ios-red)" }}>Remove</button>}
            />
          ))}
          <Cell chevron={false} onClick={() => cameraRef.current?.click()} lead={<IconBadge color="var(--ios-tint)"><Icons.ComposeIcon /></IconBadge>} title="Take a photo" subtitle="Opens the camera" />
          <Cell chevron={false} onClick={() => pickerRef.current?.click()} lead={<IconBadge color="#8E8E93"><Icons.BookIcon /></IconBadge>} title="Choose from photos or a PDF" subtitle="Several at once is fine" />
        </Group>}

        {error && <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: "8px var(--ios-gutter)" }}>{error}</p>}

        {!many && <div style={{ margin: "12px var(--ios-gutter) 0" }}>
          <button type="button" className="ios-btn ios-btn--primary" disabled={pages.length === 0 || phase === "reading"} onClick={read} style={{ width: "100%", opacity: pages.length === 0 || phase === "reading" ? 0.5 : 1 }}>
            {phase === "reading" ? "Reading the pages…" : pages.length > 1 ? `Read these ${pages.length} pages` : "Read it"}
          </button>
          <p className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, lineHeight: 1.5 }}>
            Dates, spelling words, scores and the teacher&rsquo;s notes are read off the page. You review everything before it is kept, and nothing reaches Today until you say so.
          </p>
        </div>}
      </>
    );
  }

  // ── Review ────────────────────────────────────────────────────────────────
  if (!x) return null;
  const busy = phase === "saving";
  return (
    <>
      <Group header={KIND_LABEL[x.kind] ?? "Document"} footer={x.summary || undefined}>
        <Cell chevron={false} title={x.title} subtitle={x.doc_date ? fmtDate(x.doc_date) : undefined} />
      </Group>

      {similar && (
        <Group header="Already kept?" footer={replace ? `Replacing removes the earlier copy and everything it created${similar.exercises || similar.todos || similar.reminders ? ` (${[similar.exercises ? `${similar.exercises} exercises` : null, similar.todos ? `${similar.todos} to-dos` : null, similar.reminders ? `${similar.reminders} reminders` : null].filter(Boolean).join(", ")})` : ""}, then keeps this read. Nothing doubles.` : "Both copies will be kept. Their to-dos and reminders will not be doubled, but exercises will."}>
          <Cell chevron={false} lead={<IconBadge color="var(--ios-orange)"><Icons.BookIcon /></IconBadge>} title={similar.title} subtitle={`Kept ${fmtDate(similar.createdAt.slice(0, 10))}${similar.reason ? ` · ${similar.reason}` : ""}`} />
          <div style={{ display: "flex", gap: 8, padding: "10px 16px 12px" }}>
            <Chip small selected={replace} onClick={() => setReplace(true)}>Replace it</Chip>
            <Chip small selected={!replace} onClick={() => setReplace(false)}>Keep both</Chip>
          </div>
        </Group>
      )}

      {x.dates.length > 0 && (
        <Group header="Dates" footer={addDates ? `These become household reminders on Today for both of you. No-school days also warn the evening before.` : "Not added to reminders."}>
          {x.dates.map((d, i) => (
            <Cell key={i} chevron={false} lead={<IconBadge color={d.kind === "no_school" || d.kind === "early_dismissal" ? "var(--ios-orange)" : "var(--ios-tint)"}><Icons.CalendarIcon /></IconBadge>} title={d.title} subtitle={`${fmtDate(d.date)}${DATE_KIND_LABEL[d.kind] ? ` · ${DATE_KIND_LABEL[d.kind]}` : ""}${d.note ? ` · ${d.note}` : ""}`} />
          ))}
          <Cell chevron={false} title="Add to reminders" trailing={<Chip small selected={addDates} onClick={() => setAddDates((v) => !v)}>{addDates ? "Yes" : "No"}</Chip>} />
        </Group>
      )}

      {x.spelling && (x.spelling.words.length > 0 || x.spelling.sight_words.length > 0) && (
        <Group header="Spelling this week" footer={x.spelling.test_on ? `Test ${fmtDate(x.spelling.test_on)}.` : undefined}>
          {x.spelling.pattern && <Cell chevron={false} title={x.spelling.pattern} subtitle={x.spelling.week_start ? `Week of ${fmtDate(x.spelling.week_start)}` : undefined} />}
          <div style={{ padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {x.spelling.words.map((w) => <Chip key={w} small>{w}</Chip>)}
            {x.spelling.sight_words.map((w) => <Chip key={`s-${w}`} small selected>{w}</Chip>)}
          </div>
        </Group>
      )}

      {x.assessments.map((a, i) => (
        <Group key={i} header={a.title} footer={a.teacher_feedback ? `Teacher: “${a.teacher_feedback}”` : undefined}>
          <Cell chevron={false} title={a.score != null && a.out_of != null ? `${a.score} / ${a.out_of}` : "No score printed"} subtitle={`${a.subject}${a.assessed_on ? ` · ${fmtDate(a.assessed_on)}` : ""}`} />
          {a.observations.map((o, k) => <Cell key={k} chevron={false} lead={<IconBadge color="#8E8E93"><Icons.SparkleIcon /></IconBadge>} title={o} />)}
          {a.items.filter((it) => it.correct === false).map((it, k) => (
            <Cell key={`w-${k}`} chevron={false} title={it.prompt} subtitle={it.written ? `wrote “${it.written}”` : undefined} trailing={<span className="ios-caption" style={{ color: "var(--ios-red)" }}>missed</span>} />
          ))}
        </Group>
      ))}

      {(x.academics.length > 0 || x.read_aloud || x.memory_verse || x.recitation || x.parent_requests.length > 0) && (
        <Group header="This week at school">
          {x.academics.map((a, i) => <Cell key={i} chevron={false} title={a.subject} subtitle={a.topics.join(" · ")} />)}
          {x.read_aloud && <Cell chevron={false} title="Read aloud" subtitle={x.read_aloud} />}
          {x.memory_verse && <Cell chevron={false} title="Memory verse" subtitle={x.memory_verse} />}
          {x.recitation && <Cell chevron={false} title="Recitation" subtitle={x.recitation} />}
          {x.parent_requests.map((r, i) => <Cell key={`p-${i}`} chevron={false} lead={<IconBadge color="var(--ios-orange)"><Icons.BellIcon /></IconBadge>} title={r} />)}
        </Group>
      )}

      {x.exercises.length > 0 && (
        <Group header="Practice to adopt" footer={addTodos ? "Each adopted exercise becomes a household to-do for the coming days, so it shows on Today." : "Kept in the workspace only."}>
          {x.exercises.map((e, i) => {
            const on = chosen.has(i);
            return (
              <Cell
                key={i}
                chevron={false}
                onClick={() => setChosen((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                lead={<span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${on ? "var(--ios-tint)" : "var(--ios-separator)"}`, background: on ? "var(--ios-tint)" : "transparent", flexShrink: 0 }} />}
                title={e.title}
                subtitle={<><span>{e.rationale}</span><span style={{ display: "block", color: "var(--ios-label-3)" }}>{e.minutes ? `${e.minutes} min · ` : ""}{FREQ_LABEL[e.frequency]}</span></>}
              />
            );
          })}
          <Cell chevron={false} title="Add practice to Today" trailing={<Chip small selected={addTodos} onClick={() => setAddTodos((v) => !v)}>{addTodos ? "Yes" : "No"}</Chip>} />
        </Group>
      )}

      {error && <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: "8px var(--ios-gutter)" }}>{error}</p>}

      <div style={{ margin: "12px var(--ios-gutter) 0", display: "flex", gap: 10 }}>
        <button type="button" className="ios-btn" disabled={busy} onClick={() => setPhase("pick")} style={{ flex: 1 }}>Back</button>
        <button type="button" className="ios-btn ios-btn--primary" disabled={busy} onClick={save} style={{ flex: 2, opacity: busy ? 0.6 : 1 }}>
          {busy ? "Saving…" : `Keep for ${childName}`}
        </button>
      </div>
    </>
  );
}
