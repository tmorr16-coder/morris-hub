export interface FamilyStatusRow {
  id: string;
  name: string;
  nextEvent: { title: string; timeLabel: string; href?: string } | null;
  status: string | null;
  hasAttention: boolean;
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export default function FamilyStatus({ rows }: { rows: FamilyStatusRow[] }) {
  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
      }}
    >
      {rows.map((row, i) => {
        const body = (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 18px",
              borderTop: i > 0 ? "1px solid var(--color-rule-soft)" : "none",
            }}
          >
            {/* Avatar */}
            <span
              style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "var(--color-accent-soft)", color: "var(--color-accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              {initials(row.name)}
            </span>

            {/* Name + status line */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                  {row.name}
                </span>
                {row.hasAttention && (
                  <span
                    aria-label="Needs attention"
                    title="Needs attention"
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-amber)", flexShrink: 0 }}
                  />
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-ink-3)", fontFamily: "var(--font-geist, system-ui), sans-serif", marginTop: 1 }}>
                {row.nextEvent
                  ? `${row.nextEvent.title} · ${row.nextEvent.timeLabel}${row.status ? ` · ${row.status}` : ""}`
                  : "Nothing scheduled"}
              </div>
            </div>
          </div>
        );

        return row.nextEvent?.href ? (
          <a key={row.id} href={row.nextEvent.href} style={{ display: "block", textDecoration: "none" }}>{body}</a>
        ) : (
          <div key={row.id}>{body}</div>
        );
      })}
    </div>
  );
}
