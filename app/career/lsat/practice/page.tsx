export const dynamic = "force-dynamic";

import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { LargeTitle } from "@/components/ios";
import PracticeSetupClient from "./PracticeSetupClient";

export default async function PracticeSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; section?: string }>;
}) {
  const { mode, section } = await searchParams;
  const rawUserId = await getCurrentUserId();
  if (!rawUserId) { const { redirect: r } = await import("next/navigation"); r("/"); }
  const userId = rawUserId!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Load question types for the drill selector
  const { data: questionTypes } = await db
    .schema("student_support")
    .from("lsat_question_types")
    .select("id, section, category, subcategory")
    .order("section").order("category").order("subcategory");

  // Count available questions per type
  const { data: qCounts } = await db
    .schema("student_support")
    .from("lsat_questions")
    .select("type_id, id");

  const countByType = new Map<string, number>();
  for (const q of qCounts ?? []) {
    countByType.set(q.type_id, (countByType.get(q.type_id) ?? 0) + 1);
  }

  const lrTypes = (questionTypes ?? []).filter((t: { section: string }) => t.section === "LR");
  const rcTypes = (questionTypes ?? []).filter((t: { section: string }) => t.section === "RC");

  return (
    <div className="ios-scroll">      <LargeTitle title="New Session" subtitle="Choose a mode and configure your session." />

      <div style={{ padding: "0 16px" }}>
        <PracticeSetupClient
          userId={userId}
          lrTypes={lrTypes}
          rcTypes={rcTypes}
          countByType={Object.fromEntries(countByType)}
          initialMode={mode}
          initialSection={section}
        />
      </div>
    </div>
  );
}
