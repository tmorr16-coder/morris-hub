"use client";

import { useState, useEffect } from "react";
import { Segmented } from "@/components/ios";

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

const avatarStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: "50%", background: "var(--ios-fill)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 13, fontWeight: 600, color: "var(--ios-label)", flexShrink: 0,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, letterSpacing: "0.04em",
  textTransform: "uppercase", color: "var(--ios-label-2)", padding: "0 0 10px",
};

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
    <>
      <div className="ios-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="ios-sheet" role="dialog" aria-modal="true" aria-label={`Share ${accountName}`}>
        <div className="ios-grabber" />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "2px 0 18px" }}>
          <div style={{ minWidth: 0 }}>
            <div className="ios-headline" style={{ color: "var(--ios-label)" }}>Share account</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>{accountName}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, border: "none", background: "var(--ios-fill)", color: "var(--ios-label-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden style={{ width: 15, height: 15 }}>
              <path d="M6 6 18 18M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div>
          {loading && <div className="ios-subhead" style={{ color: "var(--ios-label-2)", textAlign: "center", padding: "24px 0" }}>Loading…</div>}

          {!loading && noCircle && (
            <div className="ios-subhead" style={{ color: "var(--ios-label-2)", lineHeight: 1.6 }}>
              Your family circle is empty. <a href="/home/settings/family" style={{ color: "var(--ios-tint)" }}>Add people</a> to your circle first, then come back to share.
            </div>
          )}

          {!loading && !noCircle && (
            <>
              {/* Already shared */}
              {existing.length > 0 && (
                <div style={{ marginBottom: 22 }}>
                  <div style={sectionLabel}>Currently shared with</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {existing.map((share) => {
                      const person = circle.find((m) => m.member_user_id === share.recipient_user_id);
                      const name = person?.full_name ?? person?.email ?? share.recipient_user_id;
                      return (
                        <div key={share.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--ios-fill)", borderRadius: 12 }}>
                          <div style={avatarStyle}>
                            {initials(person?.full_name ?? null, person?.email ?? null)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="ios-subhead" style={{ fontWeight: 500, color: "var(--ios-label)" }}>{name}</div>
                            <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>
                              {share.mode === "auto" ? "Auto — visible immediately" : share.accepted ? "Manual — accepted" : "Manual — pending acceptance"}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevoke(share.id, share.recipient_user_id)}
                            disabled={revoking.has(share.id)}
                            className="ios-btn--plain"
                            style={{ color: "var(--ios-red)", flexShrink: 0 }}
                          >
                            {revoking.has(share.id) ? "…" : "Revoke"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add new shares */}
              {notYetShared.length > 0 && (
                <>
                  <div style={sectionLabel}>Share with</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {notYetShared.map((m) => {
                      const isSelected = selected.has(m.member_user_id);
                      return (
                        <button
                          key={m.member_user_id}
                          onClick={() => toggleSelect(m.member_user_id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                            borderRadius: 12, border: "none",
                            background: isSelected ? "var(--ios-fill-2)" : "var(--ios-fill)",
                            cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                          }}
                        >
                          <div style={avatarStyle}>
                            {initials(m.full_name, m.email)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="ios-subhead" style={{ fontWeight: 500, color: "var(--ios-label)" }}>{m.full_name ?? "—"}</div>
                            <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>{m.email}</div>
                          </div>
                          <span
                            style={{
                              flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                              border: isSelected ? "none" : "1.5px solid var(--ios-separator)",
                              background: isSelected ? "var(--ios-tint)" : "transparent",
                              color: "var(--ios-on-tint)", display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            {isSelected && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 13, height: 13 }}>
                                <path d="M5 12.5 10 17.5 19 6.5" />
                              </svg>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Mode picker */}
                  {selected.size > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={sectionLabel}>Sharing mode</div>
                      <Segmented
                        options={[
                          { value: "auto", label: "Automatic" },
                          { value: "manual", label: "Manual" },
                        ]}
                        value={mode}
                        onChange={setMode}
                        ariaLabel="Sharing mode"
                      />
                      <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 8, lineHeight: 1.4 }}>
                        {mode === "auto"
                          ? "Visible in their dashboard immediately."
                          : "They receive a request and must accept."}
                      </div>
                    </div>
                  )}
                </>
              )}

              {notYetShared.length === 0 && existing.length === 0 && (
                <div className="ios-subhead" style={{ color: "var(--ios-label-3)", textAlign: "center", padding: "16px 0" }}>
                  Everyone in your circle already has access.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !noCircle && selected.size > 0 && (
          <button
            onClick={handleShare}
            disabled={saving}
            className="ios-btn ios-btn--primary"
            style={{ marginTop: 8, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Sharing…" : `Share with ${selected.size} person${selected.size !== 1 ? "s" : ""} · ${mode === "auto" ? "Automatic" : "Manual"}`}
          </button>
        )}
      </div>
    </>
  );
}
