import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { searchVerses, lookupReference, type VerseResult } from "@/lib/bible-api";
import { MODEL_FAST } from "@/lib/models";

const anthropic = new Anthropic();

/**
 * Turn a topic/keyword/paraphrase ("faith", "love your enemies", "the good
 * samaritan") into concrete scripture references. The keyless bible sources
 * don't offer full-text search, so we let the model surface the most relevant
 * passages and then resolve their actual verse text.
 */
async function aiReferences(topic: string, limit: number): Promise<string[]> {
  try {
    const msg = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 400,
      system:
        "You find the most relevant Bible verses for a topic, theme, phrase, or paraphrase. " +
        "Respond with ONLY a JSON array of scripture reference strings using standard English " +
        'book names, e.g. ["John 3:16", "Romans 8:28", "1 Corinthians 13:4-7"]. ' +
        "Prefer single verses or short ranges. No prose, no markdown — JSON array only.",
      messages: [{ role: "user", content: `Find up to ${limit} Bible verses about: ${topic}` }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(arr)
      ? arr.filter((s): s is string => typeof s === "string").slice(0, limit)
      : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const bibleId = searchParams.get("bibleId") ?? "de4e12af7f28f599-02";
  const query = searchParams.get("q") ?? "";
  if (!query) return NextResponse.json([]);

  // Direct hit: a scripture reference, or api.bible full-text search when keyed.
  let results = await searchVerses(bibleId, query);

  // Topic/keyword fallback: ask the model for relevant references, then resolve
  // their real verse text from the active bible source.
  if (results.length === 0) {
    const refs = await aiReferences(query, 20);
    if (refs.length) {
      const resolved = await Promise.all(refs.map((r) => lookupReference(bibleId, r, 4)));
      const seen = new Set<string>();
      results = resolved.flat().filter((v: VerseResult) => {
        if (seen.has(v.verseId)) return false;
        seen.add(v.verseId);
        return true;
      });
    }
  }

  return NextResponse.json(results);
}
