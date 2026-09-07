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
import { saveChildDocument } from "../_lib/learning-actions";

type Phase = "pick" | "reading" | "review" | "saving";

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
  const cameraRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next: { file: File; url: string }[] = [];
    for (const f of Array.from(list).slice(0, 5 - pages.length)) {
      const p = await prepare(f);
      next.push({ file: p, url: p.type === "application/pdf" ? "" : URL.createObjectURL(p) });
    }
    setPages((prev) => [...prev, ...next]);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read those pages.");
      const ex = data.extraction as DocumentExtraction;
      setX(ex);
      setChosen(new Set(ex.exercises.map((_, i) => i)));
      setPhase("review");
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
      r = await saveChildDocument({
        childId,
        extraction: x,
        exerciseIndexes: [...chosen],
        addDateReminders: addDates,
        addPracticeTodos: addTodos,
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

  // ── Pick ──────────────────────────────────────────────────────────────────
  if (phase === "pick" || phase === "reading") {
    return (
      <>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={pickerRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

        <Group header="Pages" footer="A newsletter's front, its spelling sheet and the word list go in together as one document. A graded test goes in on its own.">
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
        </Group>

        {error && <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: "8px var(--ios-gutter)" }}>{error}</p>}

        <div style={{ margin: "12px var(--ios-gutter) 0" }}>
          <button type="button" className="ios-btn ios-btn--primary" disabled={pages.length === 0 || phase === "reading"} onClick={read} style={{ width: "100%", opacity: pages.length === 0 || phase === "reading" ? 0.5 : 1 }}>
            {phase === "reading" ? "Reading the pages…" : pages.length > 1 ? `Read these ${pages.length} pages` : "Read it"}
          </button>
          <p className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 8, lineHeight: 1.5 }}>
            Dates, spelling words, scores and the teacher&rsquo;s notes are read off the page. You review everything before it is kept, and nothing reaches Today until you say so.
          </p>
        </div>
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
