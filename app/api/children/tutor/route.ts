import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { MODEL_FAST } from "@/lib/models";
import { childForGuardian } from "@/app/children/_lib/children";
import { loadLearning } from "@/app/children/_lib/learning";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new Anthropic();

/* eslint-disable @typescript-eslint/no-explicit-any */

// Buddy: a tutor for a young child, scoped to this week's school work.
//
// It runs on a parent's signed-in device, handed to the child. It knows the
// child's first name, grade, this week's spelling words and pattern, the
// practice exercises, and what each subject covered — and nothing else. It
// is told, firmly, what it is not for.

const rateBuckets = new Map<string, number[]>();
function allow(userId: string, limit = 40, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  rateBuckets.set(userId, arr);
  return true;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allow(user.id)) return NextResponse.json({ reply: "Let's take a little break and come back in a few minutes!" });

  let body: { childId?: string; messages?: { role: "user" | "assistant"; content: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const childId = String(body.childId ?? "");
  const messages = (body.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));
  if (!childId || messages.length === 0 || messages[messages.length - 1].role !== "user") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const svc = createServiceClient() as any;
  const child = await childForGuardian(svc, childId, user.id);
  if (!child) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const L = await loadLearning(svc, childId, child.birth_year, new Date());
  const first = (child.display_name ?? "friend").split(" ")[0];
  const nl = L.latestNewsletter?.extracted;

  const context = [
    `Child: ${first}${L.gradeLabel ? `, ${L.gradeLabel}` : ""}.`,
    L.spellingWeek ? `This week's spelling pattern: ${L.spellingWeek.pattern ?? "n/a"}. Words: ${L.spellingWeek.words.join(", ")}. Sight words: ${L.spellingWeek.sightWords.join(", ") || "none"}.${L.spellingWeek.testOn ? ` Test on ${L.spellingWeek.testOn}.` : ""}` : "No spelling list on file this week.",
    L.exercises.length ? `Practice exercises the parents set: ${L.exercises.map((e) => `${e.title} (${e.skill ?? ""})`).join("; ")}.` : "",
    nl?.academics?.length ? `At school this week: ${nl.academics.map((a) => `${a.subject}: ${a.topics.join(", ")}`).join(" | ")}.` : "",
    nl?.read_aloud ? `Read-aloud book: ${nl.read_aloud}.` : "",
    nl?.memory_verse ? `Memory verse: ${nl.memory_verse}.` : "",
    nl?.recitation ? `Recitation: ${nl.recitation}.` : "",
    L.assessments.length ? `Recent things to work on (from graded papers): ${L.assessments.flatMap((a) => a.observations).slice(0, 6).join("; ")}.` : "",
  ].filter(Boolean).join("\n");

  const system = `You are Buddy, a friendly owl tutor for ${first}, a young child in ${L.gradeLabel ?? "elementary school"}. The child is reading your words on a screen and hearing them read aloud.

How you talk:
- Very short: one to three short sentences. Simple words a six-year-old knows. Warm and encouraging. One question at a time.
- When spelling a word, say it, then spell it letter by letter with dashes (c-a-k-e), then say it again.
- When quizzing, give ONE word or problem, wait for the answer, then say if it is right. If wrong, say the right answer kindly and try one more like it.
- Stories: four or five sentences, silly, using this week's words.
- Praise effort. Never say "wrong" harshly; say "not yet" or "almost".
- No emoji except one at the end sometimes.

What you are for: this week's school work below — spelling, reading, the math being taught, the Bible story, the recitation. If ${first} asks about anything else (videos, games, other people, buying things, the internet, anything grown-up, anything scary), say gently that Buddy only helps with school stuff and offer a school thing to do instead. Never ask for personal information. Never pretend to be a person. If ${first} seems upset or mentions being hurt, say to go find Mom or Dad right now.

${context}`;

  try {
    const res = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 220,
      system,
      messages,
    });
    const reply = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join(" ").trim() || "Let's try that again!";
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[children/tutor]", err instanceof Error ? err.message : err);
    return NextResponse.json({ reply: "Hmm, I got a little mixed up. Ask me again?" });
  }
}
