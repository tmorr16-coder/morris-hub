"use client";

import { useState, useTransition } from "react";
import { setAccountHidden } from "../actions";
import { shareAccount, revokeShare } from "../share-actions";
import type { PlatformMember, AccountShare } from "../share-actions";

export interface AccountRow {
  id: string;
  item_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  current_balance: number | null;
  is_hidden: boolean;
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

const TYPE_LABEL: Record<string, string> = {
  depository: "Cash", credit: "Credit", loan: "Loan",
  investment: "Investment", brokerage: "Investment", other: "Other",
};

export default function SettingsClient({
  initialAccounts,
  itemNameById,
  members = [],
  initialShares = [],
}: {
  initialAccounts: AccountRow[];
  itemNameById: Record<string, string>;
  members?: PlatformMember[];
  initialShares?: AccountShare[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [shares, setShares] = useState(initialShares);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Which account's share picker is open (null = none, "all" = share-all picker)
  const [pickerAccountId, setPickerAccountId] = useState<string | null>(null);
  const [pickerMemberId, setPickerMemberId] = useState<string>("");
  const [shareAllPending, setShareAllPending] = useState(false);

  const visibleCount = accounts.filter((a) => !a.is_hidden).length;
  const hiddenCount = accounts.length - visibleCount;

  // Shares by accountId
  const sharesByAccount = new Map<string, AccountShare[]>();
  for (const s of shares) {
    if (!sharesByAccount.has(s.account_id)) sharesByAccount.set(s.account_id, []);
    sharesByAccount.get(s.account_id)!.push(s);
  }

  function toggle(id: string, currentlyHidden: boolean) {
    setError(null);
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, is_hidden: !currentlyHidden } : a)));
    startTransition(async () => {
      const result = await setAccountHidden(id, !currentlyHidden);
      if (result.error) {
        setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, is_hidden: currentlyHidden } : a)));
        setError(result.error);
      }
    });
  }

  function openPicker(accountId: string) {
    if (pickerAccountId === accountId) {
      setPickerAccountId(null);
    } else {
      setPickerAccountId(accountId);
      setPickerMemberId("");
    }
  }

  function doShare(accountId: string) {
    if (!pickerMemberId) return;
    startTransition(async () => {
      const res = await shareAccount(accountId, pickerMemberId);
      if (res.error) { setError(res.error); return; }
      const member = members.find((m) => m.id === pickerMemberId);
      setShares((prev) => [...prev, {
        id: `tmp-${Date.now()}`,
        account_id: accountId,
        grantee_user_id: pickerMemberId,
        include_in_portfolio: false,
        created_at: new Date().toISOString(),
        grantee: member ?? null,
      }]);
      setPickerAccountId(null);
      setPickerMemberId("");
    });
  }

  function doRevoke(shareId: string) {
    startTransition(async () => {
      const res = await revokeShare(shareId);
      if (res.error) { setError(res.error); return; }
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    });
  }

  // Share ALL visible accounts with a single person at once
  async function doShareAll(memberId: string) {
    if (!memberId) return;
    setShareAllPending(true);
    setError(null);
    const visibleAccounts = accounts.filter((a) => !a.is_hidden);
    const alreadyShared = new Set(shares.filter((s) => s.grantee_user_id === memberId).map((s) => s.account_id));
    const toShare = visibleAccounts.filter((a) => !alreadyShared.has(a.id));
    const member = members.find((m) => m.id === memberId);
    const newShares: AccountShare[] = [];
    for (const acct of toShare) {
      const res = await shareAccount(acct.id, memberId);
      if (!res.error) {
        newShares.push({
          id: `tmp-${acct.id}-${Date.now()}`,
          account_id: acct.id,
          grantee_user_id: memberId,
          include_in_portfolio: false,
          created_at: new Date().toISOString(),
          grantee: member ?? null,
        });
      }
    }
    setShares((prev) => [...prev, ...newShares]);
    setPickerAccountId(null);
    setPickerMemberId("");
    setShareAllPending(false);
  }

  // Group by institution
  const byInstitution = new Map<string, AccountRow[]>();
  for (const a of accounts) {
    if (!byInstitution.has(a.item_id)) byInstitution.set(a.item_id, []);
    byInstitution.get(a.item_id)!.push(a);
  }

  if (accounts.length === 0) {
    return (
      <div style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "40px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "var(--color-ink-3)" }}>No accounts connected yet.</p>
      </div>
    );
  }

  return (
    <>
      {/* Stats + Share all */}
      <section style={{ marginBottom: 16, padding: "12px 16px", background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
          <span className="mono" style={{ color: "var(--color-ink)" }}>{visibleCount}</span> visible ·{" "}
          <span className="mono" style={{ color: "var(--color-ink)" }}>{hiddenCount}</span> hidden
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isPending && <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>Saving…</span>}
          {members.length > 0 && (
            <button
              onClick={() => { setPickerAccountId(pickerAccountId === "all" ? null : "all"); setPickerMemberId(""); }}
              style={{
                padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                border: `1px solid ${pickerAccountId === "all" ? "var(--color-bronze)" : "var(--color-rule)"}`,
                background: pickerAccountId === "all" ? "rgba(139,106,71,0.1)" : "transparent",
                color: pickerAccountId === "all" ? "var(--color-bronze)" : "var(--color-ink-3)",
                cursor: "pointer",
              }}
            >
              {pickerAccountId === "all" ? "Cancel" : "🔗 Share all accounts"}
            </button>
          )}
        </div>
      </section>

      {/* Share-all picker */}
      {pickerAccountId === "all" && (() => {
        const visibleAccts = accounts.filter((a) => !a.is_hidden);
        const selectedMember = members.find((m) => m.id === pickerMemberId);
        return (
          <div style={{
            marginBottom: 16, borderRadius: 10, overflow: "hidden",
            border: "2px solid var(--color-bronze)",
            background: "var(--color-paper-deep)",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-rule-soft)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>
                Share all {visibleAccts.length} visible accounts with:
              </div>
              <div style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
                You can remove individual accounts from the share after. Accounts already shared with the selected person will be skipped.
              </div>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {members.map((m) => {
                const isSelected = pickerMemberId === m.id;
                const displayName = m.full_name ?? m.email ?? m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPickerMemberId(isSelected ? "" : m.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 14px", borderRadius: 8, cursor: "pointer",
                      border: `2px solid ${isSelected ? "var(--color-bronze)" : "var(--color-rule)"}`,
                      background: isSelected ? "rgba(139,106,71,0.1)" : "var(--color-paper-card)",
                      textAlign: "left", width: "100%", fontFamily: "inherit",
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: isSelected ? "var(--color-bronze)" : "var(--color-paper-deep)",
                      border: `1px solid ${isSelected ? "var(--color-bronze)" : "var(--color-rule)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700,
                      color: isSelected ? "#fff" : "var(--color-ink-2)",
                    }}>
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", flex: 1 }}>
                      {displayName}
                    </span>
                    {isSelected && (
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--color-bronze)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>✓</div>
                    )}
                  </button>
                );
              })}
            </div>
            {pickerMemberId && (
              <div style={{ padding: "0 16px 14px" }}>
                <button
                  onClick={() => doShareAll(pickerMemberId)}
                  disabled={shareAllPending}
                  style={{
                    width: "100%", padding: "12px", borderRadius: 8,
                    border: "none", background: "var(--color-bronze)",
                    color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {shareAllPending ? "Sharing…" : `Share all accounts with ${selectedMember?.full_name ?? selectedMember?.email ?? "member"}`}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {error && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(154,59,42,0.08)", border: "1px solid var(--color-red)", borderRadius: 8, fontSize: 13, color: "var(--color-red)" }}>
          {error}
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {Array.from(byInstitution.entries()).map(([itemId, accts]) => (
          <div key={itemId}>
            <h2 className="serif" style={{ fontSize: 18, marginBottom: 10, color: "var(--color-ink)" }}>
              {itemNameById[itemId] ?? "Unknown institution"}
            </h2>
            <div style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
              {accts.map((a, idx) => {
                const acctShares = sharesByAccount.get(a.id) ?? [];
                const isPicker = pickerAccountId === a.id;
                const available = members.filter((m) => !acctShares.some((s) => s.grantee_user_id === m.id));
                const selectedMember = members.find((m) => m.id === pickerMemberId);

                return (
                  <div key={a.id} style={{ borderTop: idx === 0 ? undefined : "1px solid var(--color-rule-soft)" }}>
                    {/* Main account row */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 18px", gap: 10, opacity: a.is_hidden ? 0.55 : 1,
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink)" }}>{a.name}</span>
                          {a.mask && <span className="mono" style={{ fontSize: 11, color: "var(--color-ink-4)" }}>····{a.mask}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-ink-3)", textTransform: "capitalize", marginTop: 2 }}>
                          {TYPE_LABEL[a.type] ?? a.type}
                          {a.subtype ? ` · ${a.subtype.replace(/_/g, " ")}` : ""}
                          <span className="mono" style={{ marginLeft: 10 }}>{fmtMoney(a.current_balance)}</span>
                          {acctShares.length > 0 && (
                            <span style={{ marginLeft: 8, color: "var(--color-bronze)", fontWeight: 600 }}>
                              · Shared ({acctShares.length})
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        {/* Share button — always show for visible accounts */}
                        {!a.is_hidden && (
                          <button
                            onClick={() => openPicker(a.id)}
                            disabled={isPending}
                            style={{
                              padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                              border: `1px solid ${isPicker ? "var(--color-bronze)" : "var(--color-rule)"}`,
                              background: isPicker ? "rgba(139,106,71,0.1)" : "transparent",
                              color: isPicker ? "var(--color-bronze)" : "var(--color-ink-3)",
                              cursor: "pointer",
                            }}
                          >
                            {isPicker ? "Cancel" : acctShares.length > 0 ? `🔗 ${acctShares.length}` : "+ Share"}
                          </button>
                        )}

                        {/* Visibility toggle */}
                        <button
                          onClick={() => toggle(a.id, a.is_hidden)}
                          disabled={isPending}
                          style={{
                            position: "relative", width: 44, height: 24, borderRadius: 12,
                            border: "none",
                            background: a.is_hidden ? "var(--color-paper-deep)" : "var(--color-bronze)",
                            cursor: isPending ? "default" : "pointer",
                            transition: "background 150ms", flexShrink: 0,
                          }}
                          aria-pressed={!a.is_hidden}
                          title={a.is_hidden ? "Hidden — click to show" : "Visible — click to hide"}
                        >
                          <span style={{
                            position: "absolute", top: 2, left: a.is_hidden ? 2 : 22,
                            width: 20, height: 20, borderRadius: "50%", background: "#fff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 150ms",
                          }} />
                        </button>
                      </div>
                    </div>

                    {/* Share picker — expands inline */}
                    {isPicker && (
                      <div style={{
                        borderTop: "2px solid var(--color-bronze)",
                        padding: "16px 18px",
                        background: "var(--color-paper-deep)",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink-2)", marginBottom: 12 }}>
                          Share <strong>{a.name}</strong> with:
                        </div>

                        {members.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--color-ink-4)" }}>
                            No other platform members found. Invite people via the Hub admin panel.
                          </div>
                        ) : available.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--color-ink-4)", fontStyle: "italic" }}>
                            All platform members already have access to this account.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {available.map((m) => {
                              const displayName = m.full_name ?? m.email ?? m.id;
                              const isSelected = pickerMemberId === m.id;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => setPickerMemberId(isSelected ? "" : m.id)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 12,
                                    padding: "11px 14px", borderRadius: 8, cursor: "pointer",
                                    border: `2px solid ${isSelected ? "var(--color-bronze)" : "var(--color-rule)"}`,
                                    background: isSelected ? "rgba(139,106,71,0.1)" : "var(--color-paper-card)",
                                    textAlign: "left", width: "100%", fontFamily: "inherit",
                                  }}
                                >
                                  <div style={{
                                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                                    background: isSelected ? "var(--color-bronze)" : "var(--color-paper-deep)",
                                    border: `1px solid ${isSelected ? "var(--color-bronze)" : "var(--color-rule)"}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 13, fontWeight: 700,
                                    color: isSelected ? "#fff" : "var(--color-ink-2)",
                                  }}>
                                    {displayName.slice(0, 1).toUpperCase()}
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-ink)", flex: 1 }}>
                                    {displayName}
                                  </span>
                                  {isSelected && (
                                    <div style={{
                                      width: 22, height: 22, borderRadius: "50%",
                                      background: "var(--color-bronze)",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      color: "#fff", fontSize: 13, fontWeight: 700, flexShrink: 0,
                                    }}>✓</div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {pickerMemberId && (
                          <button
                            onClick={() => doShare(a.id)}
                            disabled={isPending}
                            style={{
                              marginTop: 12, width: "100%", padding: "12px", borderRadius: 8,
                              border: "none", background: "var(--color-bronze)",
                              color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            {isPending ? "Sharing…" : `Share with ${selectedMember?.full_name ?? selectedMember?.email ?? "member"}`}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Existing shares for this account */}
                    {acctShares.length > 0 && !isPicker && (
                      <div style={{ borderTop: "1px solid var(--color-rule-soft)", padding: "8px 18px", background: "var(--color-paper-deep)" }}>
                        {acctShares.map((s) => (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
                            <span style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
                              🔗 {s.grantee?.full_name ?? s.grantee?.email ?? "Member"}
                              <span style={{ color: "var(--color-ink-4)", marginLeft: 6 }}>
                                {s.include_in_portfolio ? "· in their portfolio" : "· not in portfolio"}
                              </span>
                            </span>
                            <button
                              onClick={() => doRevoke(s.id)}
                              disabled={isPending}
                              style={{
                                fontSize: 11, color: "var(--color-red)", background: "none",
                                border: "none", cursor: "pointer", padding: "2px 6px",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
