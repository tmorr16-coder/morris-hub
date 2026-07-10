"use client";

import { useMemo, useState } from "react";
import { Cell, IconBadge, Segmented, Chip, Icons } from "@/components/ios";

export interface TxRow {
  id: string;
  account_id: string;
  date: string;
  amount: number;
  merchant_name: string | null;
  name: string;
  pending: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  personal_finance_category: any;
}

export interface AccountLite {
  id: string;
  name: string;
  mask: string | null;
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtTxDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function categoryFromPFC(pfc: { primary?: string } | null | undefined): string | null {
  if (!pfc?.primary) return null;
  return pfc.primary
    .toLowerCase()
    .split("_")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const PAGE_SIZES = [25, 50, 100, 250, 500] as const;
type Direction = "all" | "in" | "out";

export default function RecentActivityClient({
  transactions,
  accounts,
}: {
  transactions: TxRow[];
  accounts: AccountLite[];
}) {
  const [query, setQuery] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [direction, setDirection] = useState<Direction>("all");
  const [limit, setLimit] = useState<number>(50);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) {
      const c = categoryFromPFC(t.personal_finance_category);
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (accountId && t.account_id !== accountId) return false;
      const tc = categoryFromPFC(t.personal_finance_category);
      if (category && tc !== category) return false;
      if (direction === "in" && t.amount >= 0) return false;
      if (direction === "out" && t.amount < 0) return false;
      if (q) {
        const merch = (t.merchant_name ?? t.name).toLowerCase();
        if (!merch.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, query, accountId, category, direction]);

  const visible = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  function resetFilters() {
    setQuery("");
    setAccountId("");
    setCategory("");
    setDirection("all");
  }
  const anyFilterActive = query || accountId || category || direction !== "all";

  return (
    <>
      {/* Filters */}
      <div style={{ margin: "0 var(--ios-gutter) 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, ...inputStyle }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ios-label-3)" strokeWidth={2} strokeLinecap="round" aria-hidden style={{ flexShrink: 0 }}>
            <circle cx={11} cy={11} r={7} />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search merchant"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 0, border: "none", background: "none", outline: "none", fontSize: 16, color: "var(--ios-label)", fontFamily: "inherit" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}{a.mask ? ` ····${a.mask}` : ""}
              </option>
            ))}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Segmented
            ariaLabel="Direction"
            value={direction}
            onChange={(v) => setDirection(v)}
            options={[
              { value: "all", label: "All" },
              { value: "in", label: "In" },
              { value: "out", label: "Out" },
            ]}
            style={{ flex: 1 }}
          />
          {anyFilterActive && (
            <Chip small onClick={resetFilters}>Clear</Chip>
          )}
        </div>
      </div>

      {/* Result count + page size */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 var(--ios-gutter) 8px" }}>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
          Showing <span className="ios-num" style={{ color: "var(--ios-label)" }}>{visible.length}</span> of{" "}
          <span className="ios-num" style={{ color: "var(--ios-label)" }}>{filtered.length}</span>
          {filtered.length !== transactions.length && (
            <> (of {transactions.length})</>
          )}
        </span>
        <span className="ios-footnote" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ios-label-2)" }}>
          Show
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            style={{ ...inputStyle, padding: "4px 8px", fontSize: 13 }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="ios-subhead" style={{ color: "var(--ios-label-3)", padding: "24px 0", textAlign: "center" }}>
          {transactions.length === 0
            ? "No transactions yet — they'll appear here after the next sync."
            : "No transactions match your filters."}
        </p>
      ) : (
        <div className="ios-list" style={{ margin: "0 var(--ios-gutter)" }}>
          {visible.map((tx) => {
            const acct = accountById.get(tx.account_id);
            const cat = categoryFromPFC(tx.personal_finance_category);
            const isIncome = tx.amount < 0;
            const subParts = [
              fmtTxDate(tx.date),
              acct ? `${acct.name.split(" ")[0]}${acct.mask ? ` ····${acct.mask}` : ""}` : null,
              cat,
            ].filter(Boolean);
            return (
              <Cell
                key={tx.id}
                lead={
                  <IconBadge color={isIncome ? "var(--ios-green)" : "var(--ios-finance)"}>
                    {isIncome ? <Icons.WalletIcon width={17} height={17} /> : <Icons.CartIcon width={17} height={17} />}
                  </IconBadge>
                }
                title={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {tx.merchant_name ?? tx.name}
                    {tx.pending && <Chip small>Pending</Chip>}
                  </span>
                }
                subtitle={<span className="ios-num">{subParts.join(" · ")}</span>}
                trailing={
                  <span
                    className="ios-num ios-callout"
                    style={{ fontWeight: isIncome ? 600 : 400, color: isIncome ? "var(--ios-green)" : "var(--ios-label)" }}
                  >
                    {isIncome ? "+" : "−"}{fmtMoney(Math.abs(tx.amount))}
                  </span>
                }
              />
            );
          })}
        </div>
      )}

      {hasMore && (
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setLimit((l) => l + 50)}
            className="ios-btn ios-btn--plain"
          >
            Load 50 more
          </button>
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  fontSize: 16,
  color: "var(--ios-label)",
  fontFamily: "inherit",
  minWidth: 0,
  outline: "none",
};
