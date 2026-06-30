export const dynamic = "force-dynamic";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PlatformMenu from "@/components/PlatformMenu";

const PRESETS = [
  {
    key: "ai900",
    name: "Microsoft Azure AI Fundamentals",
    vendor: "Microsoft",
    exam_code: "AI-900",
    description: "Foundation-level knowledge of machine learning and AI concepts, and related Microsoft Azure services.",
    color_tag: "#0078D4",
  },
  {
    key: "az900",
    name: "Microsoft Azure Fundamentals",
    vendor: "Microsoft",
    exam_code: "AZ-900",
    description: "Cloud concepts, core Azure services, security, compliance, privacy, pricing, and support.",
    color_tag: "#0078D4",
  },
  {
    key: "claude-arch",
    name: "Claude Certified Architect – Foundations",
    vendor: "Anthropic",
    exam_code: "CCA-F",
    description: "Design and build production-ready systems with Claude APIs, agentic patterns, and responsible AI principles.",
    color_tag: "#C97A3A",
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function CertificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: certs, error } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[certifications] fetch error:", error.message);
  }

  const certList = certs ?? [];

  // Fetch question counts per exam
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let questionCounts: Record<string, number> = {};
  if (certList.length > 0) {
    const examIds = certList.map((c: any) => c.id);
    const { data: qRows } = await db
      .schema("student_support")
      .from("cert_questions")
      .select("exam_id")
      .in("exam_id", examIds);
    for (const row of qRows ?? []) {
      questionCounts[row.exam_id] = (questionCounts[row.exam_id] ?? 0) + 1;
    }
  }

  const menuUser = {
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin: false,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <PlatformMenu currentApp="student-success" user={menuUser} />

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 28px 100px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <Link
              href="/student-success"
              style={{ fontSize: 12, color: "var(--color-accent)", textDecoration: "none" }}
            >
              ← Student Success
            </Link>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 32,
                fontWeight: 400,
                margin: "8px 0 4px",
                letterSpacing: "-0.01em",
              }}
            >
              Certification Prep
            </h1>
            <p style={{ fontSize: 14, color: "var(--color-ink-3)", margin: 0 }}>
              Study for cloud, AI, and professional certifications
            </p>
          </div>
          <Link
            href="/student-success/certifications/new"
            style={{
              padding: "10px 22px",
              borderRadius: 10,
              background: "var(--color-accent)",
              color: "#fff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            + Add certification
          </Link>
        </div>

        {certList.length === 0 ? (
          /* Empty state with preset cards */
          <div>
            <p
              style={{
                fontSize: 14,
                color: "var(--color-ink-3)",
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              No certifications yet. Start with a popular one or add your own.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 20,
              }}
            >
              {PRESETS.map((preset) => (
                <div
                  key={preset.key}
                  style={{
                    background: "var(--color-bg-raised)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  {/* Color bar */}
                  <div
                    style={{
                      height: 4,
                      background: preset.color_tag,
                    }}
                  />
                  <div style={{ padding: "20px 22px 22px" }}>
                    <div
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        color: preset.color_tag,
                        background: `${preset.color_tag}18`,
                        border: `1px solid ${preset.color_tag}40`,
                        borderRadius: 5,
                        padding: "2px 8px",
                        marginBottom: 10,
                      }}
                    >
                      {preset.exam_code}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 16,
                        fontWeight: 500,
                        color: "var(--color-ink)",
                        marginBottom: 4,
                        lineHeight: 1.3,
                      }}
                    >
                      {preset.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--color-ink-3)",
                        marginBottom: 4,
                      }}
                    >
                      {preset.vendor}
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--color-ink-2)",
                        lineHeight: 1.5,
                        marginBottom: 18,
                        marginTop: 8,
                      }}
                    >
                      {preset.description}
                    </p>
                    <Link
                      href={`/student-success/certifications/new?preset=${preset.key}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 18px",
                        borderRadius: 8,
                        background: preset.color_tag,
                        color: "#fff",
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Start prep →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Cert grid */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {certList.map((cert: any) => {
              const qCount = questionCounts[cert.id] ?? 0;
              const accentColor = cert.color_tag ?? "var(--color-accent)";
              return (
                <div
                  key={cert.id}
                  style={{
                    background: "var(--color-bg-raised)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  {/* Color bar */}
                  <div style={{ height: 4, background: accentColor }} />
                  <div style={{ padding: "18px 20px 20px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      {/* Accent dot */}
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: accentColor,
                          flexShrink: 0,
                        }}
                      />
                      {cert.exam_code && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            color: accentColor,
                            background: `${accentColor}18`,
                            border: `1px solid ${accentColor}40`,
                            borderRadius: 5,
                            padding: "2px 8px",
                          }}
                        >
                          {cert.exam_code}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 16,
                        fontWeight: 500,
                        color: "var(--color-ink)",
                        lineHeight: 1.3,
                        marginBottom: 4,
                      }}
                    >
                      {cert.name}
                    </div>
                    {cert.vendor && (
                      <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 8 }}>
                        {cert.vendor}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                      {cert.target_exam_date && (
                        <div>
                          <div style={{ fontSize: 10, color: "var(--color-ink-4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Target date
                          </div>
                          <div style={{ fontSize: 13, color: "var(--color-ink-2)", fontWeight: 500 }}>
                            {formatDate(cert.target_exam_date)}
                          </div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 10, color: "var(--color-ink-4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Questions
                        </div>
                        <div style={{ fontSize: 13, color: "var(--color-ink-2)", fontWeight: 500 }}>
                          {qCount}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/student-success/certifications/${cert.id}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 18px",
                        borderRadius: 8,
                        background: accentColor,
                        color: "#fff",
                        textDecoration: "none",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      Study →
                    </Link>
                  </div>
                </div>
              );
            })}

            {/* Add another card */}
            <Link
              href="/student-success/certifications/new"
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--color-bg-sunk)",
                  border: "1px dashed var(--color-line-2)",
                  borderRadius: 14,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 160,
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 28, color: "var(--color-ink-4)" }}>+</div>
                <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>Add certification</div>
              </div>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
