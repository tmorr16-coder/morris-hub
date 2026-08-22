export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser, createServiceClient } from "@/lib/supabase/server";
import { getPreferences } from "@/lib/prefs";
import { getAccount, getPositions, getAlpacaStatus, type AlpacaPosition } from "@/lib/alpaca";
import { fetchQuotes, type Quote } from "@/lib/stocks";
import { getUserInvestmentIdeas } from "@/lib/investment-ideas";
import { LargeTitle, Group, Cell, IconBadge, GlanceGrid, GlanceTile, Sparkline, Icons } from "@/components/ios";
import AlpacaCard from "./_components/AlpacaCard";

function usd(n: number, maxFrac = 0): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: maxFrac });
}

function TickerBadge({ sym }: { sym: string }) {
  return (
    <span aria-hidden style={{ width: 38, height: 38, borderRadius: 9, background: "var(--ios-fill)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, letterSpacing: "-0.02em" }}>
      {sym}
    </span>
  );
}

function Change({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className="ios-num" style={{ color: up ? "var(--ios-green)" : "var(--ios-red)", fontWeight: 600 }}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function PriceTrail({ price, pct }: { price: string; pct: number }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
      <span className="ios-num" style={{ color: "var(--ios-label)" }}>${price}</span>
      <Change pct={pct} />
    </span>
  );
}

export default async function InvestmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("investments")) redirect("/home");

  const watched = prefs.watched_stocks ?? [];
  const [alpaca, account, positions, quotes, ideas] = await Promise.all([
    getAlpacaStatus(user.id).catch(() => ({ connected: false, isPaper: true })),
    getAccount(user.id).catch(() => null),
    getPositions(user.id).catch(() => [] as AlpacaPosition[]),
    fetchQuotes(watched).catch(() => [] as Quote[]),
    getUserInvestmentIdeas(user.id).catch(() => []),
  ]);
  const brokerageConnected = alpaca.connected;

  // Employee stock-plan "potential value": vested balance + unvested/pending
  // grants (RSUs, restricted ESPP) imported into manual_accounts. Kept separate
  // from the Alpaca equity hero so paper-trading equity stays accurate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any;
  const { data: manualRows } = await svc
    .schema("finance")
    .from("manual_accounts")
    .select("balance, unvested_value")
    .eq("user_id", user.id)
    .not("unvested_value", "is", null);
  const stockPlanRows = (manualRows ?? []) as { balance: number | null; unvested_value: number | null }[];
  const stockPlanVested = stockPlanRows.reduce((s, r) => s + (r.balance ?? 0), 0);
  const stockPlanUnvested = stockPlanRows.reduce((s, r) => s + (r.unvested_value ?? 0), 0);
  const hasStockPlan = stockPlanUnvested > 0;

  const equity = account ? Number(account.equity) : null;
  const lastEquity = account ? Number(account.last_equity) : null;
  const dayChange = equity != null && lastEquity != null ? equity - lastEquity : null;
  const dayPct = dayChange != null && lastEquity ? (dayChange / lastEquity) * 100 : null;
  const up = (dayChange ?? 0) >= 0;
  const trendColor = up ? "var(--ios-green)" : "var(--ios-red)";

  const topHoldings = [...positions]
    .sort((a, b) => Number(b.market_value) - Number(a.market_value))
    .slice(0, 4);

  return (
    <div className="ios-scroll">
      <LargeTitle
        title="Investments"
        subtitle="Portfolio · paper trading"
        avatarInitial={(user.user_metadata?.full_name ?? user.email ?? "T")[0]?.toUpperCase()}
      />

      {/* No brokerage connected → show the connect/setup card instead of the
          empty portfolio & cash tiles. Watchlist and ideas still work below. */}
      {!brokerageConnected ? (
        <div style={{ padding: "12px 16px 0" }}>
          <AlpacaCard configured={false} />
        </div>
      ) : (
        <>
          {account && equity != null && (
            <div className="ios-list" style={{ margin: "8px 16px 0", padding: 16 }}>
              <div className="ios-num ios-hero-num" style={{ fontSize: 36 }}>{usd(equity)}</div>
              {dayChange != null && (
                <div className="ios-subhead" style={{ color: trendColor, marginTop: 2 }}>
                  {up ? "▲" : "▼"} {usd(Math.abs(dayChange), 2)}{dayPct != null && ` (${dayPct.toFixed(2)}%)`} today
                </div>
              )}
              {lastEquity != null && (
                <div style={{ margin: "14px 0 2px" }}>
                  <Sparkline points={[lastEquity, equity]} color={trendColor} width={320} />
                </div>
              )}
            </div>
          )}

          {topHoldings.length > 0 ? (
            <Group header="Holdings">
              {topHoldings.map((p) => (
                <Cell
                  key={p.asset_id}
                  lead={<TickerBadge sym={p.symbol} />}
                  title={p.symbol}
                  subtitle={`${Number(p.qty).toLocaleString("en-US")} sh · ${usd(Number(p.market_value))}`}
                  trailing={<PriceTrail price={Number(p.current_price).toFixed(2)} pct={Number(p.change_today) * 100} />}
                  chevron={false}
                  href="/investments/stocks"
                />
              ))}
            </Group>
          ) : (
            <Group header="Holdings" footer="Your paper-trading positions will appear here.">
              <Cell lead={<IconBadge color="var(--ios-finance)"><Icons.ChartIcon /></IconBadge>} title="Browse stocks" href="/investments/stocks" />
            </Group>
          )}
        </>
      )}

      {hasStockPlan && (
        <div className="ios-list" style={{ margin: "8px 16px 0", padding: 16 }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Stock plan · potential value
          </div>
          <div className="ios-num ios-hero-num" style={{ fontSize: 32, marginTop: 2 }}>{usd(stockPlanVested + stockPlanUnvested)}</div>
          <div className="ios-subhead" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>
            Vested {usd(stockPlanVested)} + {usd(stockPlanUnvested)} unvested
          </div>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6, lineHeight: 1.4 }}>
            Unvested RSUs / pending grants from your imported statements. Not part of paper-trading equity above.
          </div>
        </div>
      )}

      <GlanceGrid>
        {brokerageConnected && (
          <GlanceTile label="Holdings" value={positions.length} sub="positions" href="/investments/stocks" />
        )}
        <GlanceTile label="Watchlist" value={watched.length} sub="tickers" href="/investments/stocks" accent="var(--ios-green)" />
        <GlanceTile label="Ideas" value={ideas.length} sub="saved" href="/investments/ideas" accent="var(--ios-orange)" />
        {brokerageConnected && (
          <GlanceTile label="Cash" value={account ? usd(Number(account.cash)) : "—"} sub="buying power" href="/investments/stocks" accent="var(--ios-finance)" />
        )}
      </GlanceGrid>

      {quotes.length > 0 && (
        <Group header="Watchlist">
          {quotes.map((q) => (
            <Cell
              key={q.symbol}
              lead={<TickerBadge sym={q.symbol} />}
              title={q.shortName}
              subtitle={q.symbol}
              trailing={<PriceTrail price={q.price.toFixed(2)} pct={q.changePercent} />}
              chevron={false}
              href="/investments/stocks"
            />
          ))}
        </Group>
      )}

      <Group header="Research">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>} title="Stocks" subtitle="Live quotes, research & paper trading" href="/investments/stocks" />
        <Cell lead={<IconBadge color="#C97A3A"><Icons.ChartIcon /></IconBadge>} title="Ideas" subtitle="Screens & watchlist candidates" href="/investments/ideas" />
      </Group>

      {/* Connected users manage / disconnect their brokerage here. */}
      {brokerageConnected && (
        <div style={{ padding: "20px 16px 0" }}>
          <div className="ios-caption" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 16px 6px" }}>
            Brokerage
          </div>
          <AlpacaCard configured isPaper={alpaca.isPaper} />
        </div>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}
