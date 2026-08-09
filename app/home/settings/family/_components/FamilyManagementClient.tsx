"use client";

import { useState } from "react";
import { Segmented, Chip, Icons } from "@/components/ios";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CircleMember {
  id: string;           // hub.family_members.id
  member_user_id: string | null; // null for a managed (no-login) child profile
  role: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  birth_year: number | null;
  appAccess: string[] | null; // only populated for role="child"
}

interface SentInvite {
  id: string;
  invite_email: string;
  display_name: string | null;
  role: string;
  birth_year: number | null;
  status: string;       // 'pending' | 'accepted' | 'declined'
  created_at: string;
}

interface PendingInvite {
  id: string;
  inviter_email: string;
  inviter_name: string | null;
  display_name: string | null;
  role: string;
  birth_year: number | null;
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
  pending:  "var(--ios-orange)",
  accepted: "var(--ios-green)",
  declined: "var(--ios-red)",
};
const ROLE_ACCESS: Record<string, string[]> = {
  adult: ["Today", "Family", "Kids", "Me (Health)", "Money", "Career", "Bible", "Ask Morris"],
  child: ["Today", "Kids", "Me (Health)", "Bible", "Ask Morris"],
};

const MODULE_LABELS: Record<string, string> = {
  hub: "Today / Hub", health: "Health", finance: "Finance", investments: "Investments",
  career: "Career", "student-success": "Kids / School", bible: "Bible",
};
const EDITABLE_MODULES = ["hub", "health", "student-success", "bible", "career", "finance", "investments"];

function initials(name: string | null, email: string | null): string {
  const src = name ?? email ?? "?";
  return src.split(/[\s@]/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function age(birthYear: number | null): number | null {
  return birthYear ? new Date().getFullYear() - birthYear : null;
}

const chip = (label: string, color: string): React.CSSProperties => ({
  fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
  padding: "3px 9px", borderRadius: 999,
  background: `${color}1f`, color,
});

const avatarStyle = (bg: string): React.CSSProperties => ({
  width: 38, height: 38, borderRadius: "50%", background: bg,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 14, fontWeight: 700, color: "var(--ios-tint)", flexShrink: 0,
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
  const [inviteBirthYear, setInviteBirthYear] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Pending response state
  const [responding, setResponding] = useState<string | null>(null);

  // Child access editor state
  const [editingAccessId, setEditingAccessId] = useState<string | null>(null);
  const [draftAccess, setDraftAccess] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);

  // Rename (per-member nickname / managed-child display name) state
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  function openNameEditor(member: CircleMember) {
    setEditingAccessId(null); // don't show both editors on one row
    setEditingNameId(member.id);
    setNameDraft(member.display_name ?? member.full_name ?? "");
  }

  async function saveName(member: CircleMember) {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setSavingName(true);
    // Real members: set a per-member nickname. Managed children (no login):
    // set their display_name directly.
    const res = member.member_user_id
      ? await fetch("/api/family/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ member_user_id: member.member_user_id, nickname: trimmed }),
        })
      : await fetch("/api/family/managed-children", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: member.id, display_name: trimmed }),
        });
    setSavingName(false);
    if (res.ok) {
      setCircle((prev) => prev.map((m) => (m.id === member.id ? { ...m, display_name: trimmed } : m)));
      setEditingNameId(null);
    }
  }

  function openAccessEditor(member: CircleMember) {
    if (!member.member_user_id) return; // managed children have no access flags to edit
    setEditingAccessId(member.member_user_id);
    setDraftAccess(member.appAccess ?? []);
  }

  function toggleDraftModule(mod: string) {
    setDraftAccess((prev) => prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]);
  }

  async function saveAccess(memberUserId: string) {
    setSavingAccess(true);
    const res = await fetch(`/api/family/members/${memberUserId}/access`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_access: draftAccess }),
    });
    setSavingAccess(false);
    if (res.ok) {
      setCircle((prev) => prev.map((m) => m.member_user_id === memberUserId ? { ...m, appAccess: draftAccess } : m));
      setEditingAccessId(null);
    }
  }

  async function promoteToAdult(memberUserId: string) {
    if (!confirm("Give this person full adult privacy? Their access resets to everything, and parent visibility into their school data ends.")) return;
    setPromoting(memberUserId);
    const res = await fetch(`/api/family/members/${memberUserId}/promote-adult`, { method: "PATCH" });
    setPromoting(null);
    if (res.ok) {
      setCircle((prev) => prev.map((m) => m.member_user_id === memberUserId ? { ...m, role: "adult", appAccess: null } : m));
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    const res = await fetch("/api/family/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_email: inviteEmail,
        display_name: inviteName,
        role: inviteRole,
        birth_year: inviteBirthYear || null,
      }),
    });
    const data = await res.json();
    setInviting(false);
    if (!res.ok) { setInviteError(data.error ?? "Failed to send invite"); return; }
    setInviteSuccess(true);
    setSent((prev) => [data.invite, ...prev.filter((i) => i.invite_email !== inviteEmail)]);
    setInviteEmail(""); setInviteName(""); setInviteBirthYear("");
  }

  // Managed (no-login) child profile — for elementary-age kids with no email of their own.
  const [managedName, setManagedName] = useState("");
  const [managedBirthYear, setManagedBirthYear] = useState("");
  const [addingManaged, setAddingManaged] = useState(false);
  const [managedError, setManagedError] = useState<string | null>(null);

  async function addManagedChild(e: React.FormEvent) {
    e.preventDefault();
    setAddingManaged(true);
    setManagedError(null);
    const res = await fetch("/api/family/managed-children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: managedName, birth_year: managedBirthYear || null }),
    });
    const data = await res.json();
    setAddingManaged(false);
    if (!res.ok) { setManagedError(data.error ?? "Failed to add child"); return; }
    setCircle((prev) => [...prev, data.member]);
    setManagedName(""); setManagedBirthYear("");
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
    width: "100%", padding: "11px 14px", border: "0.5px solid var(--ios-separator)",
    borderRadius: 10, background: "var(--ios-bg)", color: "var(--ios-label)",
    fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const SH = ({ children }: { children: React.ReactNode }) => (
    <div className="ios-group-header" style={{ padding: "0 4px 7px" }}>
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
                    {age(inv.birth_year) !== null && ` · Age ${age(inv.birth_year)}`}
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
              const memberAge = age(m.birth_year);
              const isCollegeAge = m.role === "child" && !!m.member_user_id && memberAge !== null && memberAge >= 18;
              return (
                <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 10 }}>
                    <div style={avatarStyle("var(--color-accent-soft)")}>{initials(name, m.email)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{name}</div>
                      <div style={{ fontSize: 11, color: "var(--color-ink-4)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{m.email}</div>
                    </div>
                    <span style={chip(ROLE_LABELS[m.role] ?? m.role, m.role === "child" ? "#6B5B95" : "var(--color-accent)")}>
                      {ROLE_LABELS[m.role] ?? m.role}{memberAge !== null && ` · ${memberAge}`}
                    </span>
                    {m.role === "child" && !m.member_user_id && (
                      <span style={{ fontSize: 10, color: "var(--color-ink-4)", fontStyle: "italic" }}>Managed profile</span>
                    )}
                    {m.role === "child" && m.member_user_id && (
                      <button
                        onClick={() => editingAccessId === m.member_user_id ? setEditingAccessId(null) : openAccessEditor(m)}
                        style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {editingAccessId === m.member_user_id ? "Cancel" : "Edit access"}
                      </button>
                    )}
                    <button
                      onClick={() => (editingNameId === m.id ? setEditingNameId(null) : openNameEditor(m))}
                      style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {editingNameId === m.id ? "Cancel" : "Edit name"}
                    </button>
                    <button
                      onClick={() => removeMember(m.id)}
                      style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Remove
                    </button>
                  </div>

                  {isCollegeAge && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                      padding: "10px 16px", background: "rgba(184,138,46,0.08)", border: "1px solid var(--color-amber)", borderRadius: 10,
                    }}>
                      <span style={{ fontSize: 12, color: "var(--color-ink-2)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
                        {name} turned {memberAge} — consider switching to adult privacy.
                      </span>
                      <button
                        onClick={() => promoteToAdult(m.member_user_id as string)}
                        disabled={promoting === m.member_user_id}
                        style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", borderRadius: 7, border: "none", background: "var(--color-amber)", color: "#fff", cursor: "pointer", flexShrink: 0 }}
                      >
                        {promoting === m.member_user_id ? "…" : "Give adult privacy"}
                      </button>
                    </div>
                  )}

                  {editingNameId === m.id && (
                    <div style={{ padding: "14px 16px", background: "var(--color-bg-deep)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-ink-4)" }}>
                        {m.member_user_id ? "Name in your circle" : "Display name"}
                      </div>
                      <input
                        type="text"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        placeholder="e.g. Alicia"
                        style={inp}
                      />
                      <button
                        onClick={() => saveName(m)}
                        disabled={savingName || !nameDraft.trim()}
                        style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", cursor: savingName ? "wait" : "pointer", opacity: savingName || !nameDraft.trim() ? 0.6 : 1 }}
                      >
                        {savingName ? "Saving…" : "Save name"}
                      </button>
                    </div>
                  )}

                  {!!m.member_user_id && editingAccessId === m.member_user_id && (
                    <div style={{ padding: "14px 16px", background: "var(--color-bg-deep)", borderRadius: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-ink-4)" }}>
                        {name}&apos;s access
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {EDITABLE_MODULES.map((mod) => {
                          const checked = draftAccess.includes(mod);
                          return (
                            <Chip key={mod} small selected={checked} onClick={() => toggleDraftModule(mod)}>
                              {MODULE_LABELS[mod] ?? mod}
                            </Chip>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => saveAccess(m.member_user_id as string)}
                        disabled={savingAccess}
                        style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", cursor: "pointer" }}
                      >
                        {savingAccess ? "Saving…" : "Save access"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section 1b: Managed (no-login) child profile ── */}
      <section>
        <SH>Add a managed child profile</SH>
        <p style={{ fontSize: 12, color: "var(--color-ink-4)", margin: "0 0 12px", fontFamily: "var(--font-geist, system-ui), sans-serif", lineHeight: 1.5 }}>
          For younger kids with no email of their own — you&apos;ll manage everything on their behalf. Older kids who want their own login should use the invite form below instead.
        </p>
        <form onSubmit={addManagedChild} style={{ display: "flex", flexDirection: "column", gap: 10, background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-3)", display: "block", marginBottom: 5, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Name *</label>
              <input type="text" required value={managedName} onChange={(e) => setManagedName(e.target.value)} placeholder="e.g. Emma" style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-3)", display: "block", marginBottom: 5, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Birth year</label>
              <input
                aria-label="Birth year"
                type="number"
                value={managedBirthYear}
                onChange={(e) => setManagedBirthYear(e.target.value)}
                placeholder="e.g. 2018"
                min={new Date().getFullYear() - 100}
                max={new Date().getFullYear()}
                style={inp}
              />
            </div>
          </div>
          {managedError && <div style={{ fontSize: 12, color: "var(--color-red)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>{managedError}</div>}
          <button type="submit" disabled={addingManaged} style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600, cursor: addingManaged ? "wait" : "pointer", fontFamily: "inherit", alignSelf: "flex-start", opacity: addingManaged ? 0.7 : 1 }}>
            {addingManaged ? "Adding…" : "Add child"}
          </button>
        </form>
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
            <label style={{ fontSize: 13, fontWeight: 400, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--ios-label-2)", display: "block", marginBottom: 7 }}>Role</label>
            <Segmented
              ariaLabel="Invite role"
              value={inviteRole}
              onChange={(v) => setInviteRole(v)}
              options={[
                { value: "adult", label: "Adult" },
                { value: "child", label: "Child" },
              ]}
              style={{ margin: 0 }}
            />
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>
              {inviteRole === "adult" ? "Full access to all modules." : "Limited access — you manage what they see."}
            </div>
          </div>
          {inviteRole === "child" && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-3)", display: "block", marginBottom: 5, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>Birth year (optional)</label>
              <input
                aria-label="Birth year (optional)"
                type="number"
                value={inviteBirthYear}
                onChange={(e) => setInviteBirthYear(e.target.value)}
                placeholder="e.g. 2016"
                min={new Date().getFullYear() - 100}
                max={new Date().getFullYear()}
                style={{ ...inp, maxWidth: 140 }}
              />
            </div>
          )}
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
                    {ROLE_LABELS[inv.role] ?? inv.role}{age(inv.birth_year) !== null && ` · Age ${age(inv.birth_year)}`} · Sent {fmtDate(inv.created_at)}
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
      <section style={{ background: "var(--ios-fill-2)", borderRadius: "var(--ios-radius-card)", padding: "18px 20px" }}>
        <SH>Role permissions</SH>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {(["adult", "child"] as const).map((role) => (
            <div key={role}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "var(--ios-label)", marginBottom: 8 }}>
                {role === "adult"
                  ? <Icons.PersonIcon style={{ width: 16, height: 16, color: "var(--ios-tint)" }} />
                  : <Icons.PeopleIcon style={{ width: 16, height: 16, color: "var(--ios-tint)" }} />}
                {role === "adult" ? "Adult" : "Child"} — {role === "adult" ? "Full access" : "Limited access"}
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                {ROLE_ACCESS[role].map((module) => (
                  <li key={module} className="ios-footnote" style={{ color: "var(--ios-label-2)", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ios-green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>
                    {module}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 12, marginBottom: 0, lineHeight: 1.5 }}>
          Each person controls their own data. Joining a circle enables shared family features but does not automatically expose private data. Finance, career, and investment information is always private.
        </p>
      </section>
    </div>
  );
}
