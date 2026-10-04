"use client";

import { Cell, IconBadge, Icons, Chip } from "@/components/ios";
import { Fold } from "./Fold";
import type { ChildDocument, SpellingWeek, Assessment, Exercise } from "../_lib/learning";

// A week that has already happened, read back.
//
// Everything the school sent for that week, and everything the workspace made
// from it, with the page it came from a tap away. The checklist and the
// sending controls belong to the current week and are not here: this is for
// "what was the verse two weeks ago", not for doing anything about it.
//
// It opens on a header that says where you are and how to move: the week
// before, the week after, or straight back to now. Every section under it is
// a fold, shut until asked, with one line saying what is inside — a week read
// back is a lookup, and six open lists made it a scroll.

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

function Source({ doc, onOpen }: { doc: ChildDocument | null | undefined; onOpen: (doc: ChildDocument, page?: number) => void }) {
  if (!doc) return null;
  return <p className="ios-group-footer" style={{ margin: 0, paddingTop: 8 }}><SourceChip doc={doc} onOpen={onOpen} /></p>;
}

const navBtn = (on: boolean): React.CSSProperties => ({
  background: on ? "var(--ios-fill)" : "transparent", border: "none", borderRadius: 999, padding: "8px 12px",
  color: on ? "var(--ios-tint)" : "var(--ios-label-3)", fontWeight: 700, fontSize: 14, cursor: on ? "pointer" : "default", whiteSpace: "nowrap",
});

export default function WeekLookback({ childId, weekStart, weekEnd, spelling, newsletter, docs, assessments, exercises, docById, onOpen, onOlder, onNewer, onCurrent }: {
  childId: string;
  weekStart: string;
  weekEnd: string;
  spelling: SpellingWeek | null;
  newsletter: ChildDocument | null;
  docs: ChildDocument[];
  assessments: Assessment[];
  exercises: Exercise[];
  docById: Map<string, ChildDocument>;
  onOpen: (doc: ChildDocument, page?: number) => void;
  /** Null when there is no week on file in that direction. */
  onOlder: (() => void) | null;
  onNewer: (() => void) | null;
  onCurrent: () => void;
}) {
  const nx = newsletter?.extracted;
  const empty = !spelling && !newsletter && docs.length === 0 && assessments.length === 0 && exercises.length === 0;
  const wrong = assessments.reduce((n, a) => n + a.items.filter((i) => i.correct === false).length, 0);
  const key = (s: string) => `ch-lb-${s}-${childId}`;
  const list: React.CSSProperties = { margin: "0 var(--ios-gutter)" };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* ── Where you are, and how to move ─────────────────────────────── */}
      <div className="ios-list" style={{ margin: "14px var(--ios-gutter) 0", padding: "10px 8px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <button type="button" onClick={onOlder ?? undefined} disabled={!onOlder} aria-label="Older week" style={navBtn(!!onOlder)}>‹ Older</button>
          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div className="ios-headline" style={{ whiteSpace: "nowrap" }}>Week of {fmtDate(weekStart)}</div>
            <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{fmtDate(weekStart)} – {fmtDate(weekEnd)} · looking back</div>
          </div>
          <button type="button" onClick={onNewer ?? undefined} disabled={!onNewer} aria-label="Newer week" style={navBtn(!!onNewer)}>Newer ›</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <button type="button" onClick={onCurrent} className="ios-btn--plain" style={{ color: "var(--ios-tint)", fontWeight: 700, fontSize: 14 }}>↩ Back to this week</button>
        </div>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textAlign: "center", marginTop: 6 }}>
          {empty ? "Nothing on file for this week." : [docs.length ? `${docs.length} document${docs.length === 1 ? "" : "s"}` : null, assessments.length ? `${assessments.length} paper${assessments.length === 1 ? "" : "s"}${wrong ? ` · ${wrong} to go over` : ""}` : null, spelling ? `${spelling.words.length + spelling.sightWords.length} words` : null].filter(Boolean).join(" · ")}
        </div>
      </div>

      {spelling && (
        <Fold storageKey={key("spelling")} title="Spelling" count={spelling.words.length + spelling.sightWords.length} summary={`${spelling.pattern ?? "Word list"}${spelling.testOn ? ` · test ${fmtDate(spelling.testOn)}` : ""}.`}>
          <div className="ios-list" style={list}>
            {spelling.pattern && <Cell chevron={false} title={spelling.pattern} subtitle={spelling.testOn ? `Test ${fmtDate(spelling.testOn, true)}` : undefined} />}
            <div style={{ padding: "10px 16px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {spelling.words.map((w) => <Chip key={w} small selected={(spelling.practiced[w] ?? 0) > 0}>{w}{(spelling.practiced[w] ?? 0) > 1 ? ` ×${spelling.practiced[w]}` : ""}</Chip>)}
              {spelling.sightWords.map((w) => <Chip key={`s-${w}`} small selected>{w}</Chip>)}
            </div>
          </div>
          <Source doc={docById.get(spelling.documentId ?? "") ?? null} onOpen={onOpen} />
        </Fold>
      )}

      {nx && (nx.memory_verse || nx.recitation || nx.read_aloud) && (
        <Fold storageKey={key("scripture")} title="Scripture and memory" count={[nx.memory_verse, nx.recitation, nx.read_aloud].filter(Boolean).length} summary={[nx.memory_verse ? "Memory verse" : null, nx.recitation ? "Recitation" : null, nx.read_aloud ? `Read aloud: ${nx.read_aloud}` : null].filter(Boolean).join(" · ")}>
          <div className="ios-list" style={list}>
            {nx.memory_verse && <Cell chevron={false} lead={<span style={{ fontSize: 22, width: 30, textAlign: "center" }}>📖</span>} title="Memory verse" subtitle={<span style={{ whiteSpace: "pre-wrap" }}>{nx.memory_verse}</span>} />}
            {nx.recitation && <Cell chevron={false} lead={<span style={{ fontSize: 22, width: 30, textAlign: "center" }}>🗣️</span>} title="Recitation" subtitle={nx.recitation} />}
            {nx.read_aloud && <Cell chevron={false} lead={<span style={{ fontSize: 22, width: 30, textAlign: "center" }}>📚</span>} title="Read aloud" subtitle={nx.read_aloud} />}
          </div>
          <Source doc={newsletter} onOpen={onOpen} />
        </Fold>
      )}

      {nx && ((nx.academics?.length ?? 0) > 0 || (nx.parent_requests?.length ?? 0) > 0) && (
        <Fold storageKey={key("school")} title="At school" count={nx.academics?.length ?? 0} summary={(nx.academics ?? []).map((a) => a.subject).join(", ") + "."}>
          <div className="ios-list" style={list}>
            {(nx.academics ?? []).map((a, i) => <Cell key={i} chevron={false} title={a.subject} subtitle={a.topics.join(" · ")} />)}
            {(nx.parent_requests ?? []).map((r, i) => <Cell key={`p-${i}`} chevron={false} lead={<IconBadge color="var(--ios-orange)"><Icons.BellIcon /></IconBadge>} title={r} />)}
          </div>
          <Source doc={newsletter} onOpen={onOpen} />
        </Fold>
      )}

      {assessments.length > 0 && (
        <Fold storageKey={key("papers")} title="Graded work" count={assessments.length} summary={assessments.map((a) => `${a.title}${a.score != null && a.outOf ? ` ${a.score}/${a.outOf}` : ""}`).join(" · ")}>
          <div className="ios-list" style={list}>
            {assessments.map((a) => {
              const w = a.items.filter((i) => i.correct === false);
              return (
                <Cell key={a.id} chevron={false}
                  lead={<IconBadge color="var(--ios-green)"><Icons.ChartIcon /></IconBadge>}
                  title={a.title}
                  subtitle={<>
                    {a.subject}{a.score != null && a.outOf ? ` · ${a.score}/${a.outOf}` : ""}{a.assessedOn ? ` · ${fmtDate(a.assessedOn)}` : ""}{w.length ? ` · ${w.length} to go over` : ""}
                    {a.teacherFeedback ? <span style={{ display: "block" }}>“{a.teacherFeedback}”</span> : null}
                    {w.length > 0 && <span style={{ display: "block", color: "var(--ios-red)" }}>{w.map((i) => i.prompt).join(", ")}</span>}
                    <span style={{ display: "block", marginTop: 4 }}><SourceChip doc={docById.get(a.documentId ?? "") ?? null} onOpen={onOpen} /></span>
                  </>}
                />
              );
            })}
          </div>
        </Fold>
      )}

      {exercises.length > 0 && (
        <Fold storageKey={key("practice")} title="Practice set that week" count={exercises.length} summary={exercises.map((e) => e.title).join(" · ")}>
          <div className="ios-list" style={list}>
            {exercises.map((ex) => (
              <Cell key={ex.id} chevron={false}
                lead={<IconBadge color={ex.status === "done" ? "var(--ios-green)" : "var(--ios-orange)"}><Icons.SparkleIcon /></IconBadge>}
                title={ex.title}
                subtitle={<>{ex.rationale}<span style={{ display: "block", marginTop: 4 }}><SourceChip doc={docById.get(ex.documentId ?? "") ?? null} onOpen={onOpen} /></span></>}
              />
            ))}
          </div>
        </Fold>
      )}

      {docs.length > 0 && (
        <Fold storageKey={key("docs")} title="Everything scanned that week" count={docs.length} summary={docs.map((d) => KIND_LABEL[d.kind] ?? "Document").join(", ") + "."}>
          <div className="ios-list" style={list}>
            {docs.map((d) => (
              <Cell key={d.id} onClick={() => onOpen(d)} chevron
                lead={<IconBadge color={d.kind === "newsletter" ? "var(--ios-tint)" : d.kind === "graded_work" ? "var(--ios-green)" : "#8E8E93"}><Icons.BookIcon /></IconBadge>}
                title={d.title}
                subtitle={`${KIND_LABEL[d.kind] ?? "Document"} · ${d.docDate ? fmtDate(d.docDate) : `added ${fmtDate(d.createdAt.slice(0, 10))}`}${d.filePaths.length ? ` · ${d.filePaths.length} page${d.filePaths.length === 1 ? "" : "s"}` : " · no scan kept"}`} />
            ))}
          </div>
        </Fold>
      )}
    </div>
  );
}
