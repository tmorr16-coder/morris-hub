export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import StockSearchPage from "../_components/StockSearchPage";

export default async function InvestmentsStocksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Check if user has access to investments module
  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("investments")) {
    redirect("/home");
  }

  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 28px 80px" }}>
      <Link
        href="/home"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: "var(--color-ink-3)",
          textDecoration: "none",
          marginBottom: 20,
        }}
      >
        ← Home
      </Link>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 8 }}>
          Research & Discovery
        </div>
        <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05 }}>
          Stock Research<span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>.</span>
        </h1>
        <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginTop: 12 }}>
          Discover individual stocks with AI-powered analysis, build your watchlist, and research any ticker.
        </p>
      </div>

      <StockSearchPage watchedStocks={prefs.watched_stocks} />
    </main>
  );
}
