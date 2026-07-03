"use client";

import { useState, useTransition } from "react";
import { toggleIncludeInPortfolio } from "../settings/share-actions";
import type { SharedWithMe } from "../settings/share-actions";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";

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

  const owners = Array.from(byOwner.entries());

  return (
    <section style={{ marginTop: 32 }}>
      <h2 className="ios-group-header" style={{ marginLeft: "var(--ios-gutter)" }}>
        Shared with me
      </h2>

      {error && (
        <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: "0 var(--ios-gutter) 8px" }}>
          {error}
        </p>
      )}

      {owners.map(([ownerId, { owner, shares: ownerShares }], oi) => (
        <Group
          key={ownerId}
          header={owner?.full_name ?? owner?.email ?? "Family member"}
          footer={
            oi === owners.length - 1 ? (
              <>
                Toggle accounts on to include their balance in your net position. Manage sharing in{" "}
                <a href="/finance/dashboard/settings#sharing" style={{ color: "var(--ios-tint)", textDecoration: "none" }}>Settings</a>.
              </>
            ) : undefined
          }
        >
          {ownerShares.map((share) => {
            const acct = share.account;
            const balance = acct?.current_balance ?? null;
            const on = share.include_in_portfolio;
            return (
              <Cell
                key={share.id}
                lead={
                  <IconBadge color="var(--ios-finance)">
                    <Icons.PersonIcon width={17} height={17} />
                  </IconBadge>
                }
                title={
                  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                    {acct?.name ?? "Account"}
                    {acct?.mask && (
                      <span className="ios-num ios-caption" style={{ color: "var(--ios-label-3)" }}>····{acct.mask}</span>
                    )}
                  </span>
                }
                subtitle={
                  <span style={{ textTransform: "capitalize" }}>
                    {acct?.institution_name ? `${acct.institution_name} · ` : ""}
                    {acct?.type ? TYPE_LABEL[acct.type] ?? acct.type : ""}
                    {acct?.subtype ? ` · ${acct.subtype.replace(/_/g, " ")}` : ""}
                  </span>
                }
                trailing={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                    <span className="ios-num ios-callout" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
                      {fmtMoney(balance)}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => toggle(share.id, share.include_in_portfolio)}
                      disabled={isPending}
                      title={on ? "Remove from portfolio total" : "Add to portfolio total"}
                      style={{
                        width: 51, height: 31, borderRadius: 999, border: "none", flexShrink: 0,
                        background: on ? "var(--ios-green)" : "var(--ios-fill)",
                        cursor: isPending ? "default" : "pointer",
                        position: "relative", transition: "background 200ms", padding: 0,
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 2,
                        left: on ? 22 : 2,
                        width: 27, height: 27, borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        transition: "left 200ms",
                      }} />
                    </button>
                  </span>
                }
              />
            );
          })}
        </Group>
      ))}
    </section>
  );
}
