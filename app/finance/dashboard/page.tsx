export const revalidate = 1800; // cache for 30 minutes

import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";
import SignOutButton from "./_components/SignOutButton";
import ConnectSection from "./_components/ConnectSection";
import SyncNowButton from "./_components/SyncNowButton";
import FinanceChat from "./_components/FinanceChat";
import RecentActivityClient from "./_components/RecentActivityClient";
import PinGate from "./_components/PinGate";
import SharedAccountsSection from "./_components/SharedAccountsSection";
import type { SharedWithMe } from "./settings/share-actions";

interface AccountRow {
  id: string;
  item_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  current_balance: number | null;
  iso_currency_code: string;
  is_hidden: boolean;
}

interface ItemRow {
  id: string;
  institution_name: string;
  status: string;
  last_synced_at: string | null;
}

interface TxRow {
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

function fmtMoney(n: number | null, currency = "USD"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtMoneyLarge(n: number): { whole: string; cents: string } {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100).toString().padStart(2, "0");
  return {
    whole: `${sign}$${whole.toLocaleString()}`,
    cents: `.${cents}`,
  };
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function DashboardPage() {
  const { user } = await requireFinanceAccess();

  const service = createServiceClient();

  // Round 1: fetch user-scoped data that doesn't depend on other results.
  // accounts and transactions are fetched in round 2 once we know itemIds.
  const [
    { data: prefData },
    { data: itemRows },
    { data: manualRows },
    { data: sharedWithMeRaw },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)
      .schema("hub")
      .from("preferences")
      .select("finance_pin")
      .eq("user_id", user.id)
      .maybeSingle(),
    service
      .schema("finance")
      .from("plaid_items")
      .select("id, institution_name, status, last_synced_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    service
      .schema("finance")
      .from("manual_accounts")
      .select("id, name, institution, account_type, balance, as_of_date, currency, holdings, source")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)
      .schema("finance")
      .from("account_shares")
      .select("id, account_id, owner_user_id, include_in_portfolio, created_at")
      .eq("grantee_user_id", user.id),
  ]);

  // Round 2: accounts scoped to this user's plaid items only.
  // Without this filter the service-role client (bypasses RLS) would return
  // every account from every user — a data-isolation bug when multiple
  // platform members log in.
  const userItemIds = ((itemRows ?? []) as { id: string }[]).map((r) => r.id);
  const { data: accountRowsRaw } = userItemIds.length > 0
    ? await service
        .schema("finance")
        .from("accounts")
        .select("id, item_id, name, official_name, type, subtype, mask, current_balance, iso_currency_code, is_hidden")
        .in("item_id", userItemIds)
        .order("type", { ascending: true })
        .order("name", { ascending: true })
    : { data: [] };

  // Round 3: transactions filtered to this user's account IDs.
  const userAccountIds = ((accountRowsRaw ?? []) as { id: string }[]).map((r) => r.id);
  const { data: txRowsRaw } = userAccountIds.length > 0
    ? await service
        .schema("finance")
        .from("transactions")
        .select("id, account_id, date, amount, merchant_name, name, pending, personal_finance_category")
        .in("account_id", userAccountIds)
        .order("date", { ascending: false })
        .limit(100)
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const financePin: string | null = (prefData as any)?.finance_pin ?? null;

  const items: ItemRow[] = (itemRows as ItemRow[]) ?? [];
  const allAccounts: AccountRow[] = (accountRowsRaw as AccountRow[]) ?? [];
  const accounts = allAccounts.filter((a) => !a.is_hidden);
  const hiddenIds = new Set(allAccounts.filter((a) => a.is_hidden).map((a) => a.id));
  const txAll: TxRow[] = (txRowsRaw as TxRow[]) ?? [];
  const transactions = txAll.filter((t) => !hiddenIds.has(t.account_id));

  interface ManualAccountRow {
    id: string;
    name: string;
    institution: string | null;
    account_type: string;
    balance: number | null;
    as_of_date: string | null;
    currency: string;
    holdings: { name: string; value: number; pct: number | null }[] | null;
    source: string;
  }
  const manualAccounts: ManualAccountRow[] = (manualRows as ManualAccountRow[]) ?? [];

  // ── Shared accounts (where this user is the grantee) ─────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawSharedShares: any[] = (sharedWithMeRaw as any[]) ?? [];
  let sharedWithMe: SharedWithMe[] = [];
  if (rawSharedShares.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = service as any;
    const sharedAccountIds = rawSharedShares.map((s) => s.account_id);
    const ownerIds = new Set(rawSharedShares.map((s) => s.owner_user_id));
    // Fetch shared accounts + the full auth user list in parallel.
    // We use auth.admin.listUsers() for owner names because public.profiles
    // is RLS-blocked to the service role.
    const [{ data: sharedAcctRows }, usersResult] = await Promise.all([
      svc.schema("finance").from("accounts")
        .select("id, item_id, name, type, subtype, mask, current_balance")
        .in("id", sharedAccountIds),
      svc.auth.admin.listUsers({ perPage: 200 }),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemIds = ((sharedAcctRows ?? []) as any[]).map((a) => a.item_id);
    const { data: institutionRows } = itemIds.length > 0
      ? await svc.schema("finance").from("plaid_items").select("id, institution_name").in("id", itemIds)
      : { data: [] };
    const acctMap = new Map((sharedAcctRows ?? []).map((a: any) => [a.id, a]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownerMap = new Map(
      ((usersResult?.data?.users ?? []) as any[])
        .filter((u) => ownerIds.has(u.id))
        .map((u) => [u.id, {
          id: u.id,
          full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null,
          email: u.email ?? null,
          avatar_url: u.user_metadata?.avatar_url ?? u.user_metadata?.picture ?? null,
        }])
    );
    const instMap = new Map((institutionRows ?? []).map((i: any) => [i.id, i.institution_name]));
    sharedWithMe = rawSharedShares.map((s: any) => {
      const acct = acctMap.get(s.account_id) as any;
      return {
        id: s.id,
        account_id: s.account_id,
        owner_user_id: s.owner_user_id,
        include_in_portfolio: s.include_in_portfolio,
        created_at: s.created_at,
        account: acct ? { ...acct, institution_name: instMap.get(acct.item_id) ?? null } : null,
        owner: ownerMap.get(s.owner_user_id) ?? null,
      } as SharedWithMe;
    });
  }
  // Add shared accounts where include_in_portfolio=true to net position
  const sharedPortfolioTotal = sharedWithMe
    .filter((s) => s.include_in_portfolio && s.account)
    .reduce((sum, s) => {
      const bal = s.account!.current_balance ?? 0;
      return sum + (s.account!.type === "credit" || s.account!.type === "loan" ? -bal : bal);
    }, 0);

  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "there";
  const firstName = name.split(" ")[0];

  // Group visible accounts by type for the dashboard layout.
  // Investments are split into their own section so spending-side totals
  // (the Net position) treat brokerage balances correctly.
  function bucket(t: string): "cash" | "credit" | "loan" | "investment" | "other" {
    if (t === "depository") return "cash";
    if (t === "credit") return "credit";
    if (t === "loan") return "loan";
    if (t === "investment" || t === "brokerage") return "investment";
    return "other";
  }
  const accountsByBucket = {
    cash: accounts.filter((a) => bucket(a.type) === "cash"),
    credit: accounts.filter((a) => bucket(a.type) === "credit"),
    loan: accounts.filter((a) => bucket(a.type) === "loan"),
    investment: accounts.filter((a) => bucket(a.type) === "investment"),
    other: accounts.filter((a) => bucket(a.type) === "other"),
  };

  // Net position = Plaid accounts + manual accounts (investments add, loans/credit subtract).
  const manualTotal = manualAccounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);
  const netPosition = accounts.reduce((sum, a) => {
    const bal = a.current_balance ?? 0;
    return sum + (a.type === "credit" || a.type === "loan" ? -bal : bal);
  }, 0) + manualTotal + sharedPortfolioTotal;
  const netFmt = fmtMoneyLarge(netPosition);

  const lastSyncAcrossItems = items.reduce<string | null>((latest, it) => {
    if (!it.last_synced_at) return latest;
    if (!latest || it.last_synced_at > latest) return it.last_synced_at;
    return latest;
  }, null);

  // Pin to Indianapolis time. Vercel functions run in UTC by default,
  // so we must compute the local hour explicitly via toLocaleString.
  const userTz = "America/Indiana/Indianapolis";
  const today = new Date();
  const localHour = parseInt(
    today.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: userTz }),
    10
  );
  const greeting = (() => {
    if (localHour < 5) return "Good evening";
    if (localHour < 12) return "Good morning";
    if (localHour < 17) return "Good afternoon";
    return "Good evening";
  })();
  const todayDisplay = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: userTz,
  });

  return (
    <PinGate enabled={!!financePin} correctPin={financePin ?? ""}>
    <div>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid var(--color-rule)",
          background: "var(--color-paper)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "16px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-bronze)", alignSelf: "center" }} />
            <span className="serif" style={{ fontSize: 22 }}>morrisai</span>
            <span className="serif" style={{ color: "var(--color-bronze-dark)", fontStyle: "italic" }}>.family</span>
            <span style={{ color: "var(--color-ink-3)", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", marginLeft: 14, paddingLeft: 14, borderLeft: "1px solid var(--color-rule)" }}>
              finance
            </span>
          </div>

          <nav style={{ display: "flex", gap: 22, fontSize: 13, letterSpacing: "0.02em" }}>
            <a href="#overview" style={{ color: "var(--color-ink)", textDecoration: "none", padding: "6px 0", borderBottom: "1px solid var(--color-bronze)", fontWeight: 500 }}>Overview</a>
            <Link href="/finance/dashboard/insights" style={{ color: "var(--color-ink-2)", textDecoration: "none", padding: "6px 0" }}>Insights</Link>
            <a href="#activity" style={{ color: "var(--color-ink-2)", textDecoration: "none", padding: "6px 0" }}>Activity</a>
            <a href="#accounts" style={{ color: "var(--color-ink-2)", textDecoration: "none", padding: "6px 0" }}>Accounts</a>
            <Link href="/finance/dashboard/import" style={{ color: "var(--color-ink-2)", textDecoration: "none", padding: "6px 0" }}>Import</Link>
            <Link href="/finance/retirement" style={{ color: "var(--color-ink-2)", textDecoration: "none", padding: "6px 0" }}>Retirement</Link>
            <Link href="/finance/dashboard/settings" style={{ color: "var(--color-ink-2)", textDecoration: "none", padding: "6px 0" }}>Settings</Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SyncNowButton />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 28px 80px" }}>

        {/* ── Hero ────────────────────────────────────────────────────── */}
        <section
          id="overview"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 24,
            marginBottom: 32,
            paddingBottom: 24,
            borderBottom: "1px solid var(--color-rule)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10 }}>
              {todayDisplay}
            </div>
            <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05 }}>
              {greeting},
              <br />
              <span style={{ fontStyle: "italic", color: "var(--color-bronze-dark)" }}>{firstName}.</span>
            </h1>
            {items.length > 0 && (
              <p style={{ fontSize: 14, color: "var(--color-ink-3)", maxWidth: 460, marginTop: 14, lineHeight: 1.55 }}>
                {items.length} institution{items.length !== 1 ? "s" : ""} connected ·
                last sync {relativeTime(lastSyncAcrossItems)} ·
                {transactions.length} recent transaction{transactions.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {(items.length > 0 || manualAccounts.length > 0) && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 6 }}>
                Net position
              </div>
              <div className="mono" style={{ fontSize: 42, fontWeight: 500, color: "var(--color-ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                {netFmt.whole}
                <span style={{ fontSize: "0.55em", color: "var(--color-ink-3)" }}>{netFmt.cents}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 6 }}>
                across {accounts.length + manualAccounts.length} account{(accounts.length + manualAccounts.length) !== 1 ? "s" : ""}
                {manualAccounts.length > 0 && (
                  <span style={{ color: "var(--color-ink-4)" }}> ({manualAccounts.length} imported)</span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── AI insights chat ────────────────────────────────── */}
        {items.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <FinanceChat />
          </section>
        )}

        {/* Accounts shared with this user — shown at top so recipients
            (who may have no accounts of their own) see them immediately */}
        <SharedAccountsSection initialShares={sharedWithMe} />

        {items.length === 0 ? (
          /* ── Empty state ─────────────────────────────────────────── */
          <div
            style={{
              background: "var(--color-paper-card)",
              border: "1px solid var(--color-rule)",
              borderRadius: 12,
              padding: "60px 32px",
              textAlign: "center",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--color-paper-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18, fontSize: 22, color: "var(--color-bronze-dark)" }}>
              ◐
            </div>
            <h2 className="serif" style={{ fontSize: 24, marginBottom: 8 }}>No accounts connected yet</h2>
            <p style={{ fontSize: 14, color: "var(--color-ink-3)", maxWidth: 360, margin: "0 auto 24px", lineHeight: 1.6 }}>
              Connect your first bank to start importing transactions. Your access tokens are encrypted before storage.
            </p>
            <ConnectSection />
            <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 18 }}>
              Sandbox: use <code style={{ background: "var(--color-paper-deep)", padding: "1px 6px", borderRadius: 3 }}>user_good</code> / <code style={{ background: "var(--color-paper-deep)", padding: "1px 6px", borderRadius: 3 }}>pass_good</code>
            </p>
          </div>
        ) : (
          <>
            {/* ── Institutions row ────────────────────────────────── */}
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 36 }}>
              {items.map((it) => {
                const acctsForItem = accounts.filter((a) => a.item_id === it.id);
                const balForItem = acctsForItem.reduce((s, a) => s + (a.current_balance ?? 0), 0);
                return (
                  <div
                    key={it.id}
                    style={{
                      background: "var(--color-paper-card)",
                      border: "1px solid var(--color-rule)",
                      borderRadius: 12,
                      padding: "16px 18px",
                      boxShadow: "var(--shadow-card)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span className="serif" style={{ fontSize: 18 }}>{it.institution_name}</span>
                      <span style={{ fontSize: 10, color: it.status === "active" ? "var(--color-green)" : "var(--color-red)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: it.status === "active" ? "var(--color-green)" : "var(--color-red)", display: "inline-block" }} />
                        {it.status === "active" ? "Synced" : it.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginBottom: 10 }}>
                      {acctsForItem.length} account{acctsForItem.length !== 1 ? "s" : ""} · {relativeTime(it.last_synced_at)}
                    </div>
                    <div className="mono" style={{ fontSize: 22, color: "var(--color-ink)", fontWeight: 500 }}>
                      {fmtMoney(balForItem)}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* ── Accounts (grouped by type) ──────────────────────── */}
            <section id="accounts" style={{ marginBottom: 36 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--color-rule)" }}>
                <h2 className="serif" style={{ fontSize: 24 }}>Accounts</h2>
                <span style={{ fontSize: 11, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {accounts.length} visible{allAccounts.length !== accounts.length ? ` · ${allAccounts.length - accounts.length} hidden` : ""}
                </span>
              </div>

              {(["cash", "credit", "loan", "investment", "other"] as const).map((bucketKey) => {
                const group = accountsByBucket[bucketKey];
                if (group.length === 0) return null;
                const label =
                  bucketKey === "cash" ? "Cash & savings" :
                  bucketKey === "credit" ? "Credit" :
                  bucketKey === "loan" ? "Loans" :
                  bucketKey === "investment" ? "Investments" :
                  "Other";
                const subtotal = group.reduce((s, a) => {
                  const bal = a.current_balance ?? 0;
                  return s + (bucketKey === "credit" || bucketKey === "loan" ? -bal : bal);
                }, 0);
                return (
                  <div key={bucketKey} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
                        {label} <span style={{ color: "var(--color-ink-4)", fontWeight: 400 }}>· {group.length}</span>
                      </h3>
                      <span className="mono" style={{ fontSize: 13, color: subtotal < 0 ? "var(--color-red)" : "var(--color-ink-2)", fontWeight: 500 }}>
                        {fmtMoney(subtotal)}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                      {group.map((a) => {
                        const isLiability = a.type === "credit" || a.type === "loan";
                        const bal = a.current_balance ?? 0;
                        const displayBal = isLiability ? -bal : bal;
                        return (
                          <div
                            key={a.id}
                            style={{
                              background: "var(--color-paper-card)",
                              border: "1px solid var(--color-rule)",
                              borderRadius: 12,
                              padding: "16px 18px 14px",
                              boxShadow: "var(--shadow-card)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                              <div>
                                <div className="serif" style={{ fontSize: 16, color: "var(--color-ink)" }}>{a.name}</div>
                                <div style={{ fontSize: 10, color: "var(--color-ink-3)", textTransform: "capitalize", marginTop: 2, letterSpacing: "0.04em" }}>
                                  {a.subtype ? a.subtype.replace(/_/g, " ") : a.type}
                                </div>
                              </div>
                              {a.mask && (
                                <div className="mono" style={{ fontSize: 11, color: "var(--color-ink-4)" }}>
                                  ····{a.mask}
                                </div>
                              )}
                            </div>
                            <div
                              className="mono"
                              style={{
                                fontSize: 22,
                                fontWeight: 500,
                                color: displayBal < 0 ? "var(--color-red)" : "var(--color-ink)",
                              }}
                            >
                              {fmtMoney(displayBal, a.iso_currency_code)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* ── Imported / manual accounts ───────────────────────── */}
            {manualAccounts.length > 0 && (
              <section style={{ marginBottom: 36 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--color-rule)" }}>
                  <h2 className="serif" style={{ fontSize: 24 }}>Imported accounts</h2>
                  <a href="/finance/dashboard/import" style={{ fontSize: 11, color: "var(--color-ink-3)", textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Manage →
                  </a>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                  {manualAccounts.map((a) => {
                    const TYPE_LABEL: Record<string, string> = {
                      "401k": "401(k)", roth_ira: "Roth IRA", traditional_ira: "Traditional IRA",
                      hsa: "HSA", brokerage: "Brokerage", pension: "Pension", other_investment: "Investment",
                    };
                    return (
                      <div key={a.id} style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "16px 18px 14px", boxShadow: "var(--shadow-card)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                          <div>
                            <div className="serif" style={{ fontSize: 16, color: "var(--color-ink)", marginBottom: 2 }}>{a.name}</div>
                            <div style={{ fontSize: 10, color: "var(--color-ink-3)", textTransform: "capitalize", letterSpacing: "0.04em" }}>
                              {TYPE_LABEL[a.account_type] ?? a.account_type}
                              {a.institution ? ` · ${a.institution}` : ""}
                            </div>
                          </div>
                          <span style={{ fontSize: 9, color: "var(--color-bronze-dark)", background: "rgba(139,106,71,0.1)", padding: "2px 7px", borderRadius: 8, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", flexShrink: 0 }}>
                            imported
                          </span>
                        </div>
                        <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: "var(--color-ink)" }}>
                          {a.balance != null
                            ? new Intl.NumberFormat("en-US", { style: "currency", currency: a.currency, minimumFractionDigits: 2 }).format(a.balance)
                            : "—"}
                        </div>
                        {a.as_of_date && (
                          <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 4 }}>
                            as of {new Date(a.as_of_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Recent activity ─────────────────────────────────── */}
            <section id="activity">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--color-rule)" }}>
                <h2 className="serif" style={{ fontSize: 24 }}>Recent activity</h2>
                <span style={{ fontSize: 11, color: "var(--color-ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Last {transactions.length} transactions
                </span>
              </div>

              <RecentActivityClient
                transactions={transactions}
                accounts={accounts.map((a) => ({ id: a.id, name: a.name, mask: a.mask }))}
              />

              <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
                <ConnectSection label="Connect another bank" variant="secondary" />
              </div>
            </section>
          </>
        )}

      </main>

      <footer
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "24px 28px",
          borderTop: "1px solid var(--color-rule)",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--color-ink-3)",
        }}
      >
        <span>Secured · TLS · AES-256-GCM · Plaid</span>
        <span>finance.morrisai.family</span>
      </footer>
    </div>
    </PinGate>
  );
}
