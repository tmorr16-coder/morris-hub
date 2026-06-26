export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ExperiencesPageClient from "./_components/ExperiencesPageClient";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const EXPERIENCE_TYPE_COLORS: Record<string, string> = {
  project:       "#3B5C7F",
  presentation:  "#6B5B95",
  leadership:    "#C97A3A",
  challenge:     "#9A3B2A",
  collaboration: "#4A6B3A",
  mentoring:     "#2A7B7B",
  feedback:      "#7B6A2A",
  other:         "#8A8278",
};

export default async function SeventyPercentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const [experiencesResult, goalsResult] = await Promise.all([
    db
      .schema("career")
      .from("career_experiences")
      .select("*")
      .eq("user_id", user.id)
      .order("experience_date", { ascending: false })
      .limit(50),
    db
      .schema("career")
      .from("career_goals")
      .select("id, title, color_tag, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("title", { ascending: true }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const experiences = (experiencesResult.data ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goals = (goalsResult.data ?? []) as any[];

  // Stats
  const totalExperiences = experiences.length;
  const now = new Date();
  const thisMonthCount = experiences.filter((e) => {
    if (!e.experience_date) return false;
    const d = new Date(e.experience_date + "T00:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Top skills
  const skillCounts: Record<string, number> = {};
  experiences.forEach((e) => {
    (e.skills_developed ?? []).forEach((s: string) => {
      const key = s.trim().toLowerCase();
      if (key) skillCounts[key] = (skillCounts[key] ?? 0) + 1;
    });
  });
  const topSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([skill]) => skill);

  // Build a goals lookup map
  const goalsMap: Record<string, string> = {};
  goals.forEach((g) => { goalsMap[g.id] = g.title; });

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
          70% · On-the-Job Learning
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)", margin: 0, maxWidth: 640 }}>
          70% of effective career development happens through challenging on-the-job experiences —
          stretch assignments, new projects, leading teams, solving hard problems, and learning from setbacks.
        </p>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        {[
          { label: "Total Experiences", value: totalExperiences },
          { label: "This Month", value: thisMonthCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: 10,
              padding: "14px 20px",
              minWidth: 130,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 600, color: "var(--color-accent)" }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}

        {topSkills.length > 0 && (
          <div
            style={{
              background: "var(--color-bg-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: 10,
              padding: "14px 20px",
              flex: 1,
              minWidth: 200,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 8 }}>
              Top Skills Developed
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {topSkills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    background: "var(--color-accent-soft)",
                    color: "var(--color-accent-dark)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 12,
                    fontWeight: 500,
                    textTransform: "capitalize",
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Client component handles form and list interactivity */}
      <ExperiencesPageClient
        experiences={experiences}
        goals={goals}
        goalsMap={goalsMap}
        typeColors={EXPERIENCE_TYPE_COLORS}
      />
    </div>
  );
}
