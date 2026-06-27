import { getCurrentUserId } from "@/lib/supabase/auth-utils";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) ?? [];
  if (!symbols.length) return Response.json({ quotes: [] });

  if (!FINNHUB_KEY) return Response.json({ quotes: [] });

  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
          { cache: "no-store" } // always fresh for the live ticker
        );
        if (!res.ok) return null;
        const q = await res.json();
        if (!q.c) return null;
        return {
          symbol,
          price: q.c as number,
          change: q.dp as number, // percent change
          direction: (q.dp ?? 0) >= 0 ? "up" : "down",
        };
      } catch {
        return null;
      }
    })
  );

  return Response.json({ quotes: quotes.filter(Boolean) });
}
