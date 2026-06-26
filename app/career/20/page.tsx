export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import RelationshipsPageClient from "./_components/RelationshipsPageClient";

const RELATIONSHIP_TYPES = ["mentor", "coach", "peer", "sponsor", "community"];

const TYPE_LABELS: Record<string, string> = {
  mentor: "Mentors",
  coach: "Coaches",
  peer: "Peers",
  sponsor: "Sponsors",
  community: "Community",
};

const TYPE_COLORS: Record<string, string> = {
  mentor:    "#3B5C7F",
  coach:     "#6B5B95",
  peer:      "#4A6B3A",
  sponsor:   "#C97A3A",
  community: "#2A7B7B",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function TwentyPercentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const [relationshipsResult, goalsResult] = await Promise.all([
    db
      .schema("career")
      .from("career_relationships")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    db
      .schema("career")
      .from("career_goals")
      .select("id, title, color_tag")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("title", { ascending: true }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const relationships = (relationshipsResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goals = (goalsResult.data ?? []) as any[];

  // Stats by type
  const countByType: Record<string, number> = {};
  RELATIONSHIP_TYPES.forEach((t) => { countByType[t] = 0; });
  relationships.forEach((r) => {
    const t = r.relationship_type ?? "peer";
    countByType[t] = (countByType[t] ?? 0) + 1;
  });

  // Group relationships by type
  const grouped: Record<string, typeof relationships> = {};
  RELATIONSHIP_TYPES.forEach((t) => { grouped[t] = []; });
  relationships.forEach((r) => {
    const t = r.relationship_type ?? "peer";
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(r);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "var(--font-display, serif)",
            fontSize: 28,
            fontWeight: 400,
            color: "var(--color-ink)",
            margin: "0 0 6px",
          }}
        >
          20% · Social &amp; Relationship Learning
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", margin: 0, maxWidth: 640 }}>
          20% of career development comes from relationships — mentors who guide you, peers who
          challenge you, coaches who develop you, and sponsors who advocate for you.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        {RELATIONSHIP_TYPES.map((t) => (
          <div
            key={t}
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: 10,
              padding: "12px 18px",
              borderTop: `3px solid ${TYPE_COLORS[t]}`,
              minWidth: 100,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 600, color: TYPE_COLORS[t] }}>
              {countByType[t] ?? 0}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>
              {TYPE_LABELS[t]}
            </div>
          </div>
        ))}
      </div>

      {/* Client handles forms and interactions */}
      <RelationshipsPageClient
        grouped={grouped}
        goals={goals}
        relationshipTypes={RELATIONSHIP_TYPES}
        typeLabels={TYPE_LABELS}
        typeColors={TYPE_COLORS}
      />
    </div>
  );
}
