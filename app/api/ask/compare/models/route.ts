import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchCatalog } from "@/lib/openrouter";

export const runtime = "nodejs";

// Search OpenRouter's whole catalog so any model there can join the panel.
// The catalog is fetched server-side and cached for an hour — it's ~400 models,
// far too much to ship to the client on every page load.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 60);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const data = await res.json();
    const models = searchCatalog(data.data ?? [], q);
    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json(
      { error: "catalog_unavailable", message: `Couldn't reach OpenRouter's model list: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
