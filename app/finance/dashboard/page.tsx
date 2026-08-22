export const revalidate = 1800; // cache for 30 minutes

import { createServiceClient } from "@/lib/supabase/server";
import { requireFinanceAccess } from "@/lib/finance/access";
import { getUserTimezone, formatTodayHeader, greetingForTz } from "@/lib/timezone";
import type { SharedWithMe } from "./settings/share-actions";
import { LargeTitle, Group, Cell, IconBadge, Sparkline, Icons } from "@/components/ios";
import SyncNowButton from "./_components/SyncNowButton";
import ImportedAccounts from "./_components/ImportedAccounts";
import SimpleFinConnect from "./_components/SimpleFinConnect";

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

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// How fresh a balance timestamp is, for the account-status card.
function freshnessTone(iso: string | null): "fresh" | "aging" | "stale" {
  if (!iso) return "stale";
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days <= 2) return "fresh";
  if (days <= 5) return "aging";
  return "stale";
}
function normName(s: string | null): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
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
      .select("id, name, institution, account_type, balance, unvested_value, as_of_date, currency, holdings, source, visible_to_family")
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
    unvested_value: number | null;
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

  const ownLinkedTotal = accounts.reduce((sum, a) => {
    const bal = a.current_balance ?? 0;
    return sum + (a.type === "credit" || a.type === "loan" ? -bal : bal);
  }, 0);
  const netPosition = ownLinkedTotal + manualTotal + sharedPortfolioTotal;
  // Stock-plan "potential value": unvested grants held on your own accounts.
  const totalUnvested = ownManualAccounts.reduce((s, a) => s + (a.unvested_value ?? 0), 0);
  const potentialNetPosition = netPosition + totalUnvested;

  // High-level math for the net-position box: gross assets (+) vs liabilities (−)
  // across ALL sources (linked, imported, shared) so nothing is hidden.
  let grossAssets = 0;
  let grossLiabilities = 0;
  const addToSplit = (bal: number, isLiability: boolean) => {
    if (isLiability) grossLiabilities += Math.abs(bal);
    else grossAssets += bal;
  };
  for (const a of accounts) addToSplit(a.current_balance ?? 0, a.type === "credit" || a.type === "loan");
  for (const a of manualAccounts) {
    const linkedId = (a as ManualAccountRow & { plaid_account_id?: string }).plaid_account_id;
    if (linkedId && plaidAccountIds.has(linkedId)) continue;
    addToSplit(a.balance ?? 0, LIABILITY_ACCOUNT_TYPES.has(a.account_type));
  }
  for (const s of sharedWithMe) {
    if (!s.include_in_portfolio || !s.account) continue;
    addToSplit(s.account.current_balance ?? 0, s.account.type === "credit" || s.account.type === "loan");
  }
  const sharedCount = sharedWithMe.filter((s) => s.include_in_portfolio && s.account).length;

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

  // ── Account status: freshness + duplicate detection ───────────────────────
  const itemById = new Map(items.map((it) => [it.id, it]));
  const staleLinked = items.filter((it) => freshnessTone(it.last_synced_at) === "stale");

  // Candidate accounts for duplicate detection (linked + imported/manual not
  // already linked to a Plaid account).
  const dupCandidates = [
    ...accounts.map((a) => ({
      label: a.name, inst: itemById.get(a.item_id)?.institution_name ?? "", mask: a.mask ?? null,
      bal: a.current_balance ?? 0, source: "Linked",
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...manualAccounts.filter((a) => !(a as any).plaid_account_id).map((a) => ({
      label: a.name, inst: a.institution ?? "", mask: null as string | null,
      bal: a.balance ?? 0, source: a.source === "statement" ? "Imported" : "Manual",
    })),
  ];
  const duplicates: { a: string; b: string; reason: string }[] = [];
  for (let i = 0; i < dupCandidates.length; i++) {
    for (let j = i + 1; j < dupCandidates.length; j++) {
      const x = dupCandidates[i], y = dupCandidates[j];
      const nx = normName(x.label), ny = normName(y.label);
      let reason = "";
      if (x.mask && y.mask && x.mask === y.mask) reason = `share ····${x.mask}`;
      else if (nx && ny && (nx === ny || (nx.length >= 6 && (nx.includes(ny) || ny.includes(nx))))) {
        const instClose = !x.inst || !y.inst || normName(x.inst) === normName(y.inst);
        const balClose = Math.abs(x.bal - y.bal) < Math.max(1, Math.abs(x.bal)) * 0.02;
        if (instClose || balClose) reason = balClose ? "same name & balance" : "same name";
      }
      if (reason) duplicates.push({ a: `${x.label} (${x.source})`, b: `${y.label} (${y.source})`, reason });
    }
  }

  // Use the user's saved timezone so the date agrees with every other module.
  const userTz = getUserTimezone(user.user_metadata);
  const greeting = greetingForTz(userTz);
  const todayDisplay = formatTodayHeader(userTz);
  return (
    <div className="ios-scroll">
      <LargeTitle brand title="Money" subtitle={`${todayDisplay} · ${greeting}`} avatarInitial={(name || "T")[0]?.toUpperCase()} />

      {/* Net position hero — hidden for brand-new users (no accounts) so they
          don't see a $0 net worth above the "Get started" card. */}
      {accounts.length + manualAccounts.length > 0 && (
      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Net position</div>
          <SyncNowButton />
        </div>
        <div className="ios-num ios-hero-num" style={{ fontSize: 36, marginTop: 4 }}>
          {fmtMoney(netPosition)}
        </div>
        {totalUnvested > 0 && (
          <div className="ios-subhead" style={{ marginTop: 3, color: "var(--ios-label-2)" }}>
            Potential <span className="ios-num" style={{ fontWeight: 600, color: "var(--ios-label)" }}>{fmtMoney(potentialNetPosition)}</span>
            <span className="ios-footnote" style={{ color: "var(--ios-label-3)" }}> · incl. {fmtMoney(totalUnvested)} unvested stock plan</span>
          </div>
        )}
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

        {/* High-level math — assets (+) minus liabilities (−), and every source that
            feeds the total so imported and shared accounts are clearly counted. */}
        <div style={{ marginTop: 12, borderTop: "1px solid var(--ios-separator)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>Assets</span>
            <span className="ios-num" style={{ color: "var(--ios-green)", fontWeight: 600 }}>+{fmtMoney(grossAssets)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="ios-subhead" style={{ color: "var(--ios-label-2)" }}>Liabilities</span>
            <span className="ios-num" style={{ color: "var(--ios-red)", fontWeight: 600 }}>−{fmtMoney(grossLiabilities)}</span>
          </div>
          <div style={{ borderTop: "1px dashed var(--ios-separator)", margin: "5px 0 3px" }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>Linked accounts</span>
            <span className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)" }}>{fmtMoney(ownLinkedTotal)}</span>
          </div>
          {manualAccounts.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>Imported · {manualAccounts.length}</span>
              <span className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)" }}>{fmtMoney(manualTotal)}</span>
            </div>
          )}
          {sharedCount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>Shared with me · {sharedCount}</span>
              <span className="ios-num ios-footnote" style={{ color: "var(--ios-label-2)" }}>{fmtMoney(sharedPortfolioTotal)}</span>
            </div>
          )}
        </div>
      </div>
      )}

      {accounts.length + manualAccounts.length === 0 && (
        <Group header="Get started" footer="Securely link a bank or brokerage with SimpleFIN to pull in balances and transactions automatically.">
          <div className="ios-cell" style={{ padding: "14px 16px" }}>
            <SimpleFinConnect label="Connect a bank" />
          </div>
        </Group>
      )}

      {(accounts.length + manualAccounts.length) > 0 && (
        <div className="ios-list" style={{ margin: "0 16px 8px", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: staleLinked.length ? "var(--ios-orange)" : "var(--ios-green)" }} />
              <div>
                <div className="ios-subhead" style={{ fontWeight: 600 }}>
                  {staleLinked.length ? `${staleLinked.length} account${staleLinked.length > 1 ? "s" : ""} may be out of date` : "Balances up to date"}
                </div>
                <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>
                  {lastSyncAcrossItems ? `Linked accounts synced ${relativeTime(lastSyncAcrossItems)}` : "Manual & imported balances only"}
                </div>
              </div>
            </div>
            {items.length > 0 && <SyncNowButton />}
          </div>
          {duplicates.length > 0 && (
            <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--ios-separator)" }}>
              <div className="ios-footnote" style={{ color: "var(--ios-orange)", fontWeight: 700, marginBottom: 4 }}>⚠ Possible duplicate{duplicates.length > 1 ? "s" : ""}</div>
              {duplicates.slice(0, 4).map((d, i) => (
                <div key={i} className="ios-caption" style={{ color: "var(--ios-label-2)", lineHeight: 1.55 }}>
                  {d.a} ↔ {d.b} <span style={{ color: "var(--ios-label-3)" }}>· {d.reason}</span>
                </div>
              ))}
              <a href="/finance/dashboard/settings" className="ios-caption" style={{ color: "var(--ios-tint)", fontWeight: 600, display: "inline-block", marginTop: 6 }}>Review &amp; hide duplicates →</a>
            </div>
          )}
        </div>
      )}

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
                subtitle={[a.subtype || a.type, a.mask ? `····${a.mask}` : null, itemById.get(a.item_id)?.last_synced_at ? `updated ${relativeTime(itemById.get(a.item_id)!.last_synced_at)}` : null].filter(Boolean).join(" · ") || undefined}
                trailing={<span className="ios-num" style={isLiab ? { color: "var(--ios-red)" } : undefined}>{isLiab ? `−${fmtMoney(Math.abs(a.current_balance ?? 0))}` : fmtMoney(a.current_balance ?? 0)}</span>}
              />
            ))}
          </Group>
        );
      })}

      <ImportedAccounts
        accounts={[
          ...ownManualAccounts.map((a) => ({
            id: a.id, name: a.name, account_type: a.account_type ?? null, institution: a.institution ?? null,
            balance: a.balance ?? null, unvested_value: a.unvested_value ?? null, currency: a.currency ?? "USD", editable: true,
          })),
          ...sharedManual.map((a) => ({
            id: a.id, name: a.name, account_type: a.account_type ?? null, institution: a.institution ?? null,
            balance: a.balance ?? null, unvested_value: null, currency: a.currency ?? "USD", editable: false,
          })),
        ]}
      />

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
        <Cell lead={<IconBadge color="var(--ios-green)"><Icons.ChartIcon /></IconBadge>} title="Retirement" subtitle="Model income, drawdown & scenarios" href="/finance/retirement" />
        <Cell lead={<IconBadge color="#8E5A3A"><Icons.SparkleIcon /></IconBadge>} title="Tax" subtitle="Your tax picture & AI tax advisor" href="/finance/tax" />
        <Cell lead={<IconBadge color="#8E8E93"><Icons.PlusIcon /></IconBadge>} title="Add or import accounts" href="/finance/dashboard/import" />
      </Group>

      <div style={{ height: 12 }} />
    </div>
  );
}
