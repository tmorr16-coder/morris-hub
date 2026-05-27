import Link from "next/link";

export default function StudentSupportWidget() {
  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 14,
        padding: "22px 26px",
        boxShadow: "var(--shadow-card)",
        minHeight: 320,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h2 className="serif" style={{ fontSize: 24, marginBottom: 4 }}>
        📚 Student Support
      </h2>
      <p style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 20, flex: 1 }}>
        Manage courses, track assignments, create reminders, and organize flashcards.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Link
          href="/home/student-support"
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid var(--color-accent-dark)",
            background: "var(--color-accent)",
            color: "#FFFDF8",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          Go to Student Support
        </Link>
      </div>
    </div>
  );
}
