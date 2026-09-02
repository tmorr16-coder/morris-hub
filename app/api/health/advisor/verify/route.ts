import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { askModel, openrouterConfigured } from "@/lib/openrouter";
import { buildAssessment, assessmentToPrompt } from "@/lib/health/assessment";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * A second model checks the advisor's answer.
 *
 * Health advice is the place in this app where a confident wrong answer costs
 * the most, and a model asked to review its own output mostly agrees with
 * itself. The check therefore runs through OpenRouter on a *different* vendor's
 * model, given the same measured data and asked to find specific faults rather
 * than to rate the answer.
 *
 * What it is asked for matters as much as which model runs it. "Is this good?"
 * produces agreement; "quote anything that misstates the data, overreaches
 * beyond it, or should have been referred to a clinician" produces findings.
 */

const CHECK_SYSTEM = `You are reviewing another AI's health coaching answer against the data it was given. You are not writing your own answer.

Report only what is wrong or missing, under these headings, omitting any heading with nothing under it:

**Misstates the data** — a figure quoted wrongly, a trend claimed that the numbers do not show, or a number presented as measured when the data says it was not recorded. Quote the specific claim.
**Overreaches** — advice the data cannot support, or confidence the sample size does not justify (a trend from three days, a conclusion from one scan).
**Should involve a clinician** — anything drifting into diagnosis, medication dosing, or interpretation of an abnormal result that was answered directly instead of referred.
**Missed something** — a signal in the data that materially changes the advice and went unmentioned.

Then one line: **Verdict** — "Sound", "Sound with caveats", or "Do not act on this", and why in under 20 words.

Be specific and brief. If the answer is accurate and appropriately hedged, say so in a sentence rather than inventing criticism — a review that always finds fault is as useless as one that never does.`;

const ALLOWED = new Set([
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5.1",
  "x-ai/grok-4.6",
  "anthropic/claude-opus-4.5",
]);
const DEFAULT_CHECKER = "google/gemini-3.1-pro-preview";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!openrouterConfigured()) {
    return NextResponse.json(
      { error: "A second opinion needs an OPENROUTER_API_KEY — that is what reaches a model from a different vendor." },
      { status: 503 }
    );
  }

  let body: { question?: string; answer?: string; model?: string; windowDays?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  const answer = (body.answer ?? "").trim();
  if (!answer) return NextResponse.json({ error: "Nothing to check." }, { status: 400 });

  const model = body.model && ALLOWED.has(body.model) ? body.model : DEFAULT_CHECKER;
  const windowDays = body.windowDays === 90 ? 90 : 30;

  try {
    // The checker gets the same data the advisor had. Reviewing an answer
    // without the evidence behind it can only assess plausibility, which is
    // exactly the failure mode being guarded against.
    const assessment = await buildAssessment(user.id, windowDays);

    const result = await askModel(
      model,
      [
        { role: "system", content: CHECK_SYSTEM },
        {
          role: "user",
          content: `THE DATA THE ADVISOR WAS GIVEN:\n${assessmentToPrompt(assessment)}\n\n---\nTHE QUESTION ASKED:\n${question || "(the opening assessment)"}\n\n---\nTHE ANSWER TO REVIEW:\n${answer}`,
        },
      ],
      900
    );

    return NextResponse.json({ review: result.content, model, cost: result.cost });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "The check could not run.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
