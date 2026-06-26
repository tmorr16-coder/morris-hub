"use client";

import { useState, useTransition } from "react";
import { toggleIncludeInPortfolio } from "../settings/share-actions";
import type { SharedWithMe } from "../settings/share-actions";

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const TYPE_LABEL: Record<string, string> = {
  depository: "Cash", credit: "Credit", loan: "Loan",
  investment: "Investment", brokerage: "Investment", other: "Other",
};

export default function SharedAccountsSection({ initialShares }: { initialShares: SharedWithMe[] }) {
  const [shares, setShares] = useState(initialShares);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (shares.length === 0) return null;

  function toggle(shareId: string, currentValue: boolean) {
    const next = !currentValue;
    setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, include_in_portfolio: next } : s));
    setError(null);
    startTransition(async () => {
      const res = await toggleIncludeInPortfolio(shareId, next);
      if (res.error) {
        setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, include_in_portfolio: currentValue } : s));
        setError(res.error);
      }
    });
  }

  // Group by owner
  const byOwner = new Map<string, { owner: SharedWithMe["owner"]; shares: SharedWithMe[] }>();
  for (const s of shares) {
    const ownerId = s.owner_user_id;
    if (!byOwner.has(ownerId)) byOwner.set(ownerId, { owner: s.owner, shares: [] });
    byOwner.get(ownerId)!.shares.push(s);
  }

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink-2)", marginBottom: 12, letterSpacing: "-0.01em" }}>
        Shared with me
      </h2>

      {error && (
        <div style={{ marginBottom: 12, padding: "8px 14px", background: "rgba(154,59,42,0.08)", border: "1px solid var(--color-red)", borderRadius: 8, fontSize: 12, color: "var(--color-red)" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from(byOwner.entries()).map(([ownerId, { owner, shares: ownerShares }]) => (
          <div key={ownerId}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              {owner?.full_name ?? owner?.email ?? "Family member"}
            </div>
            <div style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
              {ownerShares.map((share, idx) => {
                const acct = share.account;
                const balance = acct?.current_balance ?? null;
                return (
                  <div key={share.id} style={{
                    display: "flex", alignItems: "center",
                    padding: "13px 18px", gap: 14,
                    borderTop: idx === 0 ? "none" : "1px solid var(--color-rule-soft)",
                  }}>
                    {/* Include toggle */}
                    <button
                      onClick={() => toggle(share.id, share.include_in_portfolio)}
                      disabled={isPending}
                      title={share.include_in_portfolio ? "Remove from portfolio total" : "Add to portfolio total"}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: "none", flexShrink: 0,
                        background: share.include_in_portfolio ? "var(--color-bronze)" : "var(--color-paper-deep, #e8e0d0)",
                        cursor: isPending ? "default" : "pointer",
                        position: "relative", transition: "background 150ms",
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 2,
                        left: share.include_in_portfolio ? 22 : 2,
                        width: 20, height: 20, borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                        transition: "left 150ms",
                      }} />
                    </button>

                    {/* Account info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink)" }}>
                          {acct?.name ?? "Account"}
                        </span>
                        {acct?.mask && (
                          <span className="mono" style={{ fontSize: 11, color: "var(--color-ink-4)" }}>····{acct.mask}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2, textTransform: "capitalize" }}>
                        {acct?.institution_name ? `${acct.institution_name} · ` : ""}
                        {acct?.type ? TYPE_LABEL[acct.type] ?? acct.type : ""}
                        {acct?.subtype ? ` · ${acct.subtype.replace(/_/g, " ")}` : ""}
                      </div>
                    </div>

                    {/* Balance */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: "var(--color-ink)" }}>
                        {fmtMoney(balance)}
                      </div>
                      <div style={{ fontSize: 10, color: share.include_in_portfolio ? "var(--color-bronze)" : "var(--color-ink-4)", marginTop: 2 }}>
                        {share.include_in_portfolio ? "In portfolio" : "Not in portfolio"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 10 }}>
        Toggle accounts on to include their balance in your net position. Manage sharing in{" "}
        <a href="/finance/dashboard/settings#sharing" style={{ color: "var(--color-bronze)", textDecoration: "none" }}>Settings</a>.
      </p>
    </section>
  );
}
