"use client";

import { useState, useEffect } from "react";

interface FamilyMember {
  id: string;
  member_user_id: string;
  full_name: string | null;
  email: string | null;
}

interface ExistingShare {
  id: string;
  recipient_user_id: string;
  mode: "auto" | "manual";
  accepted: boolean;
}

interface ShareAccountModalProps {
  accountId: string;
  accountName: string;
  onClose: () => void;
}

function initials(name: string | null, email: string | null): string {
  const s = name ?? email ?? "?";
  return s.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export default function ShareAccountModal({ accountId, accountName, onClose }: ShareAccountModalProps) {
  const [circle, setCircle] = useState<FamilyMember[]>([]);
  const [existing, setExisting] = useState<ExistingShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [noCircle, setNoCircle] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/family/members").then((r) => r.json()),
      fetch(`/api/finance/manual-shares?account_id=${accountId}`).then((r) => r.json()),
    ]).then(([familyData, sharesData]) => {
      setCircle(familyData.circle ?? []);
      setExisting(sharesData.shares ?? []);
      setNoCircle((familyData.circle ?? []).length === 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [accountId]);

  const sharedIds = new Set(existing.map((s) => s.recipient_user_id));
  const notYetShared = circle.filter((m) => !sharedIds.has(m.member_user_id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleShare = async () => {
    if (!selected.size) return;
    setSaving(true);
    await Promise.all(
      [...selected].map((recipientId) =>
        fetch("/api/finance/manual-shares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_id: accountId, recipient_user_id: recipientId, mode }),
        })
      )
    );
    // Refresh existing shares
    const data = await fetch(`/api/finance/manual-shares?account_id=${accountId}`).then((r) => r.json());
    setExisting(data.shares ?? []);
    setSelected(new Set());
    setSaving(false);
  };

  const handleRevoke = async (shareId: string, recipientId: string) => {
    setRevoking((s) => new Set(s).add(shareId));
    await fetch("/api/finance/manual-shares", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share_id: shareId, account_id: accountId, recipient_user_id: recipientId }),
    });
    setExisting((prev) => prev.filter((s) => s.id !== shareId));
    setRevoking((s) => { const n = new Set(s); n.delete(shareId); return n; });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.12)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--color-rule)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-accent)", marginBottom: 3 }}>Share Account</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink)" }}>{accountName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--color-ink-3)", padding: "2px 6px" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {loading && <div style={{ fontSize: 13, color: "var(--color-ink-3)", textAlign: "center", padding: "24px 0" }}>Loading…</div>}

          {!loading && noCircle && (
            <div style={{ fontSize: 13, color: "var(--color-ink-3)", lineHeight: 1.6 }}>
              Your family circle is empty. <a href="/home/settings/family" style={{ color: "var(--color-accent)" }}>Add people</a> to your circle first, then come back to share.
            </div>
          )}

          {!loading && !noCircle && (
            <>
              {/* Already shared */}
              {existing.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10 }}>
                    Currently shared with
                  </div>
                  {existing.map((share) => {
                    const person = circle.find((m) => m.member_user_id === share.recipient_user_id);
                    const name = person?.full_name ?? person?.email ?? share.recipient_user_id;
                    return (
                      <div key={share.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--color-bg-deep)", borderRadius: 8, marginBottom: 6 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(74,107,58,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--color-green)", flexShrink: 0 }}>
                          {initials(person?.full_name ?? null, person?.email ?? null)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>{name}</div>
                          <div style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                            {share.mode === "auto" ? "Auto — visible immediately" : share.accepted ? "Manual — accepted" : "Manual — pending acceptance"}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevoke(share.id, share.recipient_user_id)}
                          disabled={revoking.has(share.id)}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          {revoking.has(share.id) ? "…" : "Revoke"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add new shares */}
              {notYetShared.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10 }}>
                    Share with
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {notYetShared.map((m) => {
                      const isSelected = selected.has(m.member_user_id);
                      return (
                        <button
                          key={m.member_user_id}
                          onClick={() => toggleSelect(m.member_user_id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                            borderRadius: 8, border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-rule)"}`,
                            background: isSelected ? "var(--color-accent-soft)" : "var(--color-bg-card)",
                            cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s",
                          }}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: isSelected ? "var(--color-accent-soft)" : "var(--color-bg-deep)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: isSelected ? "var(--color-accent)" : "var(--color-ink-3)", flexShrink: 0 }}>
                            {initials(m.full_name, m.email)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>{m.full_name ?? "—"}</div>
                            <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>{m.email}</div>
                          </div>
                          {isSelected && <span style={{ fontSize: 16, color: "var(--color-accent)" }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Mode picker */}
                  {selected.size > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 8 }}>Sharing mode</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {([
                          { v: "auto" as const, label: "Automatic", desc: "Visible in their dashboard immediately" },
                          { v: "manual" as const, label: "Manual", desc: "They receive a request and must accept" },
                        ]).map(({ v, label, desc }) => (
                          <button
                            key={v}
                            onClick={() => setMode(v)}
                            style={{
                              flex: 1, padding: "10px 12px", borderRadius: 8, textAlign: "left",
                              border: `1px solid ${mode === v ? "var(--color-accent)" : "var(--color-rule)"}`,
                              background: mode === v ? "var(--color-accent-soft)" : "transparent",
                              cursor: "pointer", fontFamily: "inherit",
                            }}
                          >
                            <div style={{ fontSize: 12, fontWeight: 700, color: mode === v ? "var(--color-accent)" : "var(--color-ink-2)", marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 10, color: "var(--color-ink-4)", lineHeight: 1.4 }}>{desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {notYetShared.length === 0 && existing.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--color-ink-4)", textAlign: "center", padding: "16px 0" }}>
                  Everyone in your circle already has access.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !noCircle && selected.size > 0 && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--color-rule)" }}>
            <button
              onClick={handleShare}
              disabled={saving}
              style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Sharing…" : `Share with ${selected.size} person${selected.size !== 1 ? "s" : ""} · ${mode === "auto" ? "Automatic" : "Manual"}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
