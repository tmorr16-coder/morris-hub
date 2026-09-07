import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { MODEL_BALANCED } from "@/lib/models";
import { childForGuardian } from "@/app/children/_lib/children";
import { gradeLabelFor, type DocumentExtraction } from "@/app/children/_lib/learning";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic();

/* eslint-disable @typescript-eslint/no-explicit-any */

// Read a page (or several) from a child's school — a newsletter, a graded
// test, a word list — into the one structure the workspace understands, and
// propose the practice that follows from it. The photos come straight off a
// phone; the client has already turned them into JPEGs under 1568px.

const SYSTEM = `You read what an elementary school sends home — weekly newsletters, spelling lists, graded tests and homework — for the child's parents, and turn it into a plan they can act on that evening.

You are careful, literal, and specific. You transcribe dates, words and scores exactly as printed. You never invent a score, a date or a teacher's comment. When you propose practice, every exercise is anchored to something on the page: a teacher's note in the margin, an item marked wrong, a pattern being taught this week, or a request the teacher made of families. You write for a parent with ten minutes at the kitchen table, not for a teacher.

Return ONLY a JSON object — no prose, no markdown fences.`;

function promptFor(childName: string, gradeLabel: string | null, today: string): string {
  return `The child is ${childName}${gradeLabel ? `, in ${gradeLabel}` : ""}. Today is ${today}. Every page attached belongs to the same document (a multi-page newsletter, or one graded paper). Read all of them.

Return this exact JSON shape:
{
  "kind": "newsletter" | "graded_work" | "word_list" | "other",
  "title": "short, specific — e.g. '1st Grade Newsletter, Sept 4' or 'Spelling Test, Week 3 (CVC words)'",
  "doc_date": "YYYY-MM-DD printed on it, or null",
  "week_start": "YYYY-MM-DD (Monday) of the week a newsletter covers, or null",
  "week_end": "YYYY-MM-DD (Friday), or null",
  "summary": "two or three plain sentences a parent would want first",
  "dates": [ { "date": "YYYY-MM-DD", "title": "as printed, shortened", "kind": "no_school" | "early_dismissal" | "field_trip" | "test" | "event" | "other", "note": "time or detail, or null" } ],
  "spelling": { "week_start": "YYYY-MM-DD or null", "week_end": "YYYY-MM-DD or null", "pattern": "the rule as a short label of at most eight words, e.g. 'Silent e: long a, i and o' — never a sentence", "words": ["every practice word printed, lowercase, in order, no duplicates"], "sight_words": ["high-frequency words to practise"], "test_on": "YYYY-MM-DD of the test, or null" } or null,
  "academics": [ { "subject": "Language Arts" | "Math" | "Science" | "Bible" | "Reading" | "...", "topics": ["as printed"] } ],
  "read_aloud": "book title, or null",
  "memory_verse": "reference and text, or null",
  "recitation": "poem or piece being memorised, or null",
  "parent_requests": ["things the teacher asked families to do at home, each one sentence"],
  "birthdays": [ { "name": "...", "date": "YYYY-MM-DD or null" } ],
  "assessments": [ {
    "subject": "spelling" | "handwriting" | "reading" | "decoding" | "math" | "science" | "bible" | "other",
    "title": "e.g. 'Spelling Test — Week 3, CVC words'",
    "score": number or null, "out_of": number or null,
    "assessed_on": "YYYY-MM-DD or null",
    "teacher_feedback": "every handwritten teacher comment, verbatim, joined with ' · ' — or null",
    "observations": ["what the paper itself shows about how the child is doing — a reversed letter, a vowel confused with another, a capital where a lowercase belongs, a strategy used well. Specific: name the letters, the words, the numbers."],
    "items": [ { "prompt": "the word or problem", "written": "what the child wrote, or null", "correct": true | false | null } ]
  } ],
  "exercises": [ {
    "title": "short imperative, e.g. 'Clock-start d: three rows'",
    "skill": "the one skill, e.g. 'letter formation: d'",
    "rationale": "one sentence, naming the evidence on the page — quote the teacher's words when there are any",
    "steps": "three to five short numbered steps a parent can run in 5–10 minutes",
    "minutes": 5 | 8 | 10 | 15,
    "frequency": "daily" | "three_a_week" | "weekly" | "once",
    "materials": "what to have on hand, or null"
  } ]
}

Rules:
- Dates: use the document's year (or ${today.slice(0, 4)} if none is printed). "Monday, Sept. 7th" with a document dated 2026 is "2026-09-07". Include EVERY calendar item printed, including no-school days and dismissal changes.
- A graded paper: score and out_of exactly as the teacher wrote them (a "+9/10" is 9 of 10). If the teacher scored two things (spelling AND handwriting), return two assessments. Transcribe each numbered item with what the child wrote; mark correct=false only where the teacher marked it or the spelling is clearly wrong.
- Observations are yours, from looking: reversals (b/d, p/q), letter sizing and baseline, which vowel sound was confused (the child wrote 'fex' for 'fix'), which strategy the child used in math. Be concrete and kind.
- Exercises: 3 to 6. Each must trace to the page. A teacher's note ("start at 2 on the clock" for the letter d) becomes an exercise that repeats her exact cue. A pattern being taught this week (silent e) becomes a game with this week's actual words. A request to families (practise tying shoes, recite the poem with the map) becomes an exercise. Age-appropriate for ${gradeLabel ?? "the child's grade"}: short, physical, playful, with the child doing the writing or saying.
- Never include an exercise for a skill the page shows the child has already mastered.
- Set spelling to null for a graded paper that carries no list of words to study. Set assessments to [] for a newsletter.
- kind is "newsletter" when the pages are a newsletter and its attachments together (spelling sheet, word list); "word_list" only when a word list arrives alone.`;
}

const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_TOTAL = 4 * 1024 * 1024;   // Vercel drops bodies over 4.5MB before we run
const MAX_PAGES = 5;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Reading documents is not configured on this server." }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload." }, { status: 400 });
  }
  const childId = String(formData.get("childId") ?? "");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (!childId) return NextResponse.json({ error: "Which child?" }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ error: "No pages attached." }, { status: 400 });
  if (files.length > MAX_PAGES) return NextResponse.json({ error: `Up to ${MAX_PAGES} pages at a time.` }, { status: 400 });

  const svc = createServiceClient() as any;
  const child = await childForGuardian(svc, childId, user.id);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let total = 0;
  const blocks: any[] = [];
  for (const f of files) {
    if (!ALLOWED.has(f.type)) {
      return NextResponse.json({ error: `One page is a ${f.type || "unknown type"}. Take a photo or use a PDF — iPhone HEIC photos are converted when picked here.` }, { status: 400 });
    }
    total += f.size;
    if (total > MAX_TOTAL) {
      return NextResponse.json({ error: "Those pages add up to more than can be sent at once. Send fewer pages, or retake them through the app so they are resized." }, { status: 400 });
    }
    const data = Buffer.from(await f.arrayBuffer()).toString("base64");
    blocks.push(
      f.type === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
        : { type: "image", source: { type: "base64", media_type: f.type, data } },
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const gradeLabel = gradeLabelFor(child.birth_year, new Date());
  const childName = child.display_name ?? "the child";

  try {
    const response = await client.messages.create({
      model: MODEL_BALANCED,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content: [...blocks, { type: "text", text: promptFor(childName, gradeLabel, today) }] }],
    });
    const text = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed: DocumentExtraction;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Could not read those pages clearly. Try again with better light, one page at a time." }, { status: 422 });
    }
    return NextResponse.json({ extraction: normalize(parsed) });
  } catch (err) {
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: "The reading service had a problem. Try again in a moment." }, { status: 502 });
    console.error("[children/documents/extract]", err);
    return NextResponse.json({ error: "Could not read the document." }, { status: 500 });
  }
}

const FREQ = new Set(["daily", "three_a_week", "weekly", "once"]);
const KINDS = new Set(["newsletter", "graded_work", "word_list", "other"]);
const DATE_KINDS = new Set(["no_school", "early_dismissal", "field_trip", "test", "event", "other"]);
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const arr = <T,>(v: unknown, map: (x: any) => T | null): T[] => (Array.isArray(v) ? v.map(map).filter((x): x is T => x != null) : []);

/** The model's output, made safe to save: every field the right type, nothing missing. */
function normalize(p: any): DocumentExtraction {
  const words = (v: unknown) => [...new Set(arr<string>(v, (w) => str(w)?.toLowerCase() ?? null))];
  return {
    kind: KINDS.has(p?.kind) ? p.kind : "other",
    title: str(p?.title) ?? "School document",
    doc_date: isoDate(p?.doc_date),
    week_start: isoDate(p?.week_start),
    week_end: isoDate(p?.week_end),
    summary: str(p?.summary) ?? "",
    dates: arr(p?.dates, (d) => {
      const date = isoDate(d?.date);
      const title = str(d?.title);
      return date && title ? { date, title, kind: DATE_KINDS.has(d?.kind) ? d.kind : "other", note: str(d?.note) } : null;
    }),
    spelling: p?.spelling
      ? {
          week_start: isoDate(p.spelling.week_start),
          week_end: isoDate(p.spelling.week_end),
          pattern: str(p.spelling.pattern),
          words: words(p.spelling.words),
          sight_words: words(p.spelling.sight_words),
          test_on: isoDate(p.spelling.test_on),
        }
      : null,
    academics: arr(p?.academics, (a) => {
      const subject = str(a?.subject);
      return subject ? { subject, topics: arr<string>(a?.topics, (t) => str(t)) } : null;
    }),
    read_aloud: str(p?.read_aloud),
    memory_verse: str(p?.memory_verse),
    recitation: str(p?.recitation),
    parent_requests: arr<string>(p?.parent_requests, (t) => str(t)),
    birthdays: arr(p?.birthdays, (b) => {
      const name = str(b?.name);
      return name ? { name, date: isoDate(b?.date) } : null;
    }),
    assessments: arr(p?.assessments, (a) => {
      const title = str(a?.title);
      if (!title) return null;
      return {
        subject: str(a?.subject)?.toLowerCase() ?? "other",
        title,
        score: typeof a?.score === "number" ? a.score : null,
        out_of: typeof a?.out_of === "number" ? a.out_of : null,
        assessed_on: isoDate(a?.assessed_on),
        teacher_feedback: str(a?.teacher_feedback),
        observations: arr<string>(a?.observations, (t) => str(t)),
        items: arr(a?.items, (it) => {
          const prompt = str(it?.prompt);
          return prompt ? { prompt, written: str(it?.written), correct: typeof it?.correct === "boolean" ? it.correct : null } : null;
        }),
      };
    }),
    exercises: arr(p?.exercises, (e) => {
      const title = str(e?.title);
      if (!title) return null;
      return {
        title,
        skill: str(e?.skill) ?? "",
        rationale: str(e?.rationale) ?? "",
        steps: str(e?.steps) ?? "",
        minutes: typeof e?.minutes === "number" ? e.minutes : null,
        frequency: FREQ.has(e?.frequency) ? e.frequency : "daily",
        materials: str(e?.materials),
      };
    }),
  };
}
