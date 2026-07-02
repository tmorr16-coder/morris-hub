// Interactive multi-screen preview of the iOS-native design system, rendered
// with the REAL component library and mock data (no Supabase). Tabs are screen
// roots; tiles/rows push detail screens onto a nav stack with back navigation.
"use client";

import { useState } from "react";
import { TabBar } from "@/components/ios";
import TodayScreen from "./TodayScreen";
import FamilyScreen from "./FamilyScreen";
import HealthScreen from "./HealthScreen";
import MoreScreen from "./MoreScreen";
import MoneyScreen from "./MoneyScreen";
import AskScreen from "./AskScreen";
import InvestmentsScreen from "./InvestmentsScreen";
import NewsScreen from "./NewsScreen";

type Tab = "today" | "family" | "health" | "more";
type Screen = Tab | "money" | "ask" | "invest" | "news";

const MEMBERS = [
  { id: "sarah", label: "Sarah" },
  { id: "emma", label: "Emma" },
  { id: "jack", label: "Jack" },
];

const isTab = (s: Screen): s is Tab => s === "today" || s === "family" || s === "health" || s === "more";

export default function IOSDemo() {
  const [stack, setStack] = useState<Screen[]>(["today"]);
  const screen = stack[stack.length - 1];

  const push = (s: Screen) => setStack((st) => [...st, s]);
  const back = () => setStack((st) => (st.length > 1 ? st.slice(0, -1) : st));
  const selectTab = (t: Tab) => setStack([t]);

  // Active tab for the tab bar = the deepest tab in the stack.
  const activeTab = ([...stack].reverse().find(isTab) ?? "today") as Tab;
  const showTabBar = screen !== "ask"; // chat is full-screen with its own composer

  return (
    <div data-ui="ios">
      <div className="ios-scroll" key={stack.join("/")}>
        {screen === "today" && <TodayScreen onOpenMoney={() => push("money")} onOpenAsk={() => push("ask")} />}
        {screen === "family" && <FamilyScreen />}
        {screen === "health" && <HealthScreen />}
        {screen === "more" && (
          <MoreScreen
            onOpenMoney={() => push("money")}
            onOpenAsk={() => push("ask")}
            onOpenInvest={() => push("invest")}
            onOpenNews={() => push("news")}
          />
        )}
        {screen === "money" && <MoneyScreen onBack={back} onOpenInvest={() => push("invest")} />}
        {screen === "invest" && <InvestmentsScreen onBack={back} />}
        {screen === "news" && <NewsScreen onBack={back} />}
        {screen === "ask" && <AskScreen onBack={back} />}
      </div>
      {showTabBar && (
        <TabBar current={activeTab} members={MEMBERS} sourceApp="hub" onSelect={(k) => selectTab(k as Tab)} />
      )}
    </div>
  );
}
