export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/prefs";
import { getPositions, type AlpacaPosition } from "@/lib/alpaca";
import { fetchQuotes, type Quote } from "@/lib/stocks";
import { LargeTitle, Group, Cell, IconBadge, Icons } from "@/components/ios";
import MarketBar from "../_components/MarketBar";
import TickerBar from "../_components/TickerBar";

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

export default async function InvestmentsStocksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const prefs = await getPreferences(user.id);
  if (!prefs.app_access?.includes("investments")) redirect("/home");

  const watched = prefs.watched_stocks ?? [];
  const [positions, quotes] = await Promise.all([
    getPositions().catch(() => [] as AlpacaPosition[]),
    fetchQuotes(watched).catch(() => [] as Quote[]),
  ]);

  const heldSymbols = new Set(positions.map((p) => p.symbol.toUpperCase()));
  const watchOnly = quotes.filter((q) => !heldSymbols.has(q.symbol.toUpperCase()));

  return (
    <div className="ios-scroll">
      <LargeTitle title="Stocks" subtitle="Live quotes · paper trading" />

      {/* Live market widgets — client components kept as-is (chrome-only) */}
      <div style={{ margin: "8px 16px 0", borderRadius: 12, overflow: "hidden" }}>
        <MarketBar />
        {watched.length > 0 && <TickerBar symbols={watched} />}
      </div>

      {positions.length > 0 && (
        <Group header="Holdings">
          {positions.map((p) => (
            <Cell
              key={p.asset_id}
              lead={<TickerBadge sym={p.symbol} />}
              title={p.symbol}
              subtitle={`${Number(p.qty).toLocaleString("en-US")} sh · avg $${Number(p.avg_entry_price).toFixed(2)}`}
              trailing={<PriceTrail price={Number(p.current_price).toFixed(2)} pct={Number(p.change_today) * 100} />}
              chevron={false}
            />
          ))}
        </Group>
      )}

      {watchOnly.length > 0 && (
        <Group header="Watchlist">
          {watchOnly.map((q) => (
            <Cell
              key={q.symbol}
              lead={<TickerBadge sym={q.symbol} />}
              title={q.shortName}
              subtitle={q.symbol}
              trailing={<PriceTrail price={q.price.toFixed(2)} pct={q.changePercent} />}
              chevron={false}
            />
          ))}
        </Group>
      )}

      {positions.length === 0 && watchOnly.length === 0 && (
        <Group header="Watchlist" footer="Add stocks to your watchlist to track live quotes here.">
          <Cell lead={<IconBadge color="#C97A3A"><Icons.ChartIcon /></IconBadge>} title="Explore investment ideas" href="/investments/ideas" />
        </Group>
      )}

      <div style={{ height: 12 }} />
    </div>
  );
}
