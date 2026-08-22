export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import { getUserInvestmentIdeas } from "@/lib/investment-ideas";
import { LargeTitle } from "@/components/ios";
import InvestmentsClient from "../_components/InvestmentsClient";

export default async function InvestmentsIdeasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("investments")) redirect("/home");

  const savedIdeas = await getUserInvestmentIdeas(user.id);

  return (
    <div className="ios-scroll">
      <LargeTitle title="Ideas" subtitle="Research & discovery" />
      <div style={{ padding: "4px 16px 16px" }}>
        <InvestmentsClient savedIdeas={savedIdeas} enabledCategories={prefs.investment_categories} />
      </div>
    </div>
  );
}
