import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import PlanUploader from "./_components/PlanUploader";
import StartFamilyPlanButton from "./_components/StartFamilyPlanButton";

/* eslint-disable @typescript-eslint/no-explicit-any */

const BUILT_IN_PLANS = [
  { id: "bible-in-a-year",   title: "Bible in a Year",         description: "Read the entire Bible in 365 days — Old and New Testament together.", duration_days: 365 },
  { id: "nt-in-90-days",     title: "New Testament in 90 Days",description: "Work through all 27 books of the New Testament.",                     duration_days: 90  },
  { id: "psalms-30-days",    title: "Psalms in 30 Days",       description: "Meditate on 5 Psalms each day for a month.",                          duration_days: 30  },
  { id: "gospels-40-days",   title: "The Four Gospels",        description: "Matthew, Mark, Luke, and John across 40 days.",                       duration_days: 40  },
  { id: "proverbs-31-days",  title: "Proverbs in 31 Days",    description: "One chapter of Proverbs per day.",                                    duration_days: 31  },
  { id: "sermon-on-mount",   title: "Sermon on the Mount",     description: "7-day deep dive into Matthew 5–7.",                                   duration_days: 7   },
];

export default async function PlansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const db = createServiceClient() as any;

  const [{ data: userPlans }, { data: publicPlans }] = await Promise.all([
    db.schema("bible").from("user_plans").select("*, plan:reading_plans(*)").eq("user_id", user.id).order("started_at", { ascending: false }),
    db.schema("bible").from("reading_plans").select("*").eq("is_public", true).order("created_at", { ascending: false }).limit(20),
  ]);

  // Graceful fallback if family_plans table not yet migrated.
  // Scope to plans the user created OR belongs to — the service client bypasses
  // RLS, so an unscoped query would surface other families' plans.
  let familyPlans: any[] = [];
  try {
    const { data: memberRows } = await db.schema("bible").from("family_plan_members")
      .select("family_plan_id").eq("user_id", user.id);
    const memberPlanIds = ((memberRows ?? []) as any[]).map((r) => r.family_plan_id as string);

    let fpQuery = db.schema("bible").from("family_plans")
      .select("*, plan:reading_plans(*), members:family_plan_members(user_id)");
    fpQuery = memberPlanIds.length > 0
      ? fpQuery.or(`created_by.eq.${user.id},id.in.(${memberPlanIds.join(",")})`)
      : fpQuery.eq("created_by", user.id);

    const { data: fp } = await fpQuery.limit(10);
    familyPlans = fp ?? [];
  } catch { /* table not yet created */ }

  const enrolledIds = new Set((userPlans ?? []).map((up: any) => up.plan_id));

  return (
    <div className="ios-scroll">
      <LargeTitle title="Plans" subtitle="Reading plans" trailing={<PlanUploader />} />

      <Group header="Create">
        <Cell
          lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>}
          title="Generate a plan with AI"
          subtitle="Describe a goal and get a personalized schedule"
          href="/bible/plans/generate"
        />
      </Group>

      {(userPlans ?? []).length > 0 && (
        <Group header="My plans">
          {(userPlans ?? []).map((up: any) => (
            <div key={up.plan_id}>
              <Cell
                lead={<IconBadge color="var(--ios-green)"><Icons.ChecklistIcon /></IconBadge>}
                title={up.plan?.title ?? "Reading plan"}
                subtitle={`${up.plan?.duration_days} days · Started ${new Date(up.started_at).toLocaleDateString()}`}
                href={`/bible/plans/${up.plan_id}`}
              />
              <div className="ios-cell ios-cell--inset" style={{ paddingTop: 8, paddingBottom: 8 }}>
                <StartFamilyPlanButton planId={up.plan_id} planTitle={up.plan?.title ?? "Plan"} />
              </div>
            </div>
          ))}
        </Group>
      )}

      <Group header="Curated plans" footer="Tap a plan to preview it and start reading.">
        {BUILT_IN_PLANS.map((plan) => (
          <Cell
            key={plan.id}
            lead={<IconBadge color="#3B5C7F"><Icons.BookIcon /></IconBadge>}
            title={plan.title}
            subtitle={plan.description}
            trailing={<span className="ios-num" style={{ color: "var(--ios-label-2)" }}>{plan.duration_days}d</span>}
            href={`/bible/plans/${plan.id}`}
          />
        ))}
      </Group>

      {(publicPlans ?? []).filter((p: any) => !enrolledIds.has(p.id)).length > 0 && (
        <Group header="Community plans">
          {(publicPlans ?? []).filter((p: any) => !enrolledIds.has(p.id)).map((plan: any) => (
            <Cell
              key={plan.id}
              lead={<IconBadge color="#6B5B95"><Icons.PeopleIcon /></IconBadge>}
              title={plan.title}
              subtitle={`${plan.duration_days} days`}
              href={`/bible/plans/${plan.id}`}
            />
          ))}
        </Group>
      )}

      {familyPlans.length === 0 ? (
        <Group header="Family plans" footer="Enroll in any plan, then share it with your family to track progress together.">
          <Cell
            lead={<IconBadge color="#E8607A"><Icons.PeopleIcon /></IconBadge>}
            title="Browse curated plans"
            subtitle="Start one, then start a family plan"
            href="/bible/plans"
          />
        </Group>
      ) : (
        <Group header="Family plans">
          {familyPlans.map((fp: any) => {
            const memberCount = fp.members?.length ?? 0;
            const myCompleted = fp.my_progress?.length ?? 0;
            const totalDays = fp.plan?.duration_days ?? 1;
            const pct = Math.round((myCompleted / totalDays) * 100);
            return (
              <Cell
                key={fp.id}
                lead={<IconBadge color="#E8607A"><Icons.PeopleIcon /></IconBadge>}
                title={fp.name}
                subtitle={`${fp.plan?.title} · ${memberCount} member${memberCount !== 1 ? "s" : ""} · ${pct}%`}
                href={`/bible/plans/${fp.plan_id}?familyPlanId=${fp.id}`}
              />
            );
          })}
        </Group>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}
