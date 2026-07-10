"use client";

import { NavBar, LargeTitle, Group, Cell, IconBadge, Segmented, Icons } from "@/components/ios";
import { Sparkline } from "./ui";
import { useState } from "react";

const SERIES: Record<string, number[]> = {
  "1M": [476.1, 477.8, 476.9, 479.2, 480.5, 479.8, 481.1, 482.3],
  "1Y": [402, 415, 411, 428, 440, 447, 455, 462, 470, 474, 478, 482.3],
  All: [180, 210, 245, 288, 322, 360, 402, 462, 482.3],
};

export default function MoneyScreen({ onBack, onOpenInvest }: { onBack: () => void; onOpenInvest?: () => void }) {
  const [range, setRange] = useState<"1M" | "1Y" | "All">("1M");

  return (
    <>
      <NavBar back={{ label: "More", onBack }} />
      <LargeTitle title="Money" subtitle="Net worth · shared with Sarah" />

      {/* Net worth hero */}
      <div className="ios-list" style={{ margin: "8px 16px 0", padding: 16 }}>
        <div className="ios-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em" }}>$482,300</div>
        <div className="ios-subhead" style={{ color: "var(--ios-green)", marginTop: 2 }}>▲ $1,240 today · ▲ $6,180 this month</div>
        <div style={{ margin: "14px 0 6px" }}>
          <Sparkline points={SERIES[range]} />
        </div>
        <Segmented
          ariaLabel="Range"
          value={range}
          onChange={setRange}
          options={[
            { value: "1M", label: "1M" },
            { value: "1Y", label: "1Y" },
            { value: "All", label: "All" },
          ]}
          style={{ margin: "8px 0 0" }}
        />
      </div>

      <Group header="Accounts">
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.WalletIcon /></IconBadge>} title="Checking" subtitle="Chase ····4021" trailing={<span className="ios-num">$12,430</span>} href="/finance/dashboard" />
        <Cell lead={<IconBadge color="var(--ios-green)"><Icons.WalletIcon /></IconBadge>} title="Savings" subtitle="Ally ····8890" trailing={<span className="ios-num">$48,200</span>} href="/finance/dashboard" />
        <Cell lead={<IconBadge color="#C97A3A"><Icons.TrendUpIcon /></IconBadge>} title="Investments" subtitle="Fidelity · brokerage" trailing={<span className="ios-num">$291,500</span>} onClick={onOpenInvest} />
        <Cell lead={<IconBadge color="#8B6A47"><Icons.ChartIcon /></IconBadge>} title="Retirement" subtitle="401(k) + IRA" trailing={<span className="ios-num">$118,900</span>} href="/finance/retirement" />
        <Cell lead={<IconBadge color="var(--ios-red)"><Icons.WalletIcon /></IconBadge>} title="Credit card" subtitle="Amex · due Jul 12" trailing={<span className="ios-num" style={{ color: "var(--ios-red)" }}>–$2,340</span>} href="/finance/dashboard" />
      </Group>

      <Group header="This month" footer="Tap Insights for AI analysis of your spending.">
        <Cell lead={<IconBadge color="var(--ios-orange)"><Icons.ChartIcon /></IconBadge>} title="Spending" subtitle="$4,820 of $6,000 budget" trailing={<span className="ios-num">80%</span>} href="/finance/dashboard/insights" />
        <Cell lead={<IconBadge color="var(--ios-tint)"><Icons.SparkleIcon /></IconBadge>} title="Insights" subtitle="Dining up 22% vs. last month" href="/finance/dashboard/insights" />
      </Group>

      <div style={{ height: 12 }} />
    </>
  );
}
