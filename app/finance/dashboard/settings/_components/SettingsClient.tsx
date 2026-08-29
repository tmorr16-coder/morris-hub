"use client";

import { useState, useTransition } from "react";
import { setAccountHidden, deleteLinkedAccount, disconnectInstitution } from "../actions";
import { explainSyncFailure } from "@/lib/finance/explain";
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

const LinkGlyph = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
  </svg>
);

const Check = ({ color = "currentColor" }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** Connection health for one linked institution. */
export interface ItemHealth {
  status: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

/** "2 hours ago" — coarse is fine here, this is a reassurance, not a log. */
function ago(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * One line saying whether this connection is actually working.
 *
 * Sync used to record failures only to the server console, so a link that had
 * been broken for weeks still read "active" and the balances just quietly
 * stopped moving. Green when it last succeeded, amber when it has never synced,
 * red with the reason when the last attempt failed.
 */
function ConnectionStatus({ health }: { health?: ItemHealth }) {
  if (!health) return null;
  const synced = ago(health.lastSyncedAt);
  const failed = health.status === "error" && health.lastError;

  const tone = failed ? "var(--ios-red)" : synced ? "var(--ios-green)" : "var(--ios-orange, #D9772B)";
  return (
    <div className="ios-caption" style={{ color: "var(--ios-label-2)", margin: "0 4px 8px", lineHeight: 1.45 }}>
      <span style={{ color: tone, fontWeight: 600 }}>
        {failed ? "Not syncing" : synced ? "Connected" : "Never synced"}
      </span>
      {synced && <> · last updated {synced}</>}
      {failed && (() => {
        const why = explainSyncFailure(health.lastError);
        return (
          <div style={{ marginTop: 3 }}>
            <div style={{ color: "var(--ios-red)", fontWeight: 600 }}>
              {why.headline}
              {ago(health.lastErrorAt) ? <span style={{ fontWeight: 400 }}> · {ago(health.lastErrorAt)}</span> : null}
            </div>
            <div style={{ color: "var(--ios-label-2)", marginTop: 2 }}>{why.detail}</div>
            {synced && (
              <div style={{ color: "var(--ios-label-3)", marginTop: 2 }}>
                The balances shown are the ones from {synced}.
              </div>
            )}
            {/* The raw message stays reachable — it is what you need if the
                explanation above turns out not to fit. */}
            <details style={{ marginTop: 4 }}>
              <summary style={{ color: "var(--ios-label-3)", cursor: "pointer" }}>Technical detail</summary>
              <code style={{ color: "var(--ios-label-2)", wordBreak: "break-word" }}>{health.lastError}</code>
            </details>
          </div>
        );
      })()}
    </div>
  );
}

export default function SettingsClient({
  initialAccounts,
  itemNameById,
  itemHealth = {},
  members = [],
  initialShares = [],
}: {
  initialAccounts: AccountRow[];
  itemNameById: Record<string, string>;
  itemHealth?: Record<string, ItemHealth>;
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

  /**
   * Delete a linked account.
   *
   * Optimistic like the visibility toggle, but the confirm is not optional and
   * names the consequences: unlike hiding, this takes the transactions with it,
   * and it revokes any shares — a family member would otherwise be left with a
   * broken reference.
   */
  function remove(id: string, name: string, shareCount: number) {
    const consequences = [
      "its transactions",
      shareCount > 0 ? `${shareCount} share${shareCount === 1 ? "" : "s"} with family` : null,
    ].filter(Boolean).join(" and ");
    if (!confirm(`Delete "${name}"?\n\nThis also removes ${consequences}. It won't come back on the next sync. Hiding it instead keeps the history.`)) return;

    setError(null);
    const previous = accounts;
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      const result = await deleteLinkedAccount(id);
      if (result.error) {
        setAccounts(previous);
        setError(result.error);
      }
    });
  }

  /** Disconnect an institution: its credential, accounts and transactions. */
  function disconnect(itemId: string, name: string, acctCount: number) {
    if (!confirm(`Disconnect ${name}?\n\nThis removes ${acctCount} account${acctCount === 1 ? "" : "s"}, their transactions, and the stored credential. You'd need to reconnect to get them back.`)) return;

    setError(null);
    const previous = accounts;
    setAccounts((prev) => prev.filter((a) => a.item_id !== itemId));
    startTransition(async () => {
      const result = await disconnectInstitution(itemId);
      if (result.error) {
        setAccounts(previous);
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
        id: `tmp-${new Date().getTime()}`,
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
          id: `tmp-${acct.id}-${new Date().getTime()}`,
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

  // A selectable iOS member row used by both the share-all and per-account pickers.
  function MemberRow(m: PlatformMember) {
    const isSelected = pickerMemberId === m.id;
    const displayName = m.full_name ?? m.email ?? m.id;
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
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: isSelected ? "var(--ios-tint)" : "var(--ios-fill)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 600,
          color: isSelected ? "var(--ios-on-tint)" : "var(--ios-label)",
        }}>
          {displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="ios-callout" style={{ fontWeight: 500, color: "var(--ios-label)", flex: 1, minWidth: 0 }}>
          {displayName}
        </span>
        {isSelected && (
          <span style={{
            width: 22, height: 22, borderRadius: "50%", background: "var(--ios-tint)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Check color="var(--ios-on-tint)" />
          </span>
        )}
      </button>
    );
  }

  if (accounts.length === 0) {
    return (
      <div style={{ padding: "24px 8px", textAlign: "center" }}>
        <p className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>No accounts connected yet.</p>
      </div>
    );
  }

  return (
    <>
      {/* Stats + Share all */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
          <span className="ios-num" style={{ color: "var(--ios-label)", fontWeight: 600 }}>{visibleCount}</span> visible ·{" "}
          <span className="ios-num" style={{ color: "var(--ios-label)", fontWeight: 600 }}>{hiddenCount}</span> hidden
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isPending && <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>Saving…</span>}
          {members.length > 0 && (
            <button
              type="button"
              className={`ios-chip ios-chip--sm${pickerAccountId === "all" ? " is-selected" : ""}`}
              aria-pressed={pickerAccountId === "all"}
              onClick={() => { setPickerAccountId(pickerAccountId === "all" ? null : "all"); setPickerMemberId(""); }}
            >
              {pickerAccountId === "all" ? "Cancel" : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><LinkGlyph /> Share all</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Share-all picker */}
      {pickerAccountId === "all" && (() => {
        const visibleAccts = accounts.filter((a) => !a.is_hidden);
        const selectedMember = members.find((m) => m.id === pickerMemberId);
        return (
          <div style={{ marginBottom: 16, borderRadius: 12, overflow: "hidden", background: "var(--ios-fill-2)" }}>
            <div style={{ padding: "14px 16px" }}>
              <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 4 }}>
                Share all {visibleAccts.length} visible accounts
              </div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
                You can remove individual accounts from the share after. Accounts already shared with the selected person will be skipped.
              </div>
            </div>
            <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {members.map((m) => MemberRow(m))}
            </div>
            {pickerMemberId && (
              <div style={{ padding: "0 16px 14px" }}>
                <button
                  type="button"
                  className="ios-btn ios-btn--primary"
                  onClick={() => doShareAll(pickerMemberId)}
                  disabled={shareAllPending}
                >
                  {shareAllPending ? "Sharing…" : `Share with ${selectedMember?.full_name ?? selectedMember?.email ?? "member"}`}
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {error && (
        <div className="ios-footnote" style={{ marginBottom: 16, padding: "10px 14px", background: "var(--ios-fill)", borderRadius: 10, color: "var(--ios-red)" }}>
          {error}
        </div>
      )}

      {/* Disconnecting the last bank empties this screen. Without a way back
          you have to know that reconnecting lives on the Money dashboard. */}
      {accounts.length === 0 && (
        <div className="ios-list" style={{ margin: "0 0 16px", padding: 16 }}>
          <div className="ios-subhead" style={{ fontWeight: 600, marginBottom: 4 }}>
            No bank connected
          </div>
          <div className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.5, marginBottom: 10 }}>
            Imported and manual accounts are unaffected. Connecting a bank adds live balances and
            transactions alongside them.
          </div>
          <a
            href="/finance/dashboard"
            className="ios-btn ios-btn--primary"
            style={{ display: "block", textAlign: "center", textDecoration: "none" }}
          >
            Connect a bank
          </a>
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {Array.from(byInstitution.entries()).map(([itemId, accts]) => (
          <div key={itemId}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, margin: "0 4px 8px" }}>
              <h2 className="ios-footnote" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, color: "var(--ios-label-2)", margin: 0 }}>
                {itemNameById[itemId] ?? "Unknown institution"}
              </h2>
              {/* Severing the connection was previously impossible from the UI,
                  which also meant the stored credential could never be removed. */}
              <button
                type="button"
                onClick={() => disconnect(itemId, itemNameById[itemId] ?? "this institution", accts.length)}
                disabled={isPending}
                className="ios-caption"
                style={{ background: "none", border: "none", color: "var(--ios-red)", fontWeight: 600, cursor: isPending ? "default" : "pointer", padding: 0, flexShrink: 0 }}
              >
                Disconnect
              </button>
            </div>
            <ConnectionStatus health={itemHealth[itemId]} />
            <div style={{ background: "var(--ios-fill-2)", borderRadius: 12, overflow: "hidden" }}>
              {accts.map((a, idx) => {
                const acctShares = sharesByAccount.get(a.id) ?? [];
                const isPicker = pickerAccountId === a.id;
                const available = members.filter((m) => !acctShares.some((s) => s.grantee_user_id === m.id));
                const selectedMember = members.find((m) => m.id === pickerMemberId);

                return (
                  <div key={a.id} style={{ borderTop: idx === 0 ? undefined : "0.5px solid var(--ios-separator)" }}>
                    {/* Main account row */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 14px", gap: 10, opacity: a.is_hidden ? 0.5 : 1,
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span className="ios-callout" style={{ fontWeight: 500, color: "var(--ios-label)" }}>{a.name}</span>
                          {a.mask && <span className="ios-num ios-caption" style={{ color: "var(--ios-label-3)" }}>····{a.mask}</span>}
                        </div>
                        <div className="ios-caption" style={{ color: "var(--ios-label-2)", textTransform: "capitalize", marginTop: 2 }}>
                          {TYPE_LABEL[a.type] ?? a.type}
                          {a.subtype ? ` · ${a.subtype.replace(/_/g, " ")}` : ""}
                          <span className="ios-num" style={{ marginLeft: 10 }}>{fmtMoney(a.current_balance)}</span>
                          {acctShares.length > 0 && (
                            <span style={{ marginLeft: 8, color: "var(--ios-tint)", fontWeight: 600 }}>
                              · Shared ({acctShares.length})
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        {/* Share button — always show for visible accounts */}
                        {!a.is_hidden && (
                          <button
                            type="button"
                            className={`ios-chip ios-chip--sm${isPicker ? " is-selected" : ""}`}
                            aria-pressed={isPicker}
                            onClick={() => openPicker(a.id)}
                            disabled={isPending}
                          >
                            {isPicker ? "Cancel" : acctShares.length > 0 ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><LinkGlyph /> {acctShares.length}</span>
                            ) : "+ Share"}
                          </button>
                        )}

                        {/* Delete. Distinct from hiding: hiding keeps the row,
                            its balance history and its transactions. */}
                        <button
                          type="button"
                          onClick={() => remove(a.id, a.name, acctShares.length)}
                          disabled={isPending}
                          title="Delete this account and its transactions"
                          aria-label={`Delete ${a.name}`}
                          className="ios-caption"
                          style={{ background: "none", border: "none", color: "var(--ios-red)", fontWeight: 600, cursor: isPending ? "default" : "pointer", padding: "0 2px", flexShrink: 0 }}
                        >
                          Delete
                        </button>

                        {/* Visibility toggle */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!a.is_hidden}
                          onClick={() => toggle(a.id, a.is_hidden)}
                          disabled={isPending}
                          title={a.is_hidden ? "Hidden — click to show" : "Visible — click to hide"}
                          style={{
                            width: 51, height: 31, borderRadius: 999, border: "none", flexShrink: 0,
                            background: a.is_hidden ? "var(--ios-fill)" : "var(--ios-green)",
                            cursor: isPending ? "default" : "pointer",
                            position: "relative", transition: "background 200ms", padding: 0,
                          }}
                        >
                          <span style={{
                            position: "absolute", top: 2, left: a.is_hidden ? 2 : 22,
                            width: 27, height: 27, borderRadius: "50%", background: "#fff",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 200ms",
                          }} />
                        </button>
                      </div>
                    </div>

                    {/* Share picker — expands inline */}
                    {isPicker && (
                      <div style={{ borderTop: "2px solid var(--ios-tint)", padding: "14px", background: "var(--ios-bg-elevated)" }}>
                        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 12 }}>
                          Share <strong style={{ color: "var(--ios-label)" }}>{a.name}</strong> with
                        </div>

                        {members.length === 0 ? (
                          <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>
                            No other platform members found. Invite people via the Hub admin panel.
                          </div>
                        ) : available.length === 0 ? (
                          <div className="ios-footnote" style={{ color: "var(--ios-label-3)", fontStyle: "italic" }}>
                            All platform members already have access to this account.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {available.map((m) => MemberRow(m))}
                          </div>
                        )}

                        {pickerMemberId && (
                          <button
                            type="button"
                            className="ios-btn ios-btn--primary"
                            style={{ marginTop: 12 }}
                            onClick={() => doShare(a.id)}
                            disabled={isPending}
                          >
                            {isPending ? "Sharing…" : `Share with ${selectedMember?.full_name ?? selectedMember?.email ?? "member"}`}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Existing shares for this account */}
                    {acctShares.length > 0 && !isPicker && (
                      <div style={{ borderTop: "0.5px solid var(--ios-separator)", padding: "6px 14px" }}>
                        {acctShares.map((s) => (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", gap: 8 }}>
                            <span className="ios-footnote" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ios-label-2)", minWidth: 0 }}>
                              <LinkGlyph color="var(--ios-label-3)" />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {s.grantee?.full_name ?? s.grantee?.email ?? "Member"}
                              </span>
                              <span style={{ color: "var(--ios-label-3)", flexShrink: 0 }}>
                                {s.include_in_portfolio ? "· in their portfolio" : "· not in portfolio"}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="ios-btn ios-btn--plain"
                              style={{ color: "var(--ios-red)", padding: "2px 6px", width: "auto", flexShrink: 0 }}
                              onClick={() => doRevoke(s.id)}
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
          </div>
        ))}
      </section>
    </>
  );
}
