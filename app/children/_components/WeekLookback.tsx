"use client";

import { Group, Cell, IconBadge, Icons, Chip } from "@/components/ios";
import type { ChildDocument, SpellingWeek, Assessment, Exercise } from "../_lib/learning";

// A week that has already happened, read back.
//
// Everything the school sent for that week, and everything the workspace made
// from it, in one place — with the page it came from a tap away. The checklist
// and the sending controls belong to the current week and are not here: this
// is for "what was the verse two weeks ago", not for doing anything about it.

const KIND_LABEL: Record<string, string> = { newsletter: "Newsletter", graded_work: "Graded work", word_list: "Word list", other: "Document" };

export function fmtDate(iso: string, weekday = false): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", weekday ? { weekday: "short", month: "short", day: "numeric" } : { month: "short", day: "numeric" });
}

/** "Newsletter · Oct 2 · 3 pages" — the thing a figure came from, as a button that opens it. */
export function SourceChip({ doc, onOpen, page }: { doc: ChildDocument | null | undefined; onOpen: (doc: ChildDocument, page?: number) => void; page?: number }) {
  if (!doc) return null;
  const pages = doc.filePaths.length;
  const when = doc.docDate ? fmtDate(doc.docDate) : fmtDate(doc.createdAt.slice(0, 10));
  return (
    <button
      type="button"
      onClick={() => onOpen(doc, page)}
      title={doc.title}
      className="ios-caption"
      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--ios-fill)", color: "var(--ios-tint)", border: "none", borderRadius: 999, padding: "3px 9px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
    >
      <span aria-hidden>📄</span>
      {KIND_LABEL[doc.kind] ?? "Document"} · {when}{pages > 0 ? ` · ${pages} page${pages === 1 ? "" : "s"}` : " · no scan"}
    </button>
  );
}

export default function WeekLookback({ weekStart, weekEnd, spelling, newsletter, docs, assessments, exercises, docById, onOpen }: {
  weekStart: string;
  weekEnd: string;
  spelling: SpellingWeek | null;
  newsletter: ChildDocument | null;
  docs: ChildDocument[];
  assessments: Assessment[];
  exercises: Exercise[];
  docById: Map<string, ChildDocument>;
  onOpen: (doc: ChildDocument, page?: number) => void;
}) {
  const nx = newsletter?.extracted;
  const empty = !spelling && !newsletter && docs.length === 0 && assessments.length === 0 && exercises.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ margin: "14px var(--ios-gutter) 0" }} className="ios-list">
        <div style={{ padding: "12px 16px" }}>
          <div className="ios-headline">Week of {fmtDate(weekStart)} – {fmtDate(weekEnd)}</div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
            {empty ? "Nothing on file for this week." : `${docs.length} document${docs.length === 1 ? "" : "s"} · ${assessments.length} graded paper${assessments.length === 1 ? "" : "s"} · ${exercises.length} exercise${exercises.length === 1 ? "" : "s"} set`}
          </div>
        </div>
      </div>

      {spelling && (
        <Group header="Spelling" footer={<SourceChip doc={docById.get(spelling.documentId ?? "") ?? null} onOpen={onOpen} />}>
          {spelling.pattern && <Cell chevron={false} title={spelling.pattern} subtitle={spelling.testOn ? `Test ${fmtDate(spelling.testOn, true)}` : undefined} />}
          <div style={{ padding: "10px 16px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {spelling.words.map((w) => <Chip key={w} small selected={(spelling.practiced[w] ?? 0) > 0}>{w}{(spelling.practiced[w] ?? 0) > 1 ? ` ×${spelling.practiced[w]}` : ""}</Chip>)}
            {spelling.sightWords.map((w) => <Chip key={`s-${w}`} small selected>{w}</Chip>)}
          </div>
        </Group>
      )}

      {nx && (nx.memory_verse || nx.recitation || nx.read_aloud) && (
        <Group header="Scripture and memory" footer={<SourceChip doc={newsletter} onOpen={onOpen} />}>
          {nx.memory_verse && <Cell chevron={false} lead={<span style={{ fontSize: 22, width: 30, textAlign: "center" }}>📖</span>} title="Memory verse" subtitle={<span style={{ whiteSpace: "pre-wrap" }}>{nx.memory_verse}</span>} />}
          {nx.recitation && <Cell chevron={false} lead={<span style={{ fontSize: 22, width: 30, textAlign: "center" }}>🗣️</span>} title="Recitation" subtitle={nx.recitation} />}
          {nx.read_aloud && <Cell chevron={false} lead={<span style={{ fontSize: 22, width: 30, textAlign: "center" }}>📚</span>} title="Read aloud" subtitle={nx.read_aloud} />}
        </Group>
      )}

      {nx && (nx.academics?.length ?? 0) > 0 && (
        <Group header="At school" footer={<SourceChip doc={newsletter} onOpen={onOpen} />}>
          {(nx.academics ?? []).map((a, i) => <Cell key={i} chevron={false} title={a.subject} subtitle={a.topics.join(" · ")} />)}
          {(nx.parent_requests ?? []).map((r, i) => <Cell key={`p-${i}`} chevron={false} lead={<IconBadge color="var(--ios-orange)"><Icons.BellIcon /></IconBadge>} title={r} />)}
        </Group>
      )}

      {assessments.length > 0 && (
        <Group header="Graded work">
          {assessments.map((a) => (
            <Cell key={a.id} chevron={false}
              lead={<IconBadge color="var(--ios-green)"><Icons.ChartIcon /></IconBadge>}
              title={a.title}
              subtitle={<>
                {a.subject}{a.score != null && a.outOf ? ` · ${a.score}/${a.outOf}` : ""}{a.assessedOn ? ` · ${fmtDate(a.assessedOn)}` : ""}
                {a.teacherFeedback ? <span style={{ display: "block" }}>“{a.teacherFeedback}”</span> : null}
                <span style={{ display: "block", marginTop: 4 }}><SourceChip doc={docById.get(a.documentId ?? "") ?? null} onOpen={onOpen} /></span>
              </>}
            />
          ))}
        </Group>
      )}

      {exercises.length > 0 && (
        <Group header="Practice set from this week's papers">
          {exercises.map((ex) => (
            <Cell key={ex.id} chevron={false}
              lead={<IconBadge color={ex.status === "done" ? "var(--ios-green)" : "var(--ios-orange)"}><Icons.SparkleIcon /></IconBadge>}
              title={ex.title}
              subtitle={<>{ex.rationale}<span style={{ display: "block", marginTop: 4 }}><SourceChip doc={docById.get(ex.documentId ?? "") ?? null} onOpen={onOpen} /></span></>}
            />
          ))}
        </Group>
      )}

      {docs.length > 0 && (
        <Group header="Everything scanned that week">
          {docs.map((d) => (
            <Cell key={d.id} onClick={() => onOpen(d)} chevron
              lead={<IconBadge color={d.kind === "newsletter" ? "var(--ios-tint)" : d.kind === "graded_work" ? "var(--ios-green)" : "#8E8E93"}><Icons.BookIcon /></IconBadge>}
              title={d.title}
              subtitle={`${KIND_LABEL[d.kind] ?? "Document"} · ${d.docDate ? fmtDate(d.docDate) : `added ${fmtDate(d.createdAt.slice(0, 10))}`}${d.filePaths.length ? ` · ${d.filePaths.length} page${d.filePaths.length === 1 ? "" : "s"}` : " · no scan kept"}`} />
          ))}
        </Group>
      )}
    </div>
  );
}
