"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteUser, cancelInvitation, updateUserRole, removeUser, updateIntegrationRequestStatus, approveUser, rejectUser, updateTicketStatus, updateAppAccess, approveAccessRequest, dismissAccessRequest, type AppKey } from "../actions";

const ALL_APPS: AppKey[] = ["hub", "health", "finance", "investments", "career", "student-success", "children", "bible"];
const APP_LABEL: Record<AppKey, string> = {
  hub: "Hub", health: "Health", finance: "Finance",
  "student-success": "Courses", investments: "Investments",
  bible: "Bible", career: "Career", children: "Children",
};
const APP_COLOR: Record<AppKey, string> = {
  hub: "#356FB0", health: "#4D6B3A", finance: "#8B6A47",
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

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  note: string;
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
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--ios-tint)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 600, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function RolePill({ role }: { role: "admin" | "standard" }) {
  const isAdmin = role === "admin";
  return (
    <span className="ios-caption" style={{
      fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase",
      padding: "2px 8px", borderRadius: 999,
      background: "var(--ios-fill)",
      color: isAdmin ? "var(--ios-tint)" : "var(--ios-label-2)",
      whiteSpace: "nowrap" as const,
    }}>
      {isAdmin ? "Admin" : "Standard"}
    </span>
  );
}

// ── Shared iOS switch + module list ────────────────────────────────────────

function IOSSwitch({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      style={{ width: 51, height: 31, borderRadius: 999, background: on ? "var(--ios-green)" : "var(--ios-fill)", cursor: disabled ? "not-allowed" : "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
    >
      <div style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

function ModuleSwitchList({ value, onChange, disabled }: { value: AppKey[]; onChange: (next: AppKey[]) => void; disabled?: boolean }) {
  function toggle(app: AppKey) {
    const next = value.includes(app) ? value.filter((a) => a !== app) : [...value, app];
    onChange(next);
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {ALL_APPS.map((app) => {
        const active = value.includes(app);
        const isHub = app === "hub";
        return (
          <div key={app} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "var(--ios-cell)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: APP_COLOR[app], flexShrink: 0 }} />
            <span className="ios-subhead" style={{ flex: 1, fontWeight: 600 }}>{APP_LABEL[app]}</span>
            {isHub ? (
              <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>Always on</span>
            ) : (
              <IOSSwitch on={active} onToggle={() => toggle(app)} disabled={disabled} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Access Request (waitlist) approval sheet ───────────────────────────────

function AccessRequestModal({ request, isPending, onApprove, onClose }: {
  request: AccessRequest;
  isPending: boolean;
  onApprove: (role: "standard" | "admin", appAccess: AppKey[]) => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<"standard" | "admin">("standard");
  const [access, setAccess] = useState<AppKey[]>(["hub", "health", "finance"]);

  return (
    <>
      <div className="ios-sheet-backdrop" onClick={onClose} />
      <div className="ios-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ios-grabber" />

        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 16, borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
          <Avatar name={request.name || request.email} avatarUrl={null} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ios-headline">{request.name || "—"}</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{request.email}</div>
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>Requested {fmtDate(request.createdAt)}</div>
          </div>
          <button onClick={onClose} className="ios-subhead" style={{ color: "var(--ios-tint)" }}>Done</button>
        </div>

        {request.note && (
          <div className="ios-footnote" style={{ color: "var(--ios-label)", background: "var(--ios-bg)", borderRadius: 8, padding: "8px 10px", marginTop: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {request.note}
          </div>
        )}

        <div style={{ padding: "16px 0", borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
          <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Role</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["standard", "admin"] as const).map((r) => (
              <button key={r} onClick={() => setRole(r)} className={`ios-chip${role === r ? " is-selected" : ""}`} aria-pressed={role === r}>
                {r === "admin" ? "Admin" : "Standard"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "16px 0" }}>
          <div className="ios-group-header" style={{ padding: "0 0 12px" }}>Grant module access</div>
          <ModuleSwitchList value={access} onChange={setAccess} disabled={isPending} />
        </div>

        <button
          onClick={() => onApprove(role, access)}
          disabled={isPending}
          className="ios-btn ios-btn--primary"
          style={{ background: "var(--ios-tint)", width: "100%" }}
        >
          {isPending ? "Sending…" : "Approve & send invite"}
        </button>
      </div>
    </>
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
    <>
      <div className="ios-sheet-backdrop" onClick={onClose} />
      <div className="ios-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ios-grabber" />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 16, borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
          <Avatar name={user.name || user.email} avatarUrl={user.avatarUrl} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <span className="ios-headline">{user.name || "—"}</span>
              <RolePill role={user.role} />
              {user.isCurrentUser && <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>you</span>}
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{user.email}</div>
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>Joined {fmtDate(user.createdAt)}</div>
          </div>
          <button onClick={onClose} className="ios-subhead" style={{ color: "var(--ios-tint)" }}>Done</button>
        </div>

        {/* Module access */}
        <div style={{ padding: "16px 0", borderBottom: "var(--ios-hair) solid var(--ios-separator)" }}>
          <div className="ios-group-header" style={{ padding: "0 0 12px" }}>
            Module Access
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ALL_APPS.map((app) => {
              const active = user.appAccess.includes(app);
              const isHub = app === "hub";
              return (
                <div key={app} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "var(--ios-cell)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: APP_COLOR[app], flexShrink: 0 }} />
                  <span className="ios-subhead" style={{ flex: 1, fontWeight: 600 }}>{APP_LABEL[app]}</span>
                  {isHub ? (
                    <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>Always on</span>
                  ) : (
                    <button
                      onClick={() => toggleApp(app)}
                      disabled={isPending || user.isCurrentUser}
                      style={{ width: 51, height: 31, borderRadius: 999, background: active ? "var(--ios-green)" : "var(--ios-fill)", cursor: user.isCurrentUser ? "not-allowed" : "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                      title={user.isCurrentUser ? "Cannot edit your own access" : undefined}
                    >
                      <div style={{ position: "absolute", top: 2, left: active ? 22 : 2, width: 27, height: 27, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Admin role + danger zone */}
        {!user.isCurrentUser && (
          <div style={{ padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <button
              disabled={isPending}
              onClick={() => { onRoleChange(user.id, user.role === "admin" ? "standard" : "admin"); }}
              className="ios-subhead" style={{ color: "var(--ios-tint)", fontWeight: 500 }}
            >
              {user.role === "admin" ? "Revoke admin" : "Make admin"}
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} disabled={isPending}
                className="ios-subhead" style={{ color: "var(--ios-red)", fontWeight: 500 }}>
                Remove user
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { onRemove(user.id); onClose(); }}
                  className="ios-subhead" style={{ color: "var(--ios-red)", fontWeight: 600 }}>
                  Confirm remove
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
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
        style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
      >
        <Avatar name={user.name || user.email} avatarUrl={user.avatarUrl} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span className="ios-subhead ios-truncate" style={{ fontWeight: 600 }}>{user.name || "—"}</span>
            <RolePill role={user.role} />
            {user.isCurrentUser && <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>you</span>}
          </div>
          <div className="ios-footnote ios-truncate" style={{ color: "var(--ios-label-2)" }}>{user.email}</div>
          <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
            {ALL_APPS.filter((a) => user.appAccess.includes(a)).map((a) => (
              <span key={a} className="ios-caption" style={{ fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: APP_COLOR[a] + "18", color: APP_COLOR[a], letterSpacing: "0.02em" }}>
                {APP_LABEL[a]}
              </span>
            ))}
          </div>
        </div>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ios-label-3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden><path d="M9 5l7 7-7 7" /></svg>
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
  accessRequests: AccessRequest[];
  waitlistAvailable: boolean;
}

export default function AdminClient({ users: initialUsers, invitations: initialInvites, integrationRequests: initialRequests, pendingUsers: initialPending, supportTickets: initialTickets, accessRequests: initialAccess, waitlistAvailable }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [users, setUsers] = useState(initialUsers);
  const [invitations, setInvitations] = useState(initialInvites);
  const [requests, setRequests] = useState(initialRequests);
  const [pending, setPending] = useState(initialPending);
  const [tickets, setTickets] = useState(initialTickets);
  const [accessRequests, setAccessRequests] = useState(initialAccess);
  const [activeRequest, setActiveRequest] = useState<AccessRequest | null>(null);
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

  function handleApproveAccess(req: AccessRequest, role: "standard" | "admin", appAccess: AppKey[]) {
    setActionError(null);
    startTransition(async () => {
      const result = await approveAccessRequest(req.id, req.email, role, appAccess);
      if (result.error) { setActionError(result.error); return; }
      setAccessRequests((prev) => prev.filter((r) => r.id !== req.id));
      setActiveRequest(null);
      router.refresh();
    });
  }

  function handleDismissAccess(id: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await dismissAccessRequest(id);
      if (result.error) { setActionError(result.error); return; }
      setAccessRequests((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Error banner */}
      {actionError && (
        <div className="ios-footnote" style={{ background: "var(--ios-fill)", borderRadius: 10, padding: "10px 14px", color: "var(--ios-red)" }}>
          {actionError}
        </div>
      )}

      {/* Access requests (public waitlist) */}
      <div>
        <div className="ios-group-header" style={{ padding: "0 0 10px", color: accessRequests.length ? "var(--ios-tint)" : undefined }}>
          Access requests{accessRequests.length ? ` · ${accessRequests.length}` : ""}
        </div>
        {!waitlistAvailable ? (
          <div className="ios-footnote" style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "14px", color: "var(--ios-label-2)", lineHeight: 1.5 }}>
            Waitlist storage isn&rsquo;t set up yet. New requests from the landing page will appear here once the <code>hub.waitlist</code> table exists.
          </div>
        ) : accessRequests.length === 0 ? (
          <div className="ios-footnote" style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "14px", color: "var(--ios-label-2)" }}>
            No pending access requests. Sign-ups from the landing page “Request access” form show up here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {accessRequests.map((r) => (
              <div key={r.id} style={{ background: "var(--ios-cell)", boxShadow: "inset 0 0 0 1px var(--ios-tint)", borderRadius: "var(--ios-radius-card)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={r.name || r.email} avatarUrl={null} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ios-subhead ios-truncate" style={{ fontWeight: 600, marginBottom: 2 }}>{r.name || "—"}</div>
                  <div className="ios-footnote ios-truncate" style={{ color: "var(--ios-label-2)" }}>{r.email}</div>
                  {r.note && <div className="ios-caption ios-truncate" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>{r.note}</div>}
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>Requested {fmtDate(r.createdAt)}</div>
                </div>
                <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                  <button disabled={isPending} onClick={() => setActiveRequest(r)}
                    className="ios-subhead" style={{ color: "var(--ios-green)", fontWeight: 600 }}>
                    Approve
                  </button>
                  <button disabled={isPending} onClick={() => handleDismissAccess(r.id)}
                    className="ios-subhead" style={{ color: "var(--ios-label-2)", fontWeight: 500 }}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeRequest && (
        <AccessRequestModal
          request={activeRequest}
          isPending={isPending}
          onApprove={(role, appAccess) => handleApproveAccess(activeRequest, role, appAccess)}
          onClose={() => setActiveRequest(null)}
        />
      )}

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div>
          <div className="ios-group-header" style={{ padding: "0 0 10px", color: "var(--ios-tint)" }}>
            Pending approval · {pending.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map((u) => (
              <div key={u.id} style={{ background: "var(--ios-cell)", boxShadow: "inset 0 0 0 1px var(--ios-tint)", borderRadius: "var(--ios-radius-card)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={u.name || u.email} avatarUrl={u.avatarUrl} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ios-subhead ios-truncate" style={{ fontWeight: 600, marginBottom: 2 }}>
                    {u.name || "—"}
                  </div>
                  <div className="ios-footnote ios-truncate" style={{ color: "var(--ios-label-2)" }}>{u.email}</div>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 2 }}>Signed up {fmtDate(u.createdAt)}</div>
                </div>
                <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                  <button
                    disabled={isPending}
                    onClick={() => handleApprove(u.id)}
                    className="ios-subhead" style={{ color: "var(--ios-green)", fontWeight: 600 }}
                  >
                    Approve
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => handleReject(u.id)}
                    className="ios-subhead" style={{ color: "var(--ios-label-2)", fontWeight: 500 }}
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
          <div className="ios-group-header" style={{ padding: "0 0 10px" }}>Support tickets · {tickets.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tickets.map((t) => {
              const typeColors: Record<string, string> = { bug: "var(--ios-tint)", feature: "var(--ios-green)", question: "#5E5CE6", other: "var(--ios-label-2)" };
              const typeLabel: Record<string, string> = { bug: "Bug", feature: "Feature", question: "Question", other: "Other" };
              return (
                <div key={t.id} style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span className="ios-subhead" style={{ fontWeight: 600 }}>{t.subject}</span>
                        <span className="ios-caption" style={{ fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: "var(--ios-fill)", color: typeColors[t.type] ?? "var(--ios-label-2)" }}>
                          {typeLabel[t.type] ?? t.type}
                        </span>
                        <span className="ios-caption" style={{ fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: "var(--ios-fill)", color: t.status === "in_progress" ? "var(--ios-tint)" : "var(--ios-label-2)" }}>
                          {t.status === "in_progress" ? "In progress" : "Open"}
                        </span>
                      </div>
                      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 2 }}>
                        {t.userName || t.userEmail} · {fmtDate(t.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="ios-footnote" style={{ color: "var(--ios-label)", background: "var(--ios-bg)", borderRadius: 8, padding: "8px 10px", marginBottom: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {t.description}
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    {t.status === "open" && (
                      <button onClick={() => handleTicketStatus(t.id, "in_progress")} disabled={isPending}
                        className="ios-footnote" style={{ color: "var(--ios-tint)", fontWeight: 600 }}>
                        Start working
                      </button>
                    )}
                    <button onClick={() => handleTicketStatus(t.id, "resolved")} disabled={isPending}
                      className="ios-footnote" style={{ color: "var(--ios-green)", fontWeight: 600 }}>
                      Resolve
                    </button>
                    <button onClick={() => handleTicketStatus(t.id, "closed")} disabled={isPending}
                      className="ios-footnote" style={{ color: "var(--ios-label-2)", fontWeight: 500 }}>
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
        <div className="ios-group-header" style={{ padding: "0 0 10px" }}>Invite user</div>
        <div style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="ios-caption" style={{ fontWeight: 500, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--ios-label-2)", marginBottom: 6 }}>
              Email address
            </div>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteSent(false); setInviteError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              placeholder="name@example.com"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "var(--ios-hair) solid var(--ios-separator)", background: "var(--ios-bg)", color: "var(--ios-label)", fontSize: 16, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <div className="ios-caption" style={{ fontWeight: 500, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--ios-label-2)", marginBottom: 8 }}>
              Role
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["standard", "admin"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  className={`ios-chip${inviteRole === r ? " is-selected" : ""}`}
                  aria-pressed={inviteRole === r}
                >
                  {r === "admin" ? "Admin" : "Standard"}
                </button>
              ))}
            </div>
            {inviteRole === "admin" && (
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>
                Admin users can manage other users and send invitations.
              </div>
            )}
          </div>

          {inviteError && (
            <div className="ios-footnote" style={{ background: "var(--ios-fill)", borderRadius: 8, padding: "8px 12px", color: "var(--ios-red)" }}>
              {inviteError}
            </div>
          )}

          <button
            onClick={handleInvite}
            disabled={isPending || !inviteEmail.trim()}
            className="ios-btn ios-btn--primary"
            style={{
              background: inviteSent ? "var(--ios-green)" : "var(--ios-tint)",
              cursor: inviteEmail.trim() ? "pointer" : "default",
              opacity: inviteEmail.trim() || inviteSent ? 1 : 0.5,
            }}
          >
            {inviteSent ? "Invitation sent" : isPending ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </div>

      {/* Integration requests */}
      {requests.length > 0 && (
        <div>
          <div className="ios-group-header" style={{ padding: "0 0 10px" }}>Integration requests · {requests.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {requests.map((req) => (
              <div key={req.id} style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: req.description ? 8 : 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--ios-fill)", color: "var(--ios-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 7l9 6 9-6" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                      <span className="ios-subhead" style={{ fontWeight: 600 }}>{req.integration}</span>
                      <span className="ios-caption" style={{ fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: "var(--ios-fill)", color: "var(--ios-tint)" }}>
                        {req.status}
                      </span>
                    </div>
                    <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                      {req.userName || req.userEmail} · {fmtDate(req.createdAt)}
                    </div>
                  </div>
                </div>
                {req.description && (
                  <div className="ios-footnote" style={{ color: "var(--ios-label)", background: "var(--ios-bg)", borderRadius: 8, padding: "8px 10px", marginBottom: 12, lineHeight: 1.5 }}>
                    {req.description}
                  </div>
                )}
                <div style={{ display: "flex", gap: 16 }}>
                  <button
                    onClick={() => handleRequestStatus(req.id, "planned")}
                    disabled={isPending}
                    className="ios-footnote" style={{ color: "var(--ios-green)", fontWeight: 600 }}
                  >
                    Mark planned
                  </button>
                  <button
                    onClick={() => handleRequestStatus(req.id, "reviewed")}
                    disabled={isPending}
                    className="ios-footnote" style={{ color: "var(--ios-label-2)", fontWeight: 500 }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleRequestStatus(req.id, "declined")}
                    disabled={isPending}
                    className="ios-footnote" style={{ color: "var(--ios-tint)", fontWeight: 500 }}
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
          <div className="ios-group-header" style={{ padding: "0 0 10px" }}>Pending invitations · {invitations.length}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}
              >
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--ios-fill)", color: "var(--ios-label-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 7l9 6 9-6" /></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span className="ios-footnote ios-truncate" style={{ fontWeight: 500, color: "var(--ios-label)" }}>
                      {inv.email}
                    </span>
                    <RolePill role={inv.role} />
                  </div>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>
                    Invited {fmtDate(inv.invitedAt)} · awaiting signup
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvite(inv.id)}
                  disabled={isPending}
                  style={{ color: "var(--ios-label-3)", padding: "0 2px", flexShrink: 0, display: "flex" }}
                  aria-label="Cancel invitation"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users */}
      <div>
        <div className="ios-group-header" style={{ padding: "0 0 10px" }}>Users · {users.length}</div>
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
