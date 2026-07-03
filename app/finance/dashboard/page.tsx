export const revalidate = 1800; // cache for 30 minutes

import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";
import type { SharedWithMe } from "./settings/share-actions";
import { LargeTitle, Group, Cell, IconBadge, Sparkline, Icons } from "@/components/ios";

/* This dashboard reads many finance-schema tables through the service-role
   client, which is untyped — `as any` casts are used throughout the data layer. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const BUCKETS = [
  { key: "cash", label: "Cash & savings", color: "var(--ios-green)" },
  { key: "investment", label: "Investments", color: "#C97A3A" },
  { key: "credit", label: "Credit", color: "var(--ios-red)" },
  { key: "loan", label: "Loans", color: "var(--ios-red)" },
  { key: "other", label: "Other", color: "#8E8E93" },
] as const;

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
    { data: itemRows },
    { data: manualRows },
    { data: sharedWithMeRaw },
  ] = await Promise.all([
    service
      .schema("finance")
      .from("plaid_items")
      .select("id, institution_name, status, last_synced_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    service
      .schema("finance")
      .from("manual_accounts")
      .select("id, name, institution, account_type, balance, as_of_date, currency, holdings, source, visible_to_family")
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
    visible_to_family: boolean;
    sharedBy?: string; // owner's name when viewing another member's shared account
  }
  const ownManualAccounts: ManualAccountRow[] = (manualRows as ManualAccountRow[]) ?? [];

  // Fetch manual accounts shared with this user via manual_account_shares (auto-accepted only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: receivedShareRows } = await (service as any)
    .schema("finance")
    .from("manual_account_shares")
    .select("account_id, owner_user_id, mode")
    .eq("recipient_user_id", user.id)
    .eq("accepted", true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharedManual: ManualAccountRow[] = [];
  if (receivedShareRows && (receivedShareRows as any[]).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accountIds = (receivedShareRows as any[]).map((r) => r.account_id);
    const { data: sharedAccounts } = await (service as any)
      .schema("finance")
      .from("manual_accounts")
      .select("id, name, institution, account_type, balance, as_of_date, currency, holdings, source")
      .in("id", accountIds);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((sharedAccounts ?? []) as any[]).forEach((a) => {
      sharedManual.push({ ...a, visible_to_family: true });
    });
  }

  const manualAccounts: ManualAccountRow[] = [...ownManualAccounts, ...sharedManual];

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

  // ── Net position calculation ──────────────────────────────────────────────
  // LIABILITY_TYPES: manual accounts of these types subtract from net position
  // (matching the sign logic applied to Plaid credit/loan accounts above).
  const LIABILITY_ACCOUNT_TYPES = new Set(["credit_card", "mortgage", "loan", "other_liability"]);

  // Build the set of Plaid account IDs already counted above so we can
  // exclude any manual account that is the SAME real-world account imported
  // as a PDF statement. Without this, a Fidelity 401k synced via Plaid AND
  // also imported as a statement would count twice.
  const plaidAccountIds = new Set(accounts.map((a) => a.id));

  const manualTotal = manualAccounts.reduce((sum, a) => {
    // Skip manual accounts explicitly linked to a Plaid account we already counted
    if ((a as ManualAccountRow & { plaid_account_id?: string }).plaid_account_id &&
        plaidAccountIds.has((a as ManualAccountRow & { plaid_account_id?: string }).plaid_account_id!)) {
      return sum;
    }
    const bal = a.balance ?? 0;
    // Liabilities subtract; all other manual accounts (assets, investments) add
    return sum + (LIABILITY_ACCOUNT_TYPES.has(a.account_type) ? -Math.abs(bal) : bal);
  }, 0);

  const netPosition = accounts.reduce((sum, a) => {
    const bal = a.current_balance ?? 0;
    return sum + (a.type === "credit" || a.type === "loan" ? -bal : bal);
  }, 0) + manualTotal + sharedPortfolioTotal;
  const netFmt = fmtMoneyLarge(netPosition);

  // ── Net position delta via snapshots ──────────────────────────────────────
  // Read previous snapshot, then store today's so next load shows the delta.
  let netDelta: number | null = null;
  let netSeries: number[] = [];
  try {
    // Last 30 daily snapshots (oldest→newest) for the trend line + the delta.
    const { data: snaps } = await (service as any)
      .schema("finance").from("net_position_snapshots")
      .select("net_position, captured_at")
      .eq("user_id", user.id)
      .order("captured_at", { ascending: false })
      .limit(30);

    const ordered = ((snaps ?? []) as { net_position: number | string }[]).slice().reverse();
    if (ordered.length > 0) {
      const prev = ordered[ordered.length - 1];
      if (prev?.net_position != null) netDelta = netPosition - Number(prev.net_position);
      // Series ends with today's live net position
      netSeries = [...ordered.map((s) => Number(s.net_position)), netPosition];
    }

    // Store today's snapshot (upsert on user_id + date to avoid spam)
    const today_date = new Date().toISOString().slice(0, 10);
    await (service as any).schema("finance").from("net_position_snapshots")
      .upsert({ user_id: user.id, net_position: netPosition, date: today_date, captured_at: new Date().toISOString() },
        { onConflict: "user_id,date" });
  } catch { /* table not yet created — skip trend */ }

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
    <div className="ios-scroll">
      <LargeTitle title="Money" subtitle={`${todayDisplay} · ${greeting}`} avatarInitial={(name || "T")[0]?.toUpperCase()} />

      {/* Net position hero */}
      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 18 }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Net position</div>
        <div className="ios-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 2 }}>
          {netFmt.whole}<span style={{ color: "var(--ios-label-2)", fontSize: 20 }}>{netFmt.cents}</span>
        </div>
        {netDelta != null && netDelta !== 0 && (
          <div className="ios-subhead" style={{ marginTop: 2, color: netDelta >= 0 ? "var(--ios-green)" : "var(--ios-red)" }}>
            {netDelta >= 0 ? "▲" : "▼"} {fmtMoney(Math.abs(netDelta))} since last visit
          </div>
        )}
        {netSeries.length >= 2 && (
          <div style={{ marginTop: 12 }}>
            <Sparkline points={netSeries} color={netDelta != null && netDelta < 0 ? "var(--ios-red)" : "var(--ios-green)"} width={320} height={44} />
          </div>
        )}
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>
          {accounts.length + manualAccounts.length} accounts{lastSyncAcrossItems ? ` · synced ${relativeTime(lastSyncAcrossItems)}` : ""}
        </div>
      </div>

      {BUCKETS.map((b) => {
        const list = accountsByBucket[b.key];
        if (!list.length) return null;
        const isLiab = b.key === "credit" || b.key === "loan";
        const subtotal = list.reduce((s, a) => s + (a.current_balance ?? 0), 0);
        return (
          <Group key={b.key} header={`${b.label} · ${isLiab ? "−" : ""}${fmtMoney(Math.abs(subtotal))}`}>
            {list.map((a) => (
              <Cell
                key={a.id}
                chevron={false}
                lead={<IconBadge color={b.color}><Icons.WalletIcon /></IconBadge>}
                title={a.name}
                subtitle={[a.subtype || a.type, a.mask ? `····${a.mask}` : null].filter(Boolean).join(" · ") || undefined}
                trailing={<span className="ios-num" style={isLiab ? { color: "var(--ios-red)" } : undefined}>{isLiab ? `−${fmtMoney(Math.abs(a.current_balance ?? 0))}` : fmtMoney(a.current_balance ?? 0)}</span>}
              />
            ))}
          </Group>
        );
      })}

      {manualAccounts.length > 0 && (
        <Group header="Imported">
          {manualAccounts.map((a) => (
            <Cell
              key={a.id}
              chevron={false}
              lead={<IconBadge color="#8B6A47"><Icons.ChartIcon /></IconBadge>}
              title={a.name}
              subtitle={[a.account_type, a.institution].filter(Boolean).join(" · ") || undefined}
              trailing={<span className="ios-num">{fmtMoney(a.balance, a.currency ?? "USD")}</span>}
            />
          ))}
        </Group>
      )}

      {sharedWithMe.length > 0 && (
        <Group header="Shared with me">
          {sharedWithMe.map((s) => (
            <Cell
              key={s.id}
              chevron={false}
              lead={<IconBadge color="#B565A7"><Icons.PeopleIcon /></IconBadge>}
              title={s.account?.name ?? "Account"}
              subtitle={s.owner?.full_name ? `from ${s.owner.full_name}` : undefined}
              trailing={<span className="ios-num">{fmtMoney(s.account?.current_balance ?? null)}</span>}
            />
          ))}
        </Group>
      )}

      {items.length > 0 && (
        <Group header="Institutions">
          {items.map((it) => (
            <Cell
              key={it.id}
              chevron={false}
              lead={<IconBadge color="var(--ios-tint)"><Icons.WalletIcon /></IconBadge>}
              title={it.institution_name}
              subtitle={it.status === "active" || it.status === "good" ? "Synced" : it.status}
              trailing={<span style={{ color: "var(--ios-label-2)" }}>{relativeTime(it.last_synced_at)}</span>}
            />
          ))}
        </Group>
      )}

      {transactions.length > 0 && (
        <Group header="Recent activity">
          {transactions.slice(0, 6).map((t) => (
            <Cell
              key={t.id}
              chevron={false}
              lead={<IconBadge color="#8E8E93"><Icons.WalletIcon /></IconBadge>}
              title={t.merchant_name || t.name}
              subtitle={new Date(`${t.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              trailing={<span className="ios-num" style={{ color: t.amount < 0 ? "var(--ios-green)" : "var(--ios-label)" }}>{t.amount < 0 ? "+" : "−"}{fmtMoney(Math.abs(t.amount))}</span>}
            />
          ))}
        </Group>
      )}

      <Group header="More">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>} title="Insights" subtitle="AI analysis of your spending" href="/finance/dashboard/insights" />
        <Cell lead={<IconBadge color="#C97A3A"><Icons.TrendUpIcon /></IconBadge>} title="Investments" href="/investments" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.PlusIcon /></IconBadge>} title="Add or import accounts" href="/finance/dashboard/import" />
      </Group>

      <div style={{ height: 12 }} />
    </div>
  );
}
