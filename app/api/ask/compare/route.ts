import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openrouterConfigured, askModel, SYNTH_MODEL } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Rate limit ──────────────────────────────────────────────────────
const rl = new Map<string, { count: number; resetAt: number }>();
function allow(userId: string): boolean {
  const now = Date.now();
  const e = rl.get(userId);
  if (!e || now > e.resetAt) { rl.set(userId, { count: 1, resetAt: now + 60_000 }); return true; }
  if (e.count >= 12) return false;
  e.count++;
  return true;
}

/** One earlier turn of the same thread: the question and what each model said. */
interface PriorTurn { q: string; answers?: Record<string, string>; synthesis?: string | null }
interface CompareBody { question: string; models: string[]; synthesize?: boolean; web?: boolean; history?: PriorTurn[] }

const MAX_TURNS = 6;      // how far back the thread is replayed
const MAX_TURN_CHARS = 1500; // each replayed answer is trimmed to bound cost

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allow(user.id)) return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });

  if (!openrouterConfigured()) {
    return NextResponse.json({ error: "not_configured", message: "Model comparison needs an OpenRouter API key." }, { status: 503 });
  }

  let body: CompareBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const question = (body.question ?? "").trim();
  const models = (body.models ?? []).slice(0, 4); // cap at 4 to bound cost/latency
  if (!question) return NextResponse.json({ error: "Missing question" }, { status: 400 });
  if (!models.length) return NextResponse.json({ error: "Pick at least one model" }, { status: 400 });

  const web = !!body.web;
  const history = (Array.isArray(body.history) ? body.history : []).slice(-MAX_TURNS);
  const system = `You are a helpful, accurate assistant. Be clear and concise. Use markdown (headings, bold, bullet lists) when it aids readability.${
    history.length ? " This is an ongoing conversation — read the earlier turns and resolve follow-ups, pronouns and references against them." : ""
  }${web ? " When you use web sources, cite them." : ""}`;

  const clip = (s: string) => (s.length > MAX_TURN_CHARS ? s.slice(0, MAX_TURN_CHARS) + "…" : s);

  // Each model continues its *own* thread. A model added part-way through has no
  // answers of its own, so it picks up the synthesis (or another model's answer)
  // for those turns — otherwise the follow-up would land with no context at all.
  function conversation(model: string) {
    const msgs: { role: "system" | "user" | "assistant"; content: string }[] = [{ role: "system", content: system }];
    for (const t of history) {
      if (!t?.q) continue;
      const prior = t.answers?.[model] || t.synthesis || Object.values(t.answers ?? {}).find((a) => a && a.trim());
      if (!prior) continue;
      msgs.push({ role: "user", content: t.q });
      msgs.push({ role: "assistant", content: clip(prior) });
    }
    msgs.push({ role: "user", content: question });
    return msgs;
  }

  // Fan out to every chosen model in parallel — one failure never blocks the rest.
  // Perplexity Sonar searches natively, so the web plugin is only added to the others.
  const settled = await Promise.allSettled(
    models.map((m) => askModel(m, conversation(m), 1200, { web: web && !m.startsWith("perplexity/") })),
  );
  const results = models.map((model, i) => {
    const r = settled[i];
    return r.status === "fulfilled"
      ? { model, answer: r.value.content, error: null as string | null, cost: r.value.cost, citations: r.value.citations, served: r.value.served }
      : { model, answer: "", error: (r.reason as Error)?.message ?? "Failed", cost: null as number | null, citations: [], served: null as string | null };
  });

  // Optional synthesis — one model reads all answers and merges them.
  let synthesis: string | null = null;
  let synthesisCost: number | null = null;
  if (body.synthesize) {
    const good = results.filter((r) => r.answer && !r.error);
    if (good.length >= 2) {
      const combined = good.map((r) => `### Answer from ${r.model}\n${r.answer}`).join("\n\n");
      try {
        const s = await askModel(
          SYNTH_MODEL,
          [
            { role: "system", content: "You synthesize multiple AI answers into one best answer. Note where the models agree, flag any disagreements or factual conflicts, and produce a single clear, well-organized response. Be concise; use markdown." },
            { role: "user", content: `${history.length ? `Earlier in this conversation: ${history.map((t) => t.q).join(" → ")}\n\n` : ""}Question: ${question}\n\nHere are ${good.length} answers from different models:\n\n${combined}\n\nProduce the single best merged answer, noting agreements and any conflicts.` },
          ],
          1400,
        );
        synthesis = s.content;
        synthesisCost = s.cost;
      } catch { synthesis = null; }
    }
  }

  const totalCost = results.reduce((sum, r) => sum + (r.cost ?? 0), 0) + (synthesisCost ?? 0);
  return NextResponse.json({ results, synthesis, synthesisCost, totalCost });
}
