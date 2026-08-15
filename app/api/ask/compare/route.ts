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

interface CompareBody { question: string; models: string[]; synthesize?: boolean; web?: boolean }

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
  const messages = [
    { role: "system" as const, content: `You are a helpful, accurate assistant. Be clear and concise. Use markdown (headings, bold, bullet lists) when it aids readability.${web ? " When you use web sources, cite them." : ""}` },
    { role: "user" as const, content: question },
  ];

  // Fan out to every chosen model in parallel — one failure never blocks the rest.
  // Perplexity Sonar searches natively, so the web plugin is only added to the others.
  const settled = await Promise.allSettled(
    models.map((m) => askModel(m, messages, 1200, { web: web && !m.startsWith("perplexity/") })),
  );
  const results = models.map((model, i) => {
    const r = settled[i];
    return r.status === "fulfilled"
      ? { model, answer: r.value.content, error: null as string | null, cost: r.value.cost, citations: r.value.citations }
      : { model, answer: "", error: (r.reason as Error)?.message ?? "Failed", cost: null as number | null, citations: [] };
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
            { role: "user", content: `Question: ${question}\n\nHere are ${good.length} answers from different models:\n\n${combined}\n\nProduce the single best merged answer, noting agreements and any conflicts.` },
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
