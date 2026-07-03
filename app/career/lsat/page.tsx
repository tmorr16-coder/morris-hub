export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { LargeTitle, Group, Cell, IconBadge, GlanceGrid, GlanceTile, BarRows, Icons } from "@/components/ios";
import GenerateQuestionsButton from "./_components/GenerateQuestionsButton";

export default async function LSATPrepPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/");
  const prefs = await getPreferences(userId);
  if (!prefs.app_access?.includes("career")) redirect("/home");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Check LSAT is enabled for this user
  const { data: settings } = await db
    .schema("student_support").from("student_settings")
    .select("lsat_enabled, lsat_target_score")
    .eq("user_id", userId).maybeSingle();

  if (!settings?.lsat_enabled) redirect("/career/settings");

  // Question types (for generate UI)
  const { data: questionTypes } = await db
    .schema("student_support")
    .from("lsat_question_types")
    .select("id, section, category, subcategory")
    .order("section").order("category").order("subcategory");

  // Recent sessions
  const { data: recentSessions } = await db
    .schema("student_support").from("lsat_practice_sessions")
    .select("id, mode, section, started_at, ended_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(5);

  // All attempts — manual aggregation (no separate RPC needed)
  const { data: allAttempts } = await db
    .schema("student_support").from("lsat_attempts")
    .select("confidence, is_correct")
    .eq("user_id", userId);

  const calibrationData: { conf_band: string; is_correct: boolean; n: number }[] = [];
  if (allAttempts) {
    const groups = new Map<string, number>();
    for (const a of allAttempts) {
      const key = `${(a.confidence ?? 3) >= 4 ? "confident" : "unsure"}|${a.is_correct}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    for (const [k, n] of groups) {
      const [conf_band, correct] = k.split("|");
      calibrationData.push({ conf_band, is_correct: correct === "true", n });
    }
  }

  // Flagged (blind review queue)
  const { data: flaggedAttempts } = await db
    .schema("student_support").from("lsat_attempts")
    .select("id, question_id, answered_at, lsat_questions!inner(stem)")
    .eq("user_id", userId)
    .eq("flagged", true)
    .is("lsat_review_notes.attempt_id", null)
    .order("answered_at", { ascending: false })
    .limit(10);

  const totalAttempts = allAttempts?.length ?? 0;
  const correct = allAttempts?.filter((a: { is_correct: boolean }) => a.is_correct).length ?? 0;
  const accuracy = totalAttempts > 0 ? Math.round(correct / totalAttempts * 100) : null;
  const flaggedCount = flaggedAttempts?.length ?? 0;

  const modeLabels: Record<string, string> = {
    drill: "Drill", timed_section: "Timed Section", full_mock: "Full Mock", blind_review: "Blind Review",
  };

  const calGet = (conf: string, isCorrect: boolean) =>
    calibrationData.find((d) => d.conf_band === conf && d.is_correct === isCorrect)?.n ?? 0;

  return (
    <div className="ios-scroll">
      <LargeTitle title="LSAT" subtitle={settings?.lsat_target_score ? `Target score · ${settings.lsat_target_score}` : "Error log · Blind review · Calibration"} />

      <GlanceGrid>
        <GlanceTile label="Questions" value={totalAttempts} sub="attempted" href="/career/lsat/practice" />
        <GlanceTile label="Accuracy" value={accuracy != null ? `${accuracy}%` : "—"} sub="all time" href="/career/lsat/analytics" accent={accuracy != null && accuracy >= 70 ? "var(--ios-green)" : accuracy != null && accuracy >= 50 ? "var(--ios-orange)" : "var(--ios-red)"} />
        <GlanceTile label="Flagged" value={flaggedCount} sub="for review" href="/career/lsat/review" accent="var(--ios-orange)" />
        {settings?.lsat_target_score != null && (
          <GlanceTile label="Target" value={settings.lsat_target_score} sub="goal score" href="/career/lsat/analytics" accent="#B565A7" />
        )}
      </GlanceGrid>

      <div style={{ display: "flex", gap: 10, padding: "14px 16px 0", flexWrap: "wrap" }}>
        <GenerateQuestionsButton questionTypes={questionTypes ?? []} />
      </div>

      <Group header="Practice">
        <Cell href="/career/lsat/practice" lead={<IconBadge color="var(--ios-tint)"><Icons.PlusIcon /></IconBadge>} title="New session" subtitle="Choose a mode & configure" />
        <Cell href="/career/lsat/practice?mode=drill&section=LR" lead={<IconBadge color="#2E7D46"><Icons.ChecklistIcon /></IconBadge>} title="Drill — LR" subtitle="Specific question types, untimed" />
        <Cell href="/career/lsat/practice?mode=drill&section=RC" lead={<IconBadge color="#8B6A47"><Icons.BookIcon /></IconBadge>} title="Drill — RC" subtitle="Reading comprehension passages" />
        <Cell href="/career/lsat/practice?mode=blind_review" lead={<IconBadge color="var(--ios-orange)"><Icons.TrendUpIcon /></IconBadge>} title="Blind review" subtitle="Re-examine flagged questions" />
        <Cell href="/career/lsat/chat" lead={<IconBadge color="#5E5CE6"><Icons.SparkleIcon /></IconBadge>} title="LSAT Tutor" subtitle="Techniques, question types & strategy" />
      </Group>

      <Group header="Insights">
        <Cell href="/career/lsat/analytics" lead={<IconBadge color="var(--ios-tint)"><Icons.ChartIcon /></IconBadge>} title="Analytics" subtitle="Calibration & error patterns" />
        <Cell href="/career/lsat/review" lead={<IconBadge color="var(--ios-orange)"><Icons.ChecklistIcon /></IconBadge>} title="Review queue" subtitle={flaggedCount > 0 ? `${flaggedCount} flagged` : "Blind review"} />
      </Group>

      {calibrationData.length > 0 && (
        <div className="ios-list" style={{ margin: "14px 16px 0", padding: "4px 0 6px" }}>
          <div className="ios-group-header" style={{ padding: "12px 16px 0" }}>Confidence calibration</div>
          <BarRows
            items={[
              { label: "Confident & right", value: calGet("confident", true), color: "#2E7D46" },
              { label: "Confident & wrong", value: calGet("confident", false), color: "#C0392B" },
              { label: "Unsure & right", value: calGet("unsure", true), color: "#E08600" },
              { label: "Unsure & wrong", value: calGet("unsure", false), color: "#8E8E93" },
            ]}
          />
          <div className="ios-footnote" style={{ padding: "0 16px", color: "var(--ios-label-2)" }}>Confident &amp; wrong is your highest-priority gap.</div>
        </div>
      )}

      {flaggedCount > 0 && (
        <Group header="Blind review queue" footer="Re-examine flagged questions before seeing the answer.">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(flaggedAttempts ?? []).slice(0, 5).map((a: any) => (
            <Cell
              key={a.id}
              href={`/career/lsat/review/${a.id}`}
              lead={<IconBadge color="var(--ios-orange)"><Icons.ChecklistIcon /></IconBadge>}
              title={`${a.lsat_questions?.stem?.slice(0, 60) ?? "Flagged question"}…`}
              subtitle={new Date(a.answered_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            />
          ))}
        </Group>
      )}

      {(recentSessions?.length ?? 0) > 0 && (
        <Group header="Recent sessions">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(recentSessions ?? []).map((s: any) => (
            <Cell
              key={s.id}
              href={s.ended_at ? undefined : `/career/lsat/session/${s.id}`}
              chevron={!s.ended_at}
              lead={<IconBadge color="#8E8E93"><Icons.BriefcaseIcon /></IconBadge>}
              title={modeLabels[s.mode] ?? s.mode}
              subtitle={[s.section, new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })].filter(Boolean).join(" · ")}
              trailing={!s.ended_at ? <span className="ios-subhead" style={{ color: "var(--ios-tint)", fontWeight: 600 }}>Resume</span> : undefined}
            />
          ))}
        </Group>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}
