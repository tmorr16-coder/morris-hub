"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteUser, cancelInvitation, updateUserRole, removeUser, updateIntegrationRequestStatus, approveUser, rejectUser, updateTicketStatus, updateAppAccess, type AppKey } from "../actions";

const ALL_APPS: AppKey[] = ["hub", "health", "finance", "investments", "career", "student-success", "children", "bible"];
const APP_LABEL: Record<AppKey, string> = {
  hub: "Hub", health: "Health", finance: "Finance",
  "student-success": "Courses", investments: "Investments",
  bible: "Bible", career: "Career", children: "Children",
};
const APP_COLOR: Record<AppKey, string> = {
  hub: "#3B5C7F", health: "#4D6B3A", finance: "#8B6A47",
  "student-success": "#6B5B95", investments: "#C97A3A",
  bible: "#6B3B7C", career: "#2A6049", children: "#C97A9B",
};

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: "admin" | "standard";
  appAccess: AppKey[];
  createdAt: string;
  isCurrentUser: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role: "admin" | "standard";
  invitedAt: string;
}

export interface PendingUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userName: string;
  userEmail: string;
  type: "bug" | "feature" | "question" | "other";
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: string;
}

export interface IntegrationRequest {
  id: string;
  userName: string;
  userEmail: string;
  integration: string;
  description: string;
  status: "pending" | "planned" | "reviewed" | "declined";
  createdAt: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Avatar({ name, avatarUrl, size = 36 }: { name: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={name} width={size} height={size} style={{ borderRadius: "50%", flexShrink: 0, objectFit: "cover" }} />;
  }
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--color-ink)", color: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 600, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function RolePill({ role }: { role: "admin" | "standard" }) {
  const isAdmin = role === "admin";
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "3px 8px", borderRadius: 999,
      background: isAdmin ? "var(--color-accent-soft)" : "var(--color-bg-deep)",
      color: isAdmin ? "var(--color-accent)" : "var(--color-ink-4)",
      border: `1px solid ${isAdmin ? "var(--color-accent)" : "var(--color-rule)"}`,
      whiteSpace: "nowrap" as const,
    }}>
      {isAdmin ? "Admin" : "Standard"}
    </span>
  );
}

// ── User Detail Modal ──────────────────────────────────────────────────────

function UserDetailModal({ user, onRoleChange, onAppAccessChange, onRemove, isPending, onClose }: {
  user: AdminUser;
  onRoleChange: (userId: string, role: "standard" | "admin") => void;
  onAppAccessChange: (userId: string, appAccess: AppKey[]) => void;
  onRemove: (userId: string) => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleApp(app: AppKey) {
    if (user.isCurrentUser) return;
    const next = user.appAccess.includes(app)
      ? user.appAccess.filter((a) => a !== app)
      : [...user.appAccess, app];
    onAppAccessChange(user.id, next);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.12)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--color-rule)", display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={user.name || user.email} avatarUrl={user.avatarUrl} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-ink)" }}>{user.name || "—"}</span>
              <RolePill role={user.role} />
              {user.isCurrentUser && <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>you</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>{user.email}</div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 2 }}>Joined {fmtDate(user.createdAt)}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--color-ink-3)", padding: "4px 6px" }}>✕</button>
        </div>

        {/* Module access */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-rule)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 12 }}>
            Module Access
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ALL_APPS.map((app) => {
              const active = user.appAccess.includes(app);
              const isHub = app === "hub";
              return (
                <div key={app} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, background: active ? APP_COLOR[app] + "0d" : "var(--color-bg-deep)", border: `1px solid ${active ? APP_COLOR[app] + "40" : "var(--color-rule)"}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: APP_COLOR[app], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>{APP_LABEL[app]}</span>
                  {isHub ? (
                    <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>Always on</span>
                  ) : (
                    <button
                      onClick={() => toggleApp(app)}
                      disabled={isPending || user.isCurrentUser}
                      style={{ width: 40, height: 22, borderRadius: 11, border: "none", background: active ? APP_COLOR[app] : "var(--color-rule)", cursor: user.isCurrentUser ? "not-allowed" : "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                      title={user.isCurrentUser ? "Cannot edit your own access" : undefined}
                    >
                      <div style={{ position: "absolute", top: 3, left: active ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Admin role + danger zone */}
        {!user.isCurrentUser && (
          <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              disabled={isPending}
              onClick={() => { onRoleChange(user.id, user.role === "admin" ? "standard" : "admin"); }}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
            >
              {user.role === "admin" ? "Revoke admin" : "Make admin"}
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} disabled={isPending}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-red)", background: "transparent", color: "var(--color-red)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                Remove user
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { onRemove(user.id); onClose(); }}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "var(--color-red)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  Confirm remove
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── User Row (tappable card) ───────────────────────────────────────────────

interface UserRowProps {
  user: AdminUser;
  onRoleChange: (userId: string, role: "standard" | "admin") => void;
  onAppAccessChange: (userId: string, appAccess: AppKey[]) => void;
  onRemove: (userId: string) => void;
  isPending: boolean;
}

function UserRow({ user, onRoleChange, onAppAccessChange, onRemove, isPending }: UserRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "box-shadow 0.15s" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
      >
        <Avatar name={user.name || user.email} avatarUrl={user.avatarUrl} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name || "—"}</span>
            <RolePill role={user.role} />
            {user.isCurrentUser && <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>you</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
            {ALL_APPS.filter((a) => user.appAccess.includes(a)).map((a) => (
              <span key={a} style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: APP_COLOR[a] + "18", color: APP_COLOR[a], letterSpacing: "0.04em" }}>
                {APP_LABEL[a]}
              </span>
            ))}
          </div>
        </div>
        <span style={{ fontSize: 16, color: "var(--color-ink-4)", flexShrink: 0 }}>›</span>
      </div>

      {open && (
        <UserDetailModal
          user={user}
          onRoleChange={onRoleChange}
          onAppAccessChange={onAppAccessChange}
          onRemove={onRemove}
          isPending={isPending}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface Props {
  users: AdminUser[];
  invitations: Invitation[];
  integrationRequests: IntegrationRequest[];
  pendingUsers: PendingUser[];
  supportTickets: SupportTicket[];
}

export default function AdminClient({ users: initialUsers, invitations: initialInvites, integrationRequests: initialRequests, pendingUsers: initialPending, supportTickets: initialTickets }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState(initialUsers);
  const [invitations, setInvitations] = useState(initialInvites);
  const [requests, setRequests] = useState(initialRequests);
  const [pending, setPending] = useState(initialPending);
  const [tickets, setTickets] = useState(initialTickets);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"standard" | "admin">("standard");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleRoleChange(userId: string, role: "standard" | "admin") {
    setActionError(null);
    startTransition(async () => {
      const result = await updateUserRole(userId, role);
      if (result.error) { setActionError(result.error); return; }
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
    });
  }

  function handleRemove(userId: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await removeUser(userId);
      if (result.error) { setActionError(result.error); return; }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      router.refresh();
    });
  }

  function handleAppAccessChange(userId: string, appAccess: AppKey[]) {
    setActionError(null);
    // Optimistic
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, appAccess } : u));
    startTransition(async () => {
      const result = await updateAppAccess(userId, appAccess);
      if (result.error) {
        setActionError(result.error);
        // Revert on error
        router.refresh();
      }
    });
  }

  function handleCancelInvite(id: string) {
    startTransition(async () => {
      await cancelInvitation(id);
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    });
  }

  function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteError(null);
    setInviteSent(false);
    startTransition(async () => {
      const result = await inviteUser(inviteEmail.trim(), inviteRole);
      if (result.error) { setInviteError(result.error); return; }
      setInviteSent(true);
      setInviteEmail("");
      router.refresh();
      setTimeout(() => setInviteSent(false), 3000);
    });
  }

  function handleRequestStatus(id: string, status: "reviewed" | "planned" | "declined") {
    startTransition(async () => {
      await updateIntegrationRequestStatus(id, status);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    });
  }

  function handleApprove(userId: string) {
    startTransition(async () => {
      const result = await approveUser(userId);
      if (result.error) { setActionError(result.error); return; }
      setPending((prev) => prev.filter((u) => u.id !== userId));
      router.refresh();
    });
  }

  function handleReject(userId: string) {
    startTransition(async () => {
      const result = await rejectUser(userId);
      if (result.error) { setActionError(result.error); return; }
      setPending((prev) => prev.filter((u) => u.id !== userId));
      router.refresh();
    });
  }

  function handleTicketStatus(id: string, status: "in_progress" | "resolved" | "closed") {
    startTransition(async () => {
      await updateTicketStatus(id, status);
      setTickets((prev) => prev.filter((t) => t.id !== id));
    });
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 500, letterSpacing: "0.14em",
    textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Error banner */}
      {actionError && (
        <div style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--color-accent)" }}>
          {actionError}
        </div>
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div>
          <div style={{ ...sectionLabel, color: "var(--color-accent)" }}>
            Pending approval · {pending.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((u) => (
              <div key={u.id} style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-accent)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={u.name || u.email} avatarUrl={u.avatarUrl} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                    {u.name || "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 2 }}>Signed up {fmtDate(u.createdAt)}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    disabled={isPending}
                    onClick={() => handleApprove(u.id)}
                    style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "var(--color-moss)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Approve
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => handleReject(u.id)}
                    style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-accent)", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support tickets */}
      {tickets.length > 0 && (
        <div>
          <div style={sectionLabel}>Support tickets · {tickets.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tickets.map((t) => {
              const typeColors: Record<string, string> = { bug: "var(--color-accent)", feature: "var(--color-moss)", question: "var(--color-slate)", other: "var(--color-ink-3)" };
              const typeLabel: Record<string, string> = { bug: "Bug", feature: "Feature", question: "Question", other: "Other" };
              return (
                <div key={t.id} style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{t.subject}</span>
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: "var(--color-bg-deep)", color: typeColors[t.type] ?? "var(--color-ink-3)", border: `1px solid ${typeColors[t.type] ?? "var(--color-rule)"}` }}>
                          {typeLabel[t.type] ?? t.type}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: t.status === "in_progress" ? "var(--color-accent-soft)" : "var(--color-bg-deep)", color: t.status === "in_progress" ? "var(--color-accent)" : "var(--color-ink-4)", border: "1px solid var(--color-rule)" }}>
                          {t.status === "in_progress" ? "In progress" : "Open"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 2 }}>
                        {t.userName || t.userEmail} · {fmtDate(t.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-2)", background: "var(--color-bg-deep)", borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {t.description}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {t.status === "open" && (
                      <button onClick={() => handleTicketStatus(t.id, "in_progress")} disabled={isPending}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-accent)", background: "var(--color-accent-soft)", color: "var(--color-accent)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        Start working
                      </button>
                    )}
                    <button onClick={() => handleTicketStatus(t.id, "resolved")} disabled={isPending}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-moss)", background: "var(--color-moss-soft)", color: "var(--color-moss)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      Resolve
                    </button>
                    <button onClick={() => handleTicketStatus(t.id, "closed")} disabled={isPending}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                      Close
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite new user */}
      <div>
        <div style={sectionLabel}>Invite user</div>
        <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 5 }}>
              Email address
            </div>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteSent(false); setInviteError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              placeholder="name@example.com"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-rule)", background: "var(--color-bg-deep)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-4)", marginBottom: 8 }}>
              Role
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["standard", "admin"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  style={{
                    padding: "8px 16px", borderRadius: 8,
                    border: `1px solid ${inviteRole === r ? (r === "admin" ? "var(--color-accent)" : "var(--color-ink)") : "var(--color-rule)"}`,
                    background: inviteRole === r ? (r === "admin" ? "var(--color-accent-soft)" : "var(--color-bg-deep)") : "transparent",
                    color: inviteRole === r ? (r === "admin" ? "var(--color-accent)" : "var(--color-ink)") : "var(--color-ink-4)",
                    fontSize: 13, fontWeight: inviteRole === r ? 600 : 400,
                    cursor: "pointer", fontFamily: "inherit", transition: "all 120ms",
                  }}
                >
                  {r === "admin" ? "Admin" : "Standard"}
                </button>
              ))}
            </div>
            {inviteRole === "admin" && (
              <div style={{ fontSize: 11, color: "var(--color-accent)", marginTop: 6 }}>
                Admin users can manage other users and send invitations.
              </div>
            )}
          </div>

          {inviteError && (
            <div style={{ background: "var(--color-accent-soft)", border: "1px solid var(--color-accent)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--color-accent)" }}>
              {inviteError}
            </div>
          )}

          <button
            onClick={handleInvite}
            disabled={isPending || !inviteEmail.trim()}
            style={{
              padding: "11px", borderRadius: 10, border: "none",
              background: inviteSent ? "var(--color-moss)" : (inviteEmail.trim() ? "var(--color-ink)" : "var(--color-bg-deep)"),
              color: inviteEmail.trim() ? "var(--color-bg)" : "var(--color-ink-4)",
              fontSize: 14, fontWeight: 600, cursor: inviteEmail.trim() ? "pointer" : "default",
              fontFamily: "inherit", transition: "background 200ms",
            }}
          >
            {inviteSent ? "Invitation sent ✓" : isPending ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </div>

      {/* Integration requests */}
      {requests.length > 0 && (
        <div>
          <div style={sectionLabel}>Integration requests · {requests.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {requests.map((req) => (
              <div key={req.id} style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: req.description ? 8 : 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--color-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    📬
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{req.integration}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: "var(--color-accent-soft)", color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}>
                        {req.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                      {req.userName || req.userEmail} · {fmtDate(req.createdAt)}
                    </div>
                  </div>
                </div>
                {req.description && (
                  <div style={{ fontSize: 12, color: "var(--color-ink-2)", background: "var(--color-bg-deep)", borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.5 }}>
                    {req.description}
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => handleRequestStatus(req.id, "planned")}
                    disabled={isPending}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-moss)", background: "var(--color-moss-soft)", color: "var(--color-moss)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Mark planned
                  </button>
                  <button
                    onClick={() => handleRequestStatus(req.id, "reviewed")}
                    disabled={isPending}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg-deep)", color: "var(--color-ink-3)", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleRequestStatus(req.id, "declined")}
                    disabled={isPending}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-accent)", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <div style={sectionLabel}>Pending invitations · {invitations.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--color-bg-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  ✉️
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {inv.email}
                    </span>
                    <RolePill role={inv.role} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>
                    Invited {fmtDate(inv.invitedAt)} · awaiting signup
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvite(inv.id)}
                  disabled={isPending}
                  style={{ background: "none", border: "none", color: "var(--color-ink-4)", fontSize: 18, cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                  aria-label="Cancel invitation"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users */}
      <div>
        <div style={sectionLabel}>Users · {users.length}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onRoleChange={handleRoleChange}
              onAppAccessChange={handleAppAccessChange}
              onRemove={handleRemove}
              isPending={isPending}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
