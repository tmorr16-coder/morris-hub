// Interactive multi-screen preview of the iOS-native design system, rendered
// with the REAL component library and mock data (no Supabase). Tabs switch the
// primary screens; the Money tile / Ask pill / More rows push detail screens.
"use client";

import { useState } from "react";
import { TabBar } from "@/components/ios";
import TodayScreen from "./TodayScreen";
import FamilyScreen from "./FamilyScreen";
import HealthScreen from "./HealthScreen";
import MoreScreen from "./MoreScreen";
import MoneyScreen from "./MoneyScreen";
import AskScreen from "./AskScreen";

type Tab = "today" | "family" | "health" | "more";
type Screen = Tab | "money" | "ask";

const MEMBERS = [
  { id: "sarah", label: "Sarah" },
  { id: "emma", label: "Emma" },
  { id: "jack", label: "Jack" },
];

export default function IOSDemo() {
  const [screen, setScreen] = useState<Screen>("today");
  const [returnTo, setReturnTo] = useState<Tab>("today");

  const push = (s: "money" | "ask", from: Tab) => { setReturnTo(from); setScreen(s); };
  const back = () => setScreen(returnTo);

  const isDetail = screen === "money" || screen === "ask";
  const activeTab: Tab = isDetail ? returnTo : (screen as Tab);
  const showTabBar = screen !== "ask"; // chat is full-screen with its own composer

  return (
    <div data-ui="ios">
      <div className="ios-scroll" key={screen}>
        {screen === "today" && <TodayScreen onOpenMoney={() => push("money", "today")} onOpenAsk={() => push("ask", "today")} />}
        {screen === "family" && <FamilyScreen />}
        {screen === "health" && <HealthScreen />}
        {screen === "more" && <MoreScreen onOpenMoney={() => push("money", "more")} onOpenAsk={() => push("ask", "more")} />}
        {screen === "money" && <MoneyScreen onBack={back} />}
        {screen === "ask" && <AskScreen onBack={back} />}
      </div>
      {showTabBar && (
        <TabBar current={activeTab} members={MEMBERS} sourceApp="hub" onSelect={(k) => setScreen(k as Tab)} />
      )}
    </div>
  );
}
