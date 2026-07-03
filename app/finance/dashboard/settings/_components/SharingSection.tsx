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

const Check = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

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
        id: `tmp-${new Date().getTime()}`,
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
      <div style={{ padding: "24px 16px", textAlign: "center" }}>
        <p className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>No visible accounts to share. Unhide accounts first.</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div style={{ margin: "0 var(--ios-gutter)", padding: "16px 18px", background: "var(--ios-cell)", borderRadius: 12 }}>
        <p className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>No other platform members found. Invite family members via the Hub admin panel.</p>
      </div>
    );
  }

  return (
    <section style={{ margin: "0 var(--ios-gutter)" }}>
      {error && (
        <div className="ios-footnote" style={{ marginBottom: 14, padding: "10px 14px", background: "var(--ios-fill)", borderRadius: 10, color: "var(--ios-red)" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleAccounts.map((account) => {
          const acctShares = sharesByAccount.get(account.id) ?? [];
          const isPicker = pickerAccountId === account.id;

          return (
            <div key={account.id} style={{ background: "var(--ios-cell)", borderRadius: 12, overflow: "hidden" }}>
              {/* Account row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span className="ios-callout" style={{ fontWeight: 500, color: "var(--ios-label)" }}>{account.name}</span>
                    {account.mask && (
                      <span className="ios-num ios-caption" style={{ color: "var(--ios-label-3)" }}>····{account.mask}</span>
                    )}
                  </div>
                  <div className="ios-caption" style={{ color: "var(--ios-label-2)", marginTop: 2, textTransform: "capitalize" }}>
                    {itemNameById[account.item_id] ?? ""} · {TYPE_LABEL[account.type] ?? account.type}
                    <span className="ios-num" style={{ marginLeft: 8 }}>{fmtMoney(account.current_balance)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className={`ios-chip ios-chip--sm${isPicker ? " is-selected" : ""}`}
                  aria-pressed={isPicker}
                  onClick={() => isPicker ? setPickerAccountId(null) : openPicker(account.id)}
                  disabled={isPending}
                  style={{ flexShrink: 0 }}
                >
                  {isPicker ? "Cancel" : acctShares.length > 0 ? `Shared (${acctShares.length})` : "+ Share"}
                </button>
              </div>

              {/* Member picker */}
              {isPicker && (() => {
                const available = members.filter((m) => !acctShares.some((s) => s.grantee_user_id === m.id));
                const selectedMember = members.find((m) => m.id === pickerMemberId);
                return (
                  <div style={{ borderTop: "2px solid var(--ios-tint)", padding: "14px 16px", background: "var(--ios-fill-2)" }}>
                    <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 12 }}>
                      Share <strong style={{ color: "var(--ios-label)" }}>{account.name}</strong> with
                    </div>

                    {available.length === 0 ? (
                      <div className="ios-footnote" style={{ color: "var(--ios-label-3)", fontStyle: "italic" }}>
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
                              type="button"
                              onClick={() => setPickerMemberId(isSelected ? "" : m.id)}
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                                border: "none", width: "100%", textAlign: "left", fontFamily: "inherit",
                                background: isSelected ? "var(--ios-fill)" : "var(--ios-bg-elevated)",
                              }}
                            >
                              <span style={{
                                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                                background: isSelected ? "var(--ios-tint)" : "var(--ios-fill)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 15, fontWeight: 600,
                                color: isSelected ? "var(--ios-on-tint)" : "var(--ios-label)",
                              }}>
                                {initial}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="ios-callout" style={{ fontWeight: 500, color: "var(--ios-label)" }}>
                                  {displayName}
                                </div>
                                {m.full_name && m.email && (
                                  <div className="ios-footnote" style={{ color: "var(--ios-label-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {m.email}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <span style={{
                                  width: 22, height: 22, borderRadius: "50%", background: "var(--ios-tint)",
                                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                  <Check color="var(--ios-on-tint)" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {pickerMemberId && (
                      <button
                        type="button"
                        className="ios-btn ios-btn--primary"
                        style={{ marginTop: 14 }}
                        onClick={share}
                        disabled={isPending}
                      >
                        {isPending ? "Sharing…" : `Share with ${selectedMember?.full_name ?? selectedMember?.email ?? "member"}`}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Existing shares for this account */}
              {acctShares.length > 0 && (
                <div>
                  {acctShares.map((share) => (
                    <div key={share.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 16px", gap: 12,
                      borderTop: "0.5px solid var(--ios-separator)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {/* Avatar initial */}
                        <span style={{
                          width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                          background: "var(--ios-fill)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 600, color: "var(--ios-tint)",
                        }}>
                          {(share.grantee?.full_name ?? share.grantee?.email ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                        <span className="ios-footnote" style={{ color: "var(--ios-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {share.grantee?.full_name ?? share.grantee?.email ?? "Family member"}
                        </span>
                        <span className="ios-caption" style={{ color: "var(--ios-label-3)", flexShrink: 0 }}>
                          {share.include_in_portfolio ? "· in their portfolio" : "· not in portfolio"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="ios-btn ios-btn--plain"
                        style={{ color: "var(--ios-red)", padding: "4px 8px", width: "auto", flexShrink: 0 }}
                        onClick={() => revoke(share.id)}
                        disabled={isPending}
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
    </section>
  );
}
