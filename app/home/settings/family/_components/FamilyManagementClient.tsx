"use client";

import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CircleMember {
  id: string;           // hub.family_members.id
  member_user_id: string;
  role: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
}

interface SentInvite {
  id: string;
  invite_email: string;
  display_name: string | null;
  role: string;
  status: string;       // 'pending' | 'accepted' | 'declined'
  created_at: string;
}

interface PendingInvite {
  id: string;
  inviter_email: string;
  inviter_name: string | null;
  display_name: string | null;
  role: string;
}

interface Props {
  circle: CircleMember[];
  sentInvites: SentInvite[];
  pendingInvites: PendingInvite[];
  userId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = { adult: "Adult", child: "Child" };
const STATUS_COLOR: Record<string, string> = {
  pending:  "var(--color-amber)",
  accepted: "var(--color-green)",
  declined: "var(--color-red)",
};
const ROLE_ACCESS: Record<string, string[]> = {
  adult: ["Today", "Family", "Kids", "Me (Health)", "Money", "Career", "Bible", "Ask Morris"],
  child: ["Today", "Kids", "Me (Health)", "Bible", "Ask Morris"],
};

function initials(name: string | null, email: string | null): string {
  const src = name ?? email ?? "?";
  return src.split(/[\s@]/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const chip = (label: string, color: string): React.CSSProperties => ({
  fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
  padding: "2px 7px", borderRadius: 8,
  background: `${color}15`, color,
  fontFamily: "var(--font-geist, system-ui), sans-serif",
});

const avatarStyle = (bg: string): React.CSSProperties => ({
  width: 38, height: 38, borderRadius: "50%", background: bg,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 13, fontWeight: 700, color: "var(--color-accent)", flexShrink: 0,
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function FamilyManagementClient({
  circle: initialCircle,
  sentInvites: initialSent,
  pendingInvites: initialPending,
}: Props) {
  const [circle, setCircle] = useState(initialCircle);
  const [sent, setSent] = useState(initialSent);
  const [pending, setPending] = useState(initialPending);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"adult" | "child">("adult");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Pending response state
  const [responding, setResponding] = useState<string | null>(null);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    const res = await fetch("/api/family/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_email: inviteEmail, display_name: inviteName, role: inviteRole }),
    });
    const data = await res.json();
    setInviting(false);
    if (!res.ok) { setInviteError(data.error ?? "Failed to send invite"); return; }
    setInviteSuccess(true);
    setSent((prev) => [data.invite, ...prev.filter((i) => i.invite_email !== inviteEmail)]);
    setInviteEmail(""); setInviteName("");
  }

  async function cancelInvite(id: string) {
    await fetch(`/api/family/invite/${id}`, { method: "DELETE" });
    setSent((prev) => prev.filter((i) => i.id !== id));
  }

  async function respondToInvite(id: string, action: "accept" | "decline") {
    setResponding(id);
    const res = await fetch(`/api/family/invite/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setResponding(null);
    if (res.ok) {
      setPending((prev) => prev.filter((i) => i.id !== id));
      if (action === "accept") window.location.reload(); // refresh to show new circle member
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this person from your family circle?")) return;
    await fetch("/api/family/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circle_id: memberId }),
    });
    setCircle((prev) => prev.filter((m) => m.id !== memberId));
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", border: "1px solid var(--color-rule)",
    borderRadius: 8, background: "var(--color-bg)", color: "var(--color-ink)",
    fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const SH = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 12, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
      {children}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* ── Section 0: Pending invites addressed to this user ── */}
      {pending.length > 0 && (
        <section>
          <SH>Invitations for you — {pending.length}</SH>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((inv) => (
              <div key={inv.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 10,
                background: "rgba(59,92,127,0.05)", border: "1px solid var(--color-accent-soft)",
              }}>
                <div style={avatarStyle("var(--color-accent-soft)")}>
                  {initials(inv.inviter_name, inv.inviter_email)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                    {inv.inviter_name ?? inv.inviter_email} invited you to their family circle
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 2, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                    Role: <strong style={{ color: "var(--color-ink-3)" }}>{ROLE_LABELS[inv.role] ?? inv.role}</strong>
                    {inv.display_name && ` · Listed as "${inv.display_name}"`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => respondToInvite(inv.id, "accept")}
                    disabled={responding === inv.id}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {responding === inv.id ? "…" : "Accept"}
                  </button>
                  <button
                    onClick={() => respondToInvite(inv.id, "decline")}
                    disabled={responding === inv.id}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 1: Current circle ── */}
      <section>
        <SH>Your family circle — {circle.length}</SH>
        {circle.length === 0 ? (
          <div style={{ fontSize: 14, color: "var(--color-ink-4)", padding: "16px 0", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
            No members yet. Invite someone below.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {circle.map((m) => {
              const name = m.display_name ?? m.full_name ?? m.email ?? "Unknown";
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10 }}>
                  <div style={avatarStyle("var(--color-accent-soft)")}>{initials(name, m.email)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{name}</div>
                    <div style={{ fontSize: 11, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{m.email}</div>
                  </div>
                  <span style={chip(ROLE_LABELS[m.role] ?? m.role, m.role === "child" ? "#6B5B95" : "var(--color-accent)")}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  <button
                    onClick={() => removeMember(m.id)}
                    style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 2: Invite form ── */}
      <section>
        <SH>Invite a family member</SH>
        <form onSubmit={sendInvite} style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-3)", display: "block", marginBottom: 5, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Email address *</label>
              <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="alicia@example.com" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-3)", display: "block", marginBottom: 5, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Name (how they appear)</label>
              <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="e.g. Alicia, Emma" style={inp} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-3)", display: "block", marginBottom: 5, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Role</label>
            <div style={{ display: "flex", gap: 10 }}>
              {(["adult", "child"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setInviteRole(r)}
                  style={{
                    padding: "7px 18px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: inviteRole === r ? "1.5px solid var(--color-accent)" : "1px solid var(--color-rule)",
                    background: inviteRole === r ? "var(--color-accent-soft)" : "transparent",
                    color: inviteRole === r ? "var(--color-accent)" : "var(--color-ink-3)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {ROLE_LABELS[r]}
                  <span style={{ fontSize: 10, color: "var(--color-ink-4)", marginLeft: 6 }}>
                    {r === "adult" ? "full access" : "limited access"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {inviteError && <div style={{ fontSize: 12, color: "var(--color-red)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{inviteError}</div>}
          {inviteSuccess && <div style={{ fontSize: 12, color: "var(--color-green)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Invitation sent — they'll see it when they log in.</div>}
          <button type="submit" disabled={inviting} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, cursor: inviting ? "wait" : "pointer", fontFamily: "inherit", alignSelf: "flex-start", opacity: inviting ? 0.7 : 1 }}>
            {inviting ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </section>

      {/* ── Section 3: Sent invitations ── */}
      {sent.length > 0 && (
        <section>
          <SH>Sent invitations</SH>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sent.map((inv) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                    {inv.display_name ? `${inv.display_name} ` : ""}<span style={{ color: "var(--color-ink-4)" }}>{inv.invite_email}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 2, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                    {ROLE_LABELS[inv.role] ?? inv.role} · Sent {fmtDate(inv.created_at)}
                  </div>
                </div>
                <span style={chip(inv.status, STATUS_COLOR[inv.status] ?? "var(--color-ink-3)")}>
                  {inv.status}
                </span>
                {inv.status === "pending" && (
                  <button
                    onClick={() => cancelInvite(inv.id)}
                    style={{ fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-4)", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 4: Permission preview ── */}
      <section style={{ background: "var(--color-bg-deep)", borderRadius: 12, padding: "18px 20px" }}>
        <SH>Role permissions</SH>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {(["adult", "child"] as const).map((role) => (
            <div key={role}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink-2)", marginBottom: 8, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                {role === "adult" ? "👤 Adult" : "🧒 Child"} — {role === "adult" ? "Full access" : "Limited access"}
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                {ROLE_ACCESS[role].map((module) => (
                  <li key={module} style={{ fontSize: 12, color: "var(--color-ink-3)", fontFamily: "var(--font-geist, system-ui), sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ color: "var(--color-green)", fontSize: 10 }}>✓</span> {module}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 12, marginBottom: 0, fontFamily: "var(--font-geist, system-ui), sans-serif", lineHeight: 1.5 }}>
          Each person controls their own data. Joining a circle enables shared family features but does not automatically expose private data. Finance, career, and investment information is always private.
        </p>
      </section>
    </div>
  );
}
