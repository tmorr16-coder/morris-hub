// Interactive multi-screen preview of the iOS-native design system, rendered
// with the REAL component library and mock data (no Supabase). Navigate via the
// tab bar. Living style guide + integration target at /ios-demo.
"use client";

import { useState } from "react";
import { TabBar } from "@/components/ios";
import TodayScreen from "./TodayScreen";
import FamilyScreen from "./FamilyScreen";
import HealthScreen from "./HealthScreen";
import MoreScreen from "./MoreScreen";

type Tab = "today" | "family" | "health" | "more";

const MEMBERS = [
  { id: "sarah", label: "Sarah" },
  { id: "emma", label: "Emma" },
  { id: "jack", label: "Jack" },
];

export default function IOSDemo() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div data-ui="ios">
      <div className="ios-scroll" key={tab}>
        {tab === "today" && <TodayScreen />}
        {tab === "family" && <FamilyScreen />}
        {tab === "health" && <HealthScreen />}
        {tab === "more" && <MoreScreen />}
      </div>
      <TabBar current={tab} members={MEMBERS} sourceApp="hub" onSelect={(k) => setTab(k as Tab)} />
    </div>
  );
}
