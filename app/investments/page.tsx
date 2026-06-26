export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import { getUserInvestmentIdeas } from "@/lib/investment-ideas";
import PlatformMenu from "@/components/PlatformMenu";
import InvestmentsClient from "./_components/InvestmentsClient";
import InvestmentsPageWrapper from "./_components/InvestmentsPageWrapper";

export default async function InvestmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Check if user has access to investments module
  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("investments")) {
    redirect("/home");
  }

  // Load investment ideas
  // NOTE: AI ideas are now generated on-demand via button click, not on page load
  const savedIdeas = await getUserInvestmentIdeas(user.id);

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
  };

  return (
    <div>
      <PlatformMenu currentApp="investments" user={menuUser} />

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
            Investment Ideas<span style={{ fontStyle: "italic", color: "var(--color-accent-dark)" }}>.</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginTop: 12 }}>
            Explore AI-generated opportunities, track your investment research, and discover individual stocks.
          </p>
        </div>

        <InvestmentsPageWrapper
          savedIdeas={savedIdeas}
          enabledCategories={prefs.investment_categories}
          watchedStocks={prefs.watched_stocks}
        />
      </main>
    </div>
  );
}
