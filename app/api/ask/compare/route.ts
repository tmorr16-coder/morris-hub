import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { openrouterConfigured, askModel, fetchVisionModels, SYNTH_MODEL, type ContentPart, type FileAnnotation } from "@/lib/openrouter";
import { buildContextBlock, buildImageParts, buildFileParts, extractParsedText, type PanelAttachment } from "@/lib/panel-context";

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
interface CompareBody {
  question: string;
  models: string[];
  synthesize?: boolean;
  web?: boolean;
  history?: PriorTurn[];
  /** Files carried by the thread — re-sent each turn, since the API is stateless. */
  attachments?: PanelAttachment[];
  /** Run a second round where each model reads the others and responds. */
  debate?: boolean;
}

const MAX_TURNS = 6;      // how far back the thread is replayed
const MAX_TURN_CHARS = 1500; // each replayed answer is trimmed to bound cost
const MAX_ATTACHMENTS = 10;
const MAX_REACTION_CHARS = 1200; // peer answers shown in the reaction round

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
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
  const debate = !!body.debate;
  const attachments = (Array.isArray(body.attachments) ? body.attachments : []).slice(0, MAX_ATTACHMENTS);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-MAX_TURNS);

  // Documents become a context block on the system prompt; images ride as
  // content parts on the user turn, so only vision models can be sent them.
  const contextBlock = buildContextBlock(attachments);
  const imageParts = buildImageParts(attachments);
  // PDFs with no text layer — a scan, or a form whose values were never drawn
  // onto the page. These go as `file` parts for OpenRouter's parser to read.
  const fileParts = buildFileParts(attachments);
  const visionModels = imageParts.length ? await fetchVisionModels() : new Set<string>();
  const skippedVision: string[] = [];

  const system = [
    `You are a helpful, accurate assistant. Be clear and concise. Use markdown (headings, bold, bullet lists) when it aids readability.`,
    history.length ? " This is an ongoing conversation — read the earlier turns and resolve follow-ups, pronouns and references against them." : "",
    web ? " When you use web sources, cite them." : "",
    contextBlock ? `\n\n${contextBlock}` : "",
  ].join("");

  const clip = (s: string, n = MAX_TURN_CHARS) => (s.length > n ? s.slice(0, n) + "…" : s);

  // Each model continues its *own* thread. A model added part-way through has no
  // answers of its own, so it picks up the synthesis (or another model's answer)
  // for those turns — otherwise the follow-up would land with no context at all.
  function conversation(model: string) {
    const msgs: {
      role: "system" | "user" | "assistant";
      content: string | ContentPart[];
      annotations?: FileAnnotation[];
    }[] = [{ role: "system", content: system }];
    for (const t of history) {
      if (!t?.q) continue;
      const prior = t.answers?.[model] || t.synthesis || Object.values(t.answers ?? {}).find((a) => a && a.trim());
      if (!prior) continue;
      msgs.push({ role: "user", content: t.q });
      msgs.push({ role: "assistant", content: clip(prior) });
    }

    // Images are the fussy case: a text-only model usually 400s on image parts,
    // so it's told one exists rather than handed it. File parts carry no such
    // risk — the parser converts the PDF before the model ever sees it.
    const sendImages = imageParts.length > 0 && visionModels.has(model);
    if (imageParts.length && !sendImages && !skippedVision.includes(model)) {
      skippedVision.push(model);
    }
    const note = imageParts.length && !sendImages
      ? `\n\n[The user attached ${imageParts.length} image${imageParts.length === 1 ? "" : "s"} that you cannot see. Answer from the text you have, and say the image is not visible to you if it matters.]`
      : "";

    const parts: ContentPart[] = [
      { type: "text", text: question + note },
      ...(sendImages ? imageParts : []),
      ...fileParts,
    ];
    // Only go multipart when there's actually something beyond the text.
    msgs.push(parts.length > 1 ? { role: "user", content: parts } : { role: "user", content: question + note });
    return msgs;
  }

  // ── Streamed run ──────────────────────────────────────────────────────────
  // Everything below is emitted as Server-Sent Events rather than assembled and
  // returned at the end. With four models, a reaction round and a synthesis, one
  // submission is up to nine model calls; collecting them all before responding
  // meant a minute of a motionless spinner, which reads as broken rather than as
  // thorough. Each answer now appears the moment it lands.
  //
  // mistral-ocr is the only engine that reads a scan, and we only get here when
  // local extraction already failed — so the file genuinely has no text layer.
  const pdfEngine = fileParts.length ? ("mistral-ocr" as const) : undefined;

  interface ResultRow {
    model: string;
    answer: string;
    error: string | null;
    cost: number | null;
    citations: { url: string; title: string }[];
    served: string | null;
    reaction: string | null;
    reactionCost: number | null;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          open = false; // client went away mid-run
        }
      };

      try {
        const results: ResultRow[] = [];
        const rawAnnotations: FileAnnotation[] = [];

        // ── Round 1: every model answers independently ───────────────────────
        // Parallel, and each one is sent on as soon as it resolves — a slow
        // model no longer holds up the three that already finished.
        await Promise.all(
          models.map(async (model) => {
            let row: ResultRow;
            try {
              const r = await askModel(model, conversation(model), 1200, {
                web: web && !model.startsWith("perplexity/"),
                pdfEngine,
              });
              rawAnnotations.push(...r.annotations);
              row = {
                model, answer: r.content, error: null, cost: r.cost,
                citations: r.citations, served: r.served, reaction: null, reactionCost: null,
              };
            } catch (e) {
              row = {
                model, answer: "", error: (e as Error)?.message ?? "Failed", cost: null,
                citations: [], served: null, reaction: null, reactionCost: null,
              };
            }
            results.push(row);
            send("answer", row);
          }),
        );

        // Which columns couldn't see an attached image, and the OCR'd text so the
        // client can swap it in for the PDF it is holding.
        if (skippedVision.length) send("vision", { skippedVision });
        if (fileParts.length) {
          const parsedFiles = extractParsedText(rawAnnotations);
          if (parsedFiles.length) send("files", { parsedFiles });
        }

        // ── Round 2 (optional): each model reads the others and responds ─────
        // Round 1 is four monologues; this is where they actually meet. Each
        // model sees its peers' answers attributed by name and is asked where it
        // agrees, where it doesn't, and to revise if one of them caught something.
        // Needs two good answers — there is nothing to react to otherwise.
        if (debate) {
          const good = results.filter((r) => r.answer && !r.error);
          if (good.length >= 2) {
            await Promise.all(
              good.map(async (self) => {
                const peers = good
                  .filter((p) => p.model !== self.model)
                  .map((p) => `### ${p.model} answered:\n${clip(p.answer, MAX_REACTION_CHARS)}`)
                  .join("\n\n");
                try {
                  const r = await askModel(
                    self.model,
                    [
                      {
                        role: "system",
                        content:
                          "You are on a panel that just answered a question independently. You will see what the other models said. Respond in under 150 words: name the substantive points where you agree, flag anything you think is wrong or misleading and say why, and revise your own answer if one of them caught something you missed. Be direct and specific — do not summarize the question or pad with pleasantries. If you fully agree, say so in one line rather than inventing a disagreement.",
                      },
                      { role: "user", content: `The question was: ${question}\n\nYour answer:\n${clip(self.answer, MAX_REACTION_CHARS)}\n\nThe other panelists:\n\n${peers}` },
                    ],
                    500,
                  );
                  self.reaction = r.content;
                  self.reactionCost = r.cost;
                  send("reaction", { model: self.model, reaction: r.content, reactionCost: r.cost });
                } catch {
                  // A failed reaction leaves the answer standing on its own.
                }
              }),
            );
          }
        }

        // ── Optional synthesis — one model reads everything and merges it ────
        let synthesisCost: number | null = null;
        if (body.synthesize) {
          const good = results.filter((r) => r.answer && !r.error);
          if (good.length >= 2) {
            const combined = good
              .map((r) => `### Answer from ${r.model}\n${r.answer}${r.reaction ? `\n\n**${r.model} on the others:** ${r.reaction}` : ""}`)
              .join("\n\n");
            try {
              const s = await askModel(
                SYNTH_MODEL,
                [
                  { role: "system", content: `You synthesize multiple AI answers into one best answer. Note where the models agree, flag any disagreements or factual conflicts, and produce a single clear, well-organized response. Be concise; use markdown.${debate ? " Each answer may be followed by that model's response to the others — weight a point that survived scrutiny over one that was challenged and left undefended." : ""}` },
                  { role: "user", content: `${history.length ? `Earlier in this conversation: ${history.map((t) => t.q).join(" → ")}\n\n` : ""}Question: ${question}\n\nHere are ${good.length} answers from different models:\n\n${combined}\n\nProduce the single best merged answer, noting agreements and any conflicts.` },
                ],
                1400,
              );
              synthesisCost = s.cost;
              send("synthesis", { synthesis: s.content, synthesisCost: s.cost });
            } catch {
              // No synthesis is a missing extra, not a failed run.
            }
          }
        }

        const totalCost =
          results.reduce((sum, r) => sum + (r.cost ?? 0) + (r.reactionCost ?? 0), 0) + (synthesisCost ?? 0);
        send("done", { totalCost });
      } catch (e) {
        send("error", { message: (e as Error)?.message ?? "The run failed." });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      // Tells any proxy in front of us not to buffer, which would defeat the point.
      "X-Accel-Buffering": "no",
    },
  });
}
