import { createServiceClient } from "@/lib/supabase/server";

interface Props {
  childId: string;
}

export default async function ParentVisibilityNotice({ childId }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: row } = await db.schema("hub").from("family_members")
    .select("user_id, member_user_id")
    .eq("id", childId)
    .maybeSingle();
  if (!row) return null;

  const [{ data: activities }, { data: healthNotes }, { data: shares }] = await Promise.all([
    db.schema("hub").from("child_activities")
      .select("id")
      .eq("child_id", childId)
      .eq("completed", false),
    db.schema("hub").from("child_health_notes")
      .select("id")
      .eq("child_id", childId)
      .eq("resolved", false),
    row.member_user_id
      ? db.schema("student_support").from("course_shares")
          .select("id")
          .eq("owner_user_id", row.member_user_id)
          .eq("shared_with_user_id", row.user_id)
      : Promise.resolve({ data: [] }),
  ]);

  const activityCount = (activities ?? []).length;
  const healthCount = (healthNotes ?? []).length;
  const shareCount = (shares ?? []).length;
  const totalVisible = activityCount + healthCount + shareCount;

  return (
    <div
      className="ios-footnote"
      style={{
        display: "flex", alignItems: "flex-start", gap: 8, margin: "0 0 20px", padding: "10px 14px",
        background: "var(--ios-fill)", borderRadius: 10, lineHeight: 1.5, color: "var(--ios-label-2)",
      }}
    >
      <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span>
        What your parent can see here: {totalVisible === 0
          ? "nothing yet."
          : [
              activityCount > 0 ? `${activityCount} open activit${activityCount === 1 ? "y" : "ies"}` : null,
              healthCount > 0 ? `${healthCount} health note${healthCount === 1 ? "" : "s"}` : null,
              shareCount > 0 ? `${shareCount} shared course${shareCount === 1 ? "" : "s"}` : null,
            ].filter(Boolean).join(", ") + "."}
      </span>
    </div>
  );
}
