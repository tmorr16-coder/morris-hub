import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { MODEL_FAST } from "@/lib/models";
import { childScreenAccess } from "@/app/children/_lib/kid-device";

export const runtime = "nodejs";
export const maxDuration = 30;

// Reads what a child wrote with the pencil.
//
// The page sends a small picture of the answer box; this says what is written
// in it. The reader is deliberately NOT told the right answer: told "the
// answer is 15", a model reads a wobbly 13 as 15, and the whole point of
// marking is lost. Whether it matches is decided on the device.

const client = new Anthropic();

const rateBuckets = new Map<string, number[]>();
function allow(key: string, limit = 150, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const arr = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  rateBuckets.set(key, arr);
  return true;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  let body: { childId?: string; image?: string; kind?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const childId = String(body.childId ?? "");
  const kind = body.kind === "number" ? "number" : "word";
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image ?? ""));
  if (!childId || !m || m[2].length > 600_000) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const access = await childScreenAccess(childId);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allow(access.rateKey)) return NextResponse.json({ error: "Slow down" }, { status: 429 });

  const ask = kind === "number"
    ? "A six-year-old wrote a number by hand in this box. Reply with only the digits you see, exactly as written, nothing else. If a digit is written backwards (mirror image) still report that digit. If the box holds no readable number, reply with a single question mark."
    : "A six-year-old wrote one English word by hand in this box. Reply with only the letters you see, in order, lowercase, exactly as written — do not fix the spelling and do not guess a real word. If a letter is written backwards (mirror image) still report that letter. If there is no readable writing, reply with a single question mark.";

  try {
    const res = await client.messages.create({
      model: MODEL_FAST,
      max_tokens: 20,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: `image/${m[1]}` as "image/png" | "image/jpeg", data: m[2] } },
        { type: "text", text: ask },
      ] }],
    });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
    const read = kind === "number" ? text.replace(/[^0-9]/g, "") : text.toLowerCase().replace(/[^a-z]/g, "");
    return NextResponse.json({ read });
  } catch (e) {
    console.error("[children/workbook/check]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Reader unavailable" }, { status: 502 });
  }
}
