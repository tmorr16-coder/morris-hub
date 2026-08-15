import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openrouterConfigured, generateImage } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

const rl = new Map<string, { count: number; resetAt: number }>();
function allow(userId: string): boolean {
  const now = Date.now();
  const e = rl.get(userId);
  if (!e || now > e.resetAt) { rl.set(userId, { count: 1, resetAt: now + 60_000 }); return true; }
  if (e.count >= 8) return false;
  e.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allow(user.id)) return NextResponse.json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  if (!openrouterConfigured()) return NextResponse.json({ error: "not_configured", message: "Image generation needs the OpenRouter key." }, { status: 503 });

  let body: { prompt?: string; model?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "Describe the image you want" }, { status: 400 });

  try {
    const { url, cost } = await generateImage(prompt, body.model);
    return NextResponse.json({ image: url, cost });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
