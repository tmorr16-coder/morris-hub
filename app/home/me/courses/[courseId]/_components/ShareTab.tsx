"use client";

import { useState, useEffect } from "react";
import { Icons } from "@/components/ios";

interface PlatformUser {
  id: string;
  email: string | null;
  full_name: string | null;
  app_access: string[] | null;
}

interface CourseShare {
  id: string;
  shared_with_user_id: string;
  share_grades: boolean;
  share_assignments: boolean;
  created_at: string;
}

interface ShareTabProps {
  courseId: string;
  courseName: string;
  colorTag: string;
}

export default function ShareTab({ courseId, courseName, colorTag }: ShareTabProps) {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [shares, setShares] = useState<CourseShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // userId being saved
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null); // per-toggle error
  const [setupRequired, setSetupRequired] = useState(false);

  // Load platform users + current shares in parallel
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSetupRequired(false);
      try {
        const [usersRes, sharesRes] = await Promise.all([
          fetch("/api/student-support/platform-users"),
          fetch(`/api/student-support/shares?courseId=${courseId}`),
        ]);

        // Check for missing-table (setup required) vs real errors
        if (!sharesRes.ok) {
          const body = await sharesRes.json().catch(() => ({}));
          if (body.setup_required || sharesRes.status === 503) {
            setSetupRequired(true);
            setLoading(false);
            return;
          }
          throw new Error(body.error || "Failed to load shares");
        }
        if (!usersRes.ok) {
          throw new Error("Failed to load platform users");
        }

        const [usersData, sharesData] = await Promise.all([
          usersRes.json(),
          sharesRes.json(),
        ]);
        setUsers(usersData);
        setShares(sharesData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseId]);

  const getShare = (userId: string): CourseShare | undefined =>
    shares.find((s) => s.shared_with_user_id === userId);

  const isShared = (userId: string) => !!getShare(userId);

  const handleToggleShare = async (targetUser: PlatformUser, enabled: boolean) => {
    const existing = getShare(targetUser.id);

    setSaveError(null);

    if (!enabled && existing) {
      // Remove the share
      setSaving(targetUser.id);
      try {
        const res = await fetch(`/api/student-support/shares?id=${existing.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to remove share");
        }
        setShares((prev) => prev.filter((s) => s.id !== existing.id));
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to remove share");
      } finally {
        setSaving(null);
      }
    } else if (enabled) {
      // Create or update the share
      setSaving(targetUser.id);
      try {
        const res = await fetch("/api/student-support/shares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            sharedWithUserId: targetUser.id,
            shareGrades: existing?.share_grades ?? true,
            shareAssignments: existing?.share_assignments ?? true,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to create share");
        }
        const newShare: CourseShare = await res.json();
        setShares((prev) => {
          const without = prev.filter((s) => s.shared_with_user_id !== targetUser.id);
          return [...without, newShare];
        });
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to save share");
      } finally {
        setSaving(null);
      }
    }
  };

  const handleToggleOption = async (
    targetUser: PlatformUser,
    field: "share_grades" | "share_assignments",
    value: boolean
  ) => {
    const existing = getShare(targetUser.id);
    if (!existing) return;

    setSaving(targetUser.id);
    try {
      const res = await fetch("/api/student-support/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          sharedWithUserId: targetUser.id,
          shareGrades: field === "share_grades" ? value : existing.share_grades,
          shareAssignments: field === "share_assignments" ? value : existing.share_assignments,
        }),
      });
      if (!res.ok) throw new Error("Failed to update share");
      const updated: CourseShare = await res.json();
      setShares((prev) =>
        prev.map((s) => (s.shared_with_user_id === targetUser.id ? updated : s))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", paddingTop: 24 }}>
        Loading sharing settings…
      </div>
    );
  }

  // ── Sharing backend unavailable ─────────────────────────────────
  if (setupRequired) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h2 className="ios-title-3" style={{ margin: "0 0 4px 0" }}>Share Course</h2>
        </div>
        <div style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "24px 20px",
          textAlign: "center",
        }}>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0, lineHeight: 1.6 }}>
            Sharing is temporarily unavailable. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ios-footnote" style={{
        padding: "12px 16px",
        borderRadius: 10,
        background: "var(--ios-cell)",
        color: "var(--ios-red)",
      }}>
        {error}
      </div>
    );
  }

  const sharedCount = shares.length;

  return (
    <div>
      {/* Save error banner */}
      {saveError && (
        <div className="ios-footnote" style={{
          padding: "10px 14px",
          borderRadius: 10,
          background: "var(--ios-cell)",
          color: "var(--ios-red)",
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            aria-label="Dismiss"
            style={{ color: "var(--ios-red)", padding: 0, display: "inline-flex" }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 className="ios-title-3" style={{ margin: "0 0 4px 0" }}>Share Course</h2>
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0 }}>
          Give other family members read-only access to grades and assignments for{" "}
          <strong>{courseName}</strong>.
          {sharedCount > 0 && (
            <span className="ios-num" style={{ marginLeft: 8, color: colorTag, fontWeight: 600 }}>
              Shared with {sharedCount} {sharedCount === 1 ? "person" : "people"}
            </span>
          )}
        </p>
      </div>

      {users.length === 0 ? (
        <div style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "40px 24px",
          textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--ios-label-3)" }}>
            <Icons.PeopleIcon style={{ width: 32, height: 32 }} />
          </div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0 }}>
            No other platform members found. Invite family members from the{" "}
            <a href="/home/admin" style={{ color: colorTag }}>Admin panel</a>.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map((u) => {
            const share = getShare(u.id);
            const shared = !!share;
            const isSavingThis = saving === u.id;
            const displayName = u.full_name || u.email || "Unknown";
            const initials = displayName.slice(0, 1).toUpperCase();

            return (
              <div
                key={u.id}
                style={{
                  background: "var(--ios-cell)",
                  borderRadius: "var(--ios-radius-card)",
                  border: shared ? `1px solid ${colorTag}` : undefined,
                  padding: "16px 18px",
                  transition: "border-color 0.2s",
                  opacity: isSavingThis ? 0.65 : 1,
                }}
              >
                {/* User row */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: colorTag,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div>
                      <div className="ios-body" style={{ fontWeight: 600 }}>
                        {displayName}
                      </div>
                      {u.full_name && u.email && (
                        <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>{u.email}</div>
                      )}
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleShare(u, !shared)}
                    disabled={isSavingThis}
                    role="switch"
                    aria-checked={shared}
                    style={{
                      position: "relative",
                      width: 51,
                      height: 31,
                      borderRadius: 999,
                      background: shared ? "var(--ios-green)" : "var(--ios-fill)",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                    aria-label={shared ? "Remove access" : "Grant access"}
                  >
                    <span style={{
                      position: "absolute",
                      top: 2,
                      left: shared ? 22 : 2,
                      width: 27,
                      height: 27,
                      borderRadius: "50%",
                      background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      transition: "left 0.2s",
                      display: "block",
                    }} />
                  </button>
                </div>

                {/* Per-item options when shared */}
                {shared && (
                  <div style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "var(--ios-hair) solid var(--ios-separator)",
                    display: "flex",
                    gap: 20,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}>
                    <label className="ios-footnote" style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      cursor: "pointer",
                      color: "var(--ios-label)",
                    }}>
                      <input
                        type="checkbox"
                        checked={share!.share_grades}
                        disabled={isSavingThis}
                        onChange={(e) =>
                          handleToggleOption(u, "share_grades", e.target.checked)
                        }
                        style={{ accentColor: colorTag, width: 16, height: 16 }}
                      />
                      Grades
                    </label>

                    <label className="ios-footnote" style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      cursor: "pointer",
                      color: "var(--ios-label)",
                    }}>
                      <input
                        type="checkbox"
                        checked={share!.share_assignments}
                        disabled={isSavingThis}
                        onChange={(e) =>
                          handleToggleOption(u, "share_assignments", e.target.checked)
                        }
                        style={{ accentColor: colorTag, width: 16, height: 16 }}
                      />
                      Assignments
                    </label>

                    <a
                      href={`/home/me/courses/shared/${courseId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ios-caption"
                      style={{
                        color: colorTag,
                        marginLeft: "auto",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      Preview shared view ↗
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info note */}
      <p className="ios-caption" style={{
        color: "var(--ios-label-3)",
        marginTop: 20,
        lineHeight: 1.6,
      }}>
        Shared members can view but not edit grades or assignments. They can access shared
        courses from their Student Success dashboard.
      </p>
    </div>
  );
}
