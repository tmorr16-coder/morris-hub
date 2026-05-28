"use client";

import { useState, useEffect } from "react";

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

  // Load platform users + current shares in parallel
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersRes, sharesRes] = await Promise.all([
          fetch("/api/student-support/platform-users"),
          fetch(`/api/student-support/shares?courseId=${courseId}`),
        ]);
        if (!usersRes.ok) throw new Error("Failed to load users");
        if (!sharesRes.ok) throw new Error("Failed to load shares");
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

    if (!enabled && existing) {
      // Remove the share
      setSaving(targetUser.id);
      try {
        const res = await fetch(`/api/student-support/shares?id=${existing.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove share");
        setShares((prev) => prev.filter((s) => s.id !== existing.id));
      } catch (e) {
        console.error(e);
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
        if (!res.ok) throw new Error("Failed to create share");
        const newShare: CourseShare = await res.json();
        setShares((prev) => {
          const without = prev.filter((s) => s.shared_with_user_id !== targetUser.id);
          return [...without, newShare];
        });
      } catch (e) {
        console.error(e);
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
      <div style={{ color: "var(--color-ink-3)", fontSize: 13, paddingTop: 24 }}>
        Loading sharing settings…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: "#fee2e2",
        color: "#991b1b",
        fontSize: 13,
      }}>
        {error}
      </div>
    );
  }

  const sharedCount = shares.length;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2
          className="serif"
          style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px 0" }}
        >
          Share Course
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-ink-3)", margin: 0 }}>
          Give other family members read-only access to grades and assignments for{" "}
          <strong>{courseName}</strong>.
          {sharedCount > 0 && (
            <span style={{ marginLeft: 8, color: colorTag, fontWeight: 600 }}>
              Shared with {sharedCount} {sharedCount === 1 ? "person" : "people"}
            </span>
          )}
        </p>
      </div>

      {users.length === 0 ? (
        <div style={{
          background: "var(--color-bg-card)",
          border: "1px dashed var(--color-rule)",
          borderRadius: 12,
          padding: "40px 24px",
          textAlign: "center",
          color: "var(--color-ink-3)",
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👨‍👩‍👧‍👦</div>
          <p style={{ fontSize: 14, margin: 0 }}>
            No other platform members found. Invite family members from the{" "}
            <a href="/home/admin" style={{ color: colorTag }}>Admin panel</a>.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
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
                  background: shared
                    ? colorTag + "0d"
                    : "var(--color-bg-card)",
                  border: `1px solid ${shared ? colorTag + "40" : "var(--color-rule)"}`,
                  borderRadius: 10,
                  padding: "16px 18px",
                  transition: "border-color 0.2s, background 0.2s",
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
                      background: colorTag + "25",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      fontWeight: 700,
                      color: colorTag,
                      flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
                        {displayName}
                      </div>
                      {u.full_name && u.email && (
                        <div style={{ fontSize: 11, color: "var(--color-ink-3)" }}>{u.email}</div>
                      )}
                    </div>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleShare(u, !shared)}
                    disabled={isSavingThis}
                    style={{
                      position: "relative",
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      border: "none",
                      background: shared ? colorTag : "var(--color-rule)",
                      cursor: isSavingThis ? "default" : "pointer",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                    title={shared ? "Remove access" : "Grant access"}
                  >
                    <span style={{
                      position: "absolute",
                      top: 3,
                      left: shared ? 23 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "white",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
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
                    borderTop: `1px solid ${colorTag}20`,
                    display: "flex",
                    gap: 20,
                    flexWrap: "wrap",
                  }}>
                    <label style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12,
                      cursor: "pointer",
                      color: "var(--color-ink-2)",
                    }}>
                      <input
                        type="checkbox"
                        checked={share!.share_grades}
                        disabled={isSavingThis}
                        onChange={(e) =>
                          handleToggleOption(u, "share_grades", e.target.checked)
                        }
                        style={{ accentColor: colorTag, width: 14, height: 14 }}
                      />
                      📊 Grades
                    </label>

                    <label style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      fontSize: 12,
                      cursor: "pointer",
                      color: "var(--color-ink-2)",
                    }}>
                      <input
                        type="checkbox"
                        checked={share!.share_assignments}
                        disabled={isSavingThis}
                        onChange={(e) =>
                          handleToggleOption(u, "share_assignments", e.target.checked)
                        }
                        style={{ accentColor: colorTag, width: 14, height: 14 }}
                      />
                      📋 Assignments
                    </label>

                    <a
                      href={`/student-success/shared/${courseId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 11,
                        color: colorTag,
                        textDecoration: "none",
                        marginLeft: "auto",
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
      <p style={{
        fontSize: 11,
        color: "var(--color-ink-3)",
        marginTop: 20,
        lineHeight: 1.6,
      }}>
        Shared members can view but not edit grades or assignments. They can access shared
        courses from their Student Success dashboard.
      </p>
    </div>
  );
}
