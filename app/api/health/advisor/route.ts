import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/supabase/server";
import { MODEL_BALANCED } from "@/lib/models";
import { buildAssessment, assessmentToPrompt } from "@/lib/health/assessment";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic();

/**
 * The health advisor.
 *
 * Unlike /api/health/chat, the context is built HERE from the user's own data
 * rather than accepted from the client. That matters twice over: the advice is
 * grounded in thirty days of measured trends instead of whatever one screen
 * happened to paste in, and a system prompt supplied by the browser is a
 * prompt-injection surface that a health tool has no reason to expose.
 */

const SYSTEM = `You are a health and training coach with access to this person's measured data.

How to answer:
- Lead with what the numbers actually say. Quote the figure you are reasoning from.
- Where the data says "no data", say it is not being measured. Never estimate a number that was not recorded, and never imply a trend from a window with too few days behind it.
- Be specific and practical. "Add a third strength session, Tuesday and Friday are already free" beats "consider training more".
- Separate what is measured from what is inferred. If you are reasoning from typical physiology rather than their data, say so.
- Keep it short. A few paragraphs, or a short list. This is read on a phone.

Boundaries — these matter:
- You are not a doctor and this is not medical advice. Say so when a question moves toward diagnosis, medication dosing, or symptoms that need a clinician.
- Medication data is recorded for adherence only. Never suggest changing a dose, stopping, or starting anything. Point them at their prescriber.
- If a number looks alarming, say plainly that it is worth a clinician's eyes rather than interpreting it yourself.`;

interface AdvisorBody {
  messages?: { role: "user" | "assistant"; content: string }[];
  /** Days in the recent window. 30 by default; 90 for a longer view. */
  windowDays?: number;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "not_configured", message: "The advisor needs an ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  let body: AdvisorBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const messages = (body.messages ?? []).slice(-12).filter((m) => m?.content?.trim());
  if (!messages.length) return NextResponse.json({ error: "Nothing to answer" }, { status: 400 });

  const windowDays = body.windowDays === 90 ? 90 : 30;

  try {
    const assessment = await buildAssessment(user.id, windowDays);
    const response = await anthropic.messages.create({
      model: MODEL_BALANCED,
      max_tokens: 1200,
      system: `${SYSTEM}\n\n---\n${assessmentToPrompt(assessment)}`,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return NextResponse.json({ reply, assessment });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited — try again shortly." }, { status: 429 });
    }
    const msg = err instanceof Error ? err.message : "The advisor could not answer.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
