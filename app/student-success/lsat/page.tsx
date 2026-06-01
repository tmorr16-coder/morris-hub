export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import PlatformMenu from "@/components/PlatformMenu";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";

function CalibrationMatrix({ data }: {
  data: { conf_band: string; is_correct: boolean; n: number }[];
}) {
  const get = (conf: string, correct: boolean) =>
    data.find((d) => d.conf_band === conf && d.is_correct === correct)?.n ?? 0;

  const cells = [
    { label: "Confident & Right",   conf: "confident", correct: true,  color: "#4A6B3A", bg: "rgba(74,107,58,0.1)",   note: "Mastered" },
    { label: "Confident & Wrong",   conf: "confident", correct: false, color: "#9A3B2A", bg: "rgba(154,59,42,0.12)", note: "Priority — dangerous gap" },
    { label: "Unsure & Right",      conf: "unsure",    correct: true,  color: "#B88A2E", bg: "rgba(184,138,46,0.1)", note: "Lucky / shaky" },
    { label: "Unsure & Wrong",      conf: "unsure",    correct: false, color: "#6B6258", bg: "rgba(107,98,88,0.08)", note: "Still learning" },
  ];
  const total = data.reduce((s, d) => s + d.n, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {cells.map((c) => {
        const n = get(c.conf, c.correct);
        return (
          <div key={c.label} style={{
            padding: "14px 16px", borderRadius: 10,
            background: c.bg, border: `1px solid ${c.color}30`,
          }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{n}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.color, marginBottom: 2 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: "var(--color-ink-3)" }}>{c.note}</div>
            {total > 0 && <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 4 }}>{Math.round(n / total * 100)}% of all attempts</div>}
          </div>
        );
      })}
    </div>
  );
}

export default async function LSATPrepPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/");
  const prefs = await getPreferences(userId);
  if (!prefs.app_access?.includes("student-success")) redirect("/home");

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

  if (!settings?.lsat_enabled) redirect("/student-success/settings");

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

  const menuUser = {
    email: user.email,
    name: user.user_metadata?.full_name ?? user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? null,
    isAdmin: false,
  };

  const totalAttempts = allAttempts?.length ?? 0;
  const correct = allAttempts?.filter((a: { is_correct: boolean }) => a.is_correct).length ?? 0;
  const accuracy = totalAttempts > 0 ? Math.round(correct / totalAttempts * 100) : null;

  const modeLabels: Record<string, string> = {
    drill: "Drill", timed_section: "Timed Section", full_mock: "Full Mock", blind_review: "Blind Review",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <PlatformMenu currentApp="student-success" user={menuUser} />

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 28px 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <Link href="/student-success" style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}>
              ← Student Success
            </Link>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 400, margin: "8px 0 4px", letterSpacing: "-0.01em" }}>
              LSAT Prep
            </h1>
            <p style={{ fontSize: 14, color: "var(--color-ink-3)", margin: 0 }}>
              {settings?.lsat_target_score
                ? `Target score: ${settings.lsat_target_score}`
                : "Error log · Blind review · Confidence calibration"}
            </p>
          </div>
          <Link href="/student-success/lsat/practice" style={{
            padding: "10px 22px", borderRadius: 10, background: "var(--color-accent)",
            color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600,
          }}>
            + New Session
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Left column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Stats */}
            <div style={{
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
              borderRadius: 14, padding: "20px 24px", boxShadow: "var(--shadow-card)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 16 }}>
                Overview
              </div>
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--color-accent)" }}>{totalAttempts}</div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>Total questions</div>
                </div>
                {accuracy !== null && (
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: accuracy >= 70 ? "var(--color-green)" : accuracy >= 50 ? "var(--color-amber)" : "var(--color-red)" }}>
                      {accuracy}%
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>Accuracy</div>
                  </div>
                )}
                {(flaggedAttempts?.length ?? 0) > 0 && (
                  <div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: "var(--color-amber)" }}>{flaggedAttempts?.length}</div>
                    <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>For review</div>
                  </div>
                )}
              </div>
            </div>

            {/* Calibration matrix */}
            <div style={{
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
              borderRadius: 14, padding: "20px 24px", boxShadow: "var(--shadow-card)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)" }}>
                  Confidence Calibration
                </div>
                <Link href="/student-success/lsat/analytics" style={{ fontSize: 11, color: "var(--color-accent)", textDecoration: "none" }}>
                  Full analytics →
                </Link>
              </div>
              {calibrationData.length > 0
                ? <CalibrationMatrix data={calibrationData} />
                : <div style={{ fontSize: 13, color: "var(--color-ink-3)", textAlign: "center", padding: "24px 0" }}>
                    Complete some practice to see your calibration.
                  </div>
              }
            </div>

            {/* Blind review queue */}
            {(flaggedAttempts?.length ?? 0) > 0 && (
              <div style={{
                background: "var(--color-bg-card)", border: "1px solid var(--color-amber)",
                borderRadius: 14, padding: "20px 24px", boxShadow: "var(--shadow-card)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-amber)" }}>
                    🚩 Blind Review Queue
                  </div>
                  <Link href="/student-success/lsat/review" style={{ fontSize: 11, color: "var(--color-accent)", textDecoration: "none" }}>
                    Review all →
                  </Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(flaggedAttempts ?? []).slice(0, 3).map((a: any) => (
                    <Link key={a.id} href={`/student-success/lsat/review/${a.id}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        padding: "10px 14px", borderRadius: 8, background: "var(--color-bg)",
                        border: "1px solid var(--color-rule)", fontSize: 13, color: "var(--color-ink)",
                        lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {a.lsat_questions?.stem?.slice(0, 100)}…
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Quick start */}
            <div style={{
              background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
              borderRadius: 14, padding: "20px 24px", boxShadow: "var(--shadow-card)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 14 }}>
                Quick Start
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { mode: "drill", label: "Drill — LR", desc: "Practice specific question types, untimed", href: "/student-success/lsat/practice?mode=drill&section=LR" },
                  { mode: "drill", label: "Drill — RC", desc: "Reading comprehension passages", href: "/student-success/lsat/practice?mode=drill&section=RC" },
                  { mode: "blind_review", label: "Blind Review", desc: "Re-examine flagged questions before seeing answers", href: "/student-success/lsat/practice?mode=blind_review" },
                ].map((item) => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                    <div style={{
                      padding: "12px 16px", borderRadius: 10, border: "1px solid var(--color-rule)",
                      background: "var(--color-bg)", display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--color-rule)"; }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{item.label}</div>
                        <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>{item.desc}</div>
                      </div>
                      <span style={{ color: "var(--color-accent)", fontSize: 18 }}>›</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent sessions */}
            {(recentSessions?.length ?? 0) > 0 && (
              <div style={{
                background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
                borderRadius: 14, padding: "20px 24px", boxShadow: "var(--shadow-card)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-3)", marginBottom: 14 }}>
                  Recent Sessions
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(recentSessions ?? []).map((s: any) => (
                    <Link key={s.id} href={s.ended_at ? "#" : `/student-success/lsat/session/${s.id}`} style={{ textDecoration: "none" }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 14px", borderRadius: 8, border: "1px solid var(--color-rule-soft)",
                        background: "var(--color-bg)",
                      }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)" }}>{modeLabels[s.mode]}</span>
                          {s.section && <span style={{ fontSize: 12, color: "var(--color-ink-3)", marginLeft: 8 }}>· {s.section}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                            {new Date(s.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          {!s.ended_at && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-accent)", background: "var(--color-accent-soft)", padding: "2px 6px", borderRadius: 4 }}>
                              Resume
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
