export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import { buildAssessment } from "@/lib/health/assessment";
import AdvisorClient from "./_components/AdvisorClient";

/**
 * The health advisor.
 *
 * The assessment is rendered server-side and shown before anything is asked,
 * because most of what someone wants from this is answered by the numbers
 * themselves — trends, adherence, what moved. Reaching a model should be for
 * the part that needs judgement ("how should I change training?"), not for
 * finding out what your resting heart rate did.
 */
export default async function HealthAdvisorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const assessment = await buildAssessment(user.id, 30);

  return (
    <IOSScreen>
      <LargeTitle
        brand
        title="Advisor"
        subtitle="Your last 30 days, and what to do about them"
      />
      <div style={{ padding: "0 16px" }}>
        <AdvisorClient assessment={assessment} />
      </div>
      <div style={{ height: 12 }} />
      <TabBar current="health" currentUserId={user.id} sourceApp="health" />
    </IOSScreen>
  );
}
