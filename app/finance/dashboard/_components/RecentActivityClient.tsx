"use client";

import { useMemo, useState } from "react";

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
      {/* Filter row */}
      <div
        style={{
          background: "var(--color-paper-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 14,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr auto auto",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          type="search"
          placeholder="Search merchant…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={inputStyle}
        />
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}{a.mask ? ` ····${a.mask}` : ""}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 0, border: "1px solid var(--color-rule)", borderRadius: 8, overflow: "hidden" }}>
          {(["all", "in", "out"] as Direction[]).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              style={{
                padding: "6px 10px",
                fontSize: 11,
                fontFamily: "inherit",
                border: "none",
                background: direction === d ? "var(--color-paper-deep)" : "transparent",
                color: direction === d ? "var(--color-ink)" : "var(--color-ink-3)",
                cursor: "pointer",
                fontWeight: direction === d ? 600 : 400,
              }}
            >
              {d === "all" ? "All" : d === "in" ? "In" : "Out"}
            </button>
          ))}
        </div>
        {anyFilterActive && (
          <button
            onClick={resetFilters}
            style={{
              padding: "6px 10px",
              fontSize: 11,
              border: "1px solid var(--color-rule)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--color-ink-3)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Clear filters"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Result count + page size */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 11, color: "var(--color-ink-3)" }}>
        <span>
          Showing <span className="mono" style={{ color: "var(--color-ink)" }}>{visible.length}</span> of{" "}
          <span className="mono" style={{ color: "var(--color-ink)" }}>{filtered.length}</span>
          {filtered.length !== transactions.length && (
            <> (filtered from {transactions.length})</>
          )}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          Show
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            style={{ ...inputStyle, padding: "4px 6px", fontSize: 11 }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </span>
      </div>

      {filtered.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "24px 0", textAlign: "center" }}>
          {transactions.length === 0
            ? "No transactions yet — they'll appear here after the next sync."
            : "No transactions match your filters."}
        </p>
      ) : (
        <div
          style={{
            background: "var(--color-paper-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 130px 160px 120px",
              padding: "10px 18px",
              borderBottom: "1px solid var(--color-rule)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              background: "var(--color-paper-deep)",
            }}
          >
            <div>Date</div>
            <div>Merchant</div>
            <div>Category</div>
            <div>Account</div>
            <div style={{ textAlign: "right" }}>Amount</div>
          </div>
          {visible.map((tx, idx) => {
            const acct = accountById.get(tx.account_id);
            const cat = categoryFromPFC(tx.personal_finance_category);
            const isIncome = tx.amount < 0;
            return (
              <div
                key={tx.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "90px 1fr 130px 160px 120px",
                  padding: "12px 18px",
                  borderTop: idx === 0 ? undefined : "1px solid var(--color-rule-soft)",
                  fontSize: 13,
                  alignItems: "center",
                }}
              >
                <div className="mono" style={{ fontSize: 12, color: "var(--color-ink-3)" }}>{fmtTxDate(tx.date)}</div>
                <div style={{ color: "var(--color-ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  {tx.merchant_name ?? tx.name}
                  {tx.pending && (
                    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: "var(--color-paper-deep)", color: "var(--color-ink-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Pending
                    </span>
                  )}
                </div>
                <div>
                  {cat && (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "var(--color-paper-deep)", color: "var(--color-ink-2)", whiteSpace: "nowrap" }}>
                      {cat}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
                  {acct ? `${acct.name.split(" ")[0]}${acct.mask ? ` ····${acct.mask}` : ""}` : "—"}
                </div>
                <div className="mono" style={{ textAlign: "right", color: isIncome ? "var(--color-green)" : "var(--color-ink)", fontWeight: isIncome ? 500 : 400 }}>
                  {isIncome ? "+" : "−"}{fmtMoney(Math.abs(tx.amount))}
                </div>
              </div>
            );
          })}
          {hasMore && (
            <div style={{ padding: "10px 18px", borderTop: "1px solid var(--color-rule-soft)", textAlign: "center", background: "var(--color-paper-deep)" }}>
              <button
                onClick={() => setLimit((l) => l + 50)}
                style={{ fontSize: 12, color: "var(--color-bronze-dark)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                Load 50 more →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-rule)",
  background: "#fff",
  fontSize: 12,
  color: "var(--color-ink)",
  fontFamily: "inherit",
  minWidth: 0,
};
