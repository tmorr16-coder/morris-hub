export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { LargeTitle } from "@/components/ios";
import ImportClient from "../../_components/ImportClient";

export default async function ImportTripPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <div className="ios-scroll">
      <LargeTitle brand title="Import a trip" subtitle="Paste a confirmation email or calendar invite" />
      <div style={{ padding: "0 16px" }}>
        <ImportClient />
      </div>
      <div style={{ height: 24 }} />
    </div>
  );
}
