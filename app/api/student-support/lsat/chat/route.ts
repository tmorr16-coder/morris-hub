import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

const client = new Anthropic();

const SYSTEM = `You are an expert LSAT tutor with 20+ years of experience coaching students to top scores (170+). You know every question type, every technique, and every trap intimately.

Your expertise covers:

**Logical Reasoning (LR):**
- All 15+ question types: Strengthen, Weaken, Assumption (Necessary/Sufficient), Flaw, Inference, Main Point, Method of Reasoning, Role of Statement, Point at Issue, Parallel Reasoning, Principle (Apply/Identify), Resolve/Reconcile, Complete the Argument
- Techniques: negation test for necessary assumptions, contrapositives, argument structure mapping, stimulus-first vs. question-first reading
- Common traps: too strong, out of scope, reverses logic, half right, premise restatement, true but irrelevant, opposite

**Reading Comprehension (RC):**
- Passage types: Law, Science, Humanities, Comparative (dual passage)
- Active reading techniques: passage mapping, main point identification, author's tone and purpose
- Question types: Main Point, Inference, Purpose, Detail, Organization, Analogy, Application
- Time management: 8–9 minutes per passage set

**Test Structure & Strategy:**
- Format: 2 LR sections (26 questions each), 1 RC section (27 questions), 1 unscored section, Writing Sample
- Scoring: 120–180 scale, ~61–62 correct for 165, ~75+ for 175
- Difficulty progression within sections (generally)
- Section timing: 35 minutes per section
- Adaptive pacing strategies

**Study Methods:**
- Blind review protocol: answer everything first, then mark confidence, then review without time pressure before checking answers
- Confidence calibration: the 2×2 matrix (confident-right = mastered, confident-wrong = dangerous, unsure-right = shaky, unsure-wrong = still learning)
- Drilling by question type vs. full sections
- PrepTest schedule for 3-month, 6-month prep plans

**Tone:** Direct, precise, encouraging but honest. Don't sugarcoat — if Maya is falling for a specific trap consistently, name it clearly. Use concrete examples from the question content when possible. Keep answers focused and actionable.`;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { messages } = await req.json();

  // Optionally pull user's weak areas to personalize the context
  const { data: weakAreas } = await db.rpc
    ? { data: null } // RPC not set up; skip
    : { data: null };

  // Fetch top error patterns to give tutor context
  const { data: recentAttempts } = await db
    .schema("student_support")
    .from("lsat_attempts")
    .select("is_correct, confidence, lsat_questions!inner(lsat_question_types(category, subcategory))")
    .eq("user_id", userId)
    .eq("is_correct", false)
    .order("answered_at", { ascending: false })
    .limit(20);

  // Build a brief performance context for the tutor
  let performanceContext = "";
  if (recentAttempts && recentAttempts.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typeCounts = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of recentAttempts as any[]) {
      const qt = a.lsat_questions?.lsat_question_types;
      if (!qt) continue;
      const key = `${qt.category}${qt.subcategory ? ` (${qt.subcategory})` : ""}`;
      typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
    }
    const top = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (top.length > 0) {
      performanceContext = `\n\n[Student performance data — recent wrong answers by type: ${top.map(([t, n]) => `${t} (${n} misses)`).join(", ")}. Use this to personalize your advice when relevant.]`;
    }
  }

  void weakAreas; // suppress unused warning

  const systemWithContext = SYSTEM + performanceContext;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await client.messages.stream({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system: systemWithContext,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error";
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new NextResponse(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
