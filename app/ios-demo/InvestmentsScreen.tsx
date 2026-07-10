"use client";

import { NavBar, LargeTitle, Group, Cell, IconBadge, Segmented, Icons } from "@/components/ios";
import { Sparkline } from "./ui";
import { useState } from "react";

const SERIES = [284.2, 286.1, 285.4, 288.9, 287.6, 289.8, 290.4, 291.5];

function Chg({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className="ios-num" style={{ color: up ? "var(--ios-green)" : "var(--ios-red)", fontWeight: 600 }}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function InvestmentsScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<"holdings" | "watchlist">("holdings");

  return (
    <>
      <NavBar back={{ label: "More", onBack }} />
      <LargeTitle title="Investments" subtitle="Portfolio · paper trading" />

      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 16 }}>
        <div className="ios-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em" }}>$291,500</div>
        <div className="ios-subhead" style={{ color: "var(--ios-green)", marginTop: 2 }}>▲ $1,120 (0.39%) today</div>
        <div style={{ margin: "14px 0 2px" }}><Sparkline points={SERIES} /></div>
      </div>

      <Segmented
        ariaLabel="View"
        value={tab}
        onChange={setTab}
        options={[
          { value: "holdings", label: "Holdings" },
          { value: "watchlist", label: "Watchlist" },
        ]}
      />

      {tab === "holdings" ? (
        <Group header="Holdings">
          <Holding sym="NVDA" name="NVIDIA" price="128.30" pct={2.1} />
          <Holding sym="AAPL" name="Apple" price="210.50" pct={1.2} />
          <Holding sym="VOO" name="Vanguard S&P 500" price="512.40" pct={0.4} />
          <Holding sym="MSFT" name="Microsoft" price="448.10" pct={-0.3} />
          <Holding sym="LLY" name="Eli Lilly" price="892.60" pct={0.8} />
        </Group>
      ) : (
        <Group header="Watchlist">
          <Holding sym="TSLA" name="Tesla" price="248.90" pct={-1.4} />
          <Holding sym="AMZN" name="Amazon" price="201.30" pct={0.9} />
          <Holding sym="GOOGL" name="Alphabet" price="182.70" pct={0.2} />
        </Group>
      )}

      <Group header="Research">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>} title="Deep research" subtitle="AI analysis with live web search" href="/investments" />
        <Cell lead={<IconBadge color="#C97A3A"><Icons.ChartIcon /></IconBadge>} title="Ideas" subtitle="Screens & watchlist candidates" href="/investments/ideas" />
      </Group>

      <div style={{ height: 12 }} />
    </>
  );
}

function Holding({ sym, name, price, pct }: { sym: string; name: string; price: string; pct: number }) {
  return (
    <Cell
      lead={<span aria-hidden style={{ width: 38, height: 38, borderRadius: 9, background: "var(--ios-fill)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, letterSpacing: "-0.02em" }}>{sym}</span>}
      title={name}
      subtitle={sym}
      trailing={
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <span className="ios-num" style={{ color: "var(--ios-label)" }}>${price}</span>
          <Chg pct={pct} />
        </span>
      }
      chevron={false}
      href="/investments/stocks"
    />
  );
}
