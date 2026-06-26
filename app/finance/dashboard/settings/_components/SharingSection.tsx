"use client";

import { useState, useTransition } from "react";
import { shareAccount, revokeShare } from "../share-actions";
import type { AccountRow } from "./SettingsClient";
import type { PlatformMember, AccountShare } from "../share-actions";

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const TYPE_LABEL: Record<string, string> = {
  depository: "Cash", credit: "Credit", loan: "Loan",
  investment: "Investment", brokerage: "Investment", other: "Other",
};

interface Props {
  accounts: AccountRow[];
  members: PlatformMember[];
  existingShares: AccountShare[];   // shares the owner has already created
  itemNameById: Record<string, string>;
}

export default function SharingSection({ accounts, members, existingShares, itemNameById }: Props) {
  const [shares, setShares] = useState(existingShares);
  const [pickerAccountId, setPickerAccountId] = useState<string | null>(null);
  const [pickerMemberId, setPickerMemberId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleAccounts = accounts.filter((a) => !a.is_hidden);

  // Shares indexed by accountId → list
  const sharesByAccount = new Map<string, AccountShare[]>();
  for (const s of shares) {
    if (!sharesByAccount.has(s.account_id)) sharesByAccount.set(s.account_id, []);
    sharesByAccount.get(s.account_id)!.push(s);
  }

  function openPicker(accountId: string) {
    setPickerAccountId(accountId);
    setPickerMemberId("");
    setError(null);
  }

  function share() {
    if (!pickerAccountId || !pickerMemberId) return;
    setError(null);
    startTransition(async () => {
      const res = await shareAccount(pickerAccountId, pickerMemberId);
      if (res.error) { setError(res.error); return; }
      // Optimistic: add to local shares list
      const member = members.find((m) => m.id === pickerMemberId);
      setShares((prev) => [...prev, {
        id: `tmp-${Date.now()}`,
        account_id: pickerAccountId,
        grantee_user_id: pickerMemberId,
        include_in_portfolio: false,
        created_at: new Date().toISOString(),
        grantee: member ?? null,
      }]);
      setPickerAccountId(null);
    });
  }

  function revoke(shareId: string) {
    setError(null);
    startTransition(async () => {
      const res = await revokeShare(shareId);
      if (res.error) { setError(res.error); return; }
      setShares((prev) => prev.filter((s) => s.id !== shareId));
    });
  }

  if (visibleAccounts.length === 0) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "var(--color-ink-3)", fontSize: 13 }}>
        No visible accounts to share. Unhide accounts first.
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div style={{ padding: "20px", background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 10, fontSize: 13, color: "var(--color-ink-3)" }}>
        No other platform members found. Invite family members via the Hub admin panel.
      </div>
    );
  }

  return (
    <>
      {error && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(154,59,42,0.08)", border: "1px solid var(--color-red)", borderRadius: 8, fontSize: 13, color: "var(--color-red)" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleAccounts.map((account) => {
          const acctShares = sharesByAccount.get(account.id) ?? [];
          const isPicker = pickerAccountId === account.id;

          return (
            <div key={account.id} style={{
              background: "var(--color-paper-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "var(--shadow-card)",
            }}>
              {/* Account row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink)" }}>{account.name}</span>
                    {account.mask && (
                      <span className="mono" style={{ fontSize: 11, color: "var(--color-ink-4)" }}>····{account.mask}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2, textTransform: "capitalize" }}>
                    {itemNameById[account.item_id] ?? ""} · {TYPE_LABEL[account.type] ?? account.type}
                    <span className="mono" style={{ marginLeft: 8 }}>{fmtMoney(account.current_balance)}</span>
                  </div>
                </div>

                <button
                  onClick={() => isPicker ? setPickerAccountId(null) : openPicker(account.id)}
                  disabled={isPending}
                  style={{
                    padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${isPicker ? "var(--color-bronze)" : "var(--color-rule)"}`,
                    background: isPicker ? "var(--color-bronze-soft, rgba(139,106,71,0.08))" : "transparent",
                    color: isPicker ? "var(--color-bronze)" : "var(--color-ink-2)",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  {isPicker ? "Cancel" : acctShares.length > 0 ? `Shared (${acctShares.length})` : "+ Share"}
                </button>
              </div>

              {/* Member picker */}
              {isPicker && (() => {
                const available = members.filter((m) => !acctShares.some((s) => s.grantee_user_id === m.id));
                const selectedMember = members.find((m) => m.id === pickerMemberId);
                return (
                  <div style={{
                    borderTop: "2px solid var(--color-bronze)",
                    padding: "16px 18px",
                    background: "var(--color-paper-deep)",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink-2)", marginBottom: 12 }}>
                      Share <strong>{account.name}</strong> with:
                    </div>

                    {available.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--color-ink-4)", fontStyle: "italic" }}>
                        All platform members already have access to this account.
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {available.map((m) => {
                          const displayName = m.full_name ?? m.email ?? m.id;
                          const initial = displayName.slice(0, 1).toUpperCase();
                          const isSelected = pickerMemberId === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => setPickerMemberId(isSelected ? "" : m.id)}
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                                border: `2px solid ${isSelected ? "var(--color-bronze)" : "var(--color-rule)"}`,
                                background: isSelected ? "rgba(139,106,71,0.1)" : "var(--color-paper-card)",
                                textAlign: "left", width: "100%", fontFamily: "inherit",
                                transition: "border-color 120ms",
                              }}
                            >
                              <div style={{
                                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                                background: isSelected ? "var(--color-bronze)" : "var(--color-paper-deep)",
                                border: `1px solid ${isSelected ? "var(--color-bronze)" : "var(--color-rule)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 14, fontWeight: 700,
                                color: isSelected ? "#fff" : "var(--color-ink-2)",
                              }}>
                                {initial}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>
                                  {displayName}
                                </div>
                                {m.full_name && m.email && (
                                  <div style={{ fontSize: 11, color: "var(--color-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {m.email}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <div style={{
                                  width: 22, height: 22, borderRadius: "50%",
                                  background: "var(--color-bronze)", flexShrink: 0,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  color: "#fff", fontSize: 13, fontWeight: 700,
                                }}>✓</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {pickerMemberId && (
                      <button
                        onClick={share}
                        disabled={isPending}
                        style={{
                          marginTop: 14, width: "100%", padding: "12px", borderRadius: 8,
                          border: "none", background: "var(--color-bronze)",
                          color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {isPending ? "Sharing…" : `Share with ${selectedMember?.full_name ?? selectedMember?.email ?? "member"}`}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Existing shares for this account */}
              {acctShares.length > 0 && (
                <div style={{ borderTop: "1px solid var(--color-rule-soft)" }}>
                  {acctShares.map((share) => (
                    <div key={share.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 18px", gap: 12,
                      borderTop: "1px solid var(--color-rule-soft)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Avatar initial */}
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "var(--color-bronze-soft, rgba(139,106,71,0.15))",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: "var(--color-bronze)",
                        }}>
                          {(share.grantee?.full_name ?? share.grantee?.email ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--color-ink-2)" }}>
                          {share.grantee?.full_name ?? share.grantee?.email ?? "Family member"}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--color-ink-4)" }}>
                          {share.include_in_portfolio ? "· in their portfolio" : "· not in portfolio"}
                        </span>
                      </div>
                      <button
                        onClick={() => revoke(share.id)}
                        disabled={isPending}
                        style={{
                          padding: "4px 10px", borderRadius: 6, fontSize: 11,
                          border: "1px solid var(--color-rule)",
                          background: "transparent", color: "var(--color-red)",
                          cursor: "pointer",
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
    </>
  );
}
