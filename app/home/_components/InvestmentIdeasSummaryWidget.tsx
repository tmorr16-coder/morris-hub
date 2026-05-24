import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function InvestmentIdeasSummaryWidget() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch investment ideas summary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: ideas } = await service
    .schema("hub")
    .from("investment_ideas")
    .select("id, status, is_favorite")
    .eq("user_id", user.id);

  const ideaList = ideas || [];
  const statusCounts = {
    new: ideaList.filter((i: any) => i.status === "new").length,
    researching: ideaList.filter((i: any) => i.status === "researching").length,
    pursuing: ideaList.filter((i: any) => i.status === "pursuing").length,
    passed: ideaList.filter((i: any) => i.status === "passed").length,
  };

  const favoriteCount = ideaList.filter((i: any) => i.is_favorite).length;
  const totalIdeas = ideaList.length;

  const card: React.CSSProperties = {
    background: "var(--color-bg-card)",
    border: "1px solid var(--color-rule)",
    borderRadius: 12,
    padding: "20px 24px",
    boxShadow: "var(--shadow-card)",
    minHeight: 320,
    height: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
  };

  const statStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid var(--color-rule)",
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--color-ink-2)",
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    color: "var(--color-accent)",
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 className="serif" style={{ fontSize: 20, marginBottom: 4, marginTop: 0 }}>
          Investment Ideas
        </h2>
        <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: 0 }}>
          Track and research opportunities
        </p>
      </div>

      {/* Statistics */}
      {totalIdeas === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 12 }}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: 0 }}>
            Start exploring investment ideas
          </p>
          <p style={{ fontSize: 11, color: "var(--color-ink-3)", margin: 0 }}>
            Browse AI suggestions or add your own
          </p>
        </div>
      ) : (
        <>
          <div style={statStyle}>
            <span style={statLabelStyle}>Total Ideas</span>
            <span style={statValueStyle}>{totalIdeas}</span>
          </div>
          <div style={statStyle}>
            <span style={statLabelStyle}>⭐ Favorites</span>
            <span style={statValueStyle}>{favoriteCount}</span>
          </div>
          <div style={statStyle}>
            <span style={statLabelStyle}>🆕 New</span>
            <span style={statValueStyle}>{statusCounts.new}</span>
          </div>
          <div style={statStyle}>
            <span style={statLabelStyle}>🔍 Researching</span>
            <span style={statValueStyle}>{statusCounts.researching}</span>
          </div>
          <div style={statStyle}>
            <span style={statLabelStyle}>🎯 Pursuing</span>
            <span style={statValueStyle}>{statusCounts.pursuing}</span>
          </div>
          <div style={{ ...statStyle, borderBottom: "none" }}>
            <span style={statLabelStyle}>✓ Passed</span>
            <span style={statValueStyle}>{statusCounts.passed}</span>
          </div>
        </>
      )}

      {/* CTA */}
      <div style={{ marginTop: "auto", paddingTop: 12 }}>
        <Link
          href="/home/investments"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--color-accent)",
            color: "#FFFDF8",
            textDecoration: "none",
            fontSize: 12,
            fontWeight: 500,
            transition: "all 0.2s",
          }}
        >
          <span>View all ideas</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
