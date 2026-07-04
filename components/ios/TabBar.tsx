"use client";

import { useState } from "react";
import Link from "next/link";
import { TodayIcon, PeopleIcon, HeartIcon, EllipsisIcon, PlusIcon } from "./icons";
import { CaptureSheet, type FamilyMember } from "./CaptureSheet";
import { useNavMode } from "@/components/NavModeProvider";

type TabKey = "today" | "family" | "health" | "more";
const ICON: Record<TabKey, (p: { "aria-hidden": true }) => React.ReactNode> = {
  today: TodayIcon,
  family: PeopleIcon,
  health: HeartIcon,
  more: EllipsisIcon,
};

const DEFAULT_TABS: { key: TabKey; label: string; href: string }[] = [
  { key: "today", label: "Today", href: "/home" },
  { key: "family", label: "Family", href: "/home/family" },
  { key: "health", label: "Health", href: "/health" },
  { key: "more", label: "More", href: "/home/more" },
];

/**
 * Translucent iOS tab bar with a center + Capture button that opens the
 * Quick Capture sheet. The four tabs optimize for the family's high-use areas;
 * override via `tabs` if needed.
 */
export function TabBar({
  current,
  members = [],
  currentUserId,
  sourceApp = "hub",
  tabs = DEFAULT_TABS,
  onSelect,
}: {
  current: TabKey;
  members?: FamilyMember[];
  currentUserId?: string;
  sourceApp?: string;
  tabs?: { key: TabKey; label: string; href: string }[];
  /** When provided, tabs switch in place (call this) instead of navigating. */
  onSelect?: (key: TabKey) => void;
}) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const { personal } = useNavMode();
  // Solo users get a "Me" tab (→ their personal dashboard) instead of "Family".
  const resolvedTabs = personal
    ? tabs.map((t) => (t.key === "family" ? { ...t, label: "Me", href: "/home/me" } : t))
    : tabs;
  const half = Math.ceil(resolvedTabs.length / 2);
  const left = resolvedTabs.slice(0, half);
  const right = resolvedTabs.slice(half);

  const tab = (t: { key: TabKey; label: string; href: string }) => {
    const Icon = ICON[t.key];
    const isCurrent = t.key === current;
    if (onSelect) {
      return (
        <button
          key={t.key}
          type="button"
          className="ios-tab"
          aria-current={isCurrent ? "page" : undefined}
          onClick={() => onSelect(t.key)}
        >
          <Icon aria-hidden />
          {t.label}
        </button>
      );
    }
    return (
      <Link key={t.key} href={t.href} className="ios-tab" aria-current={isCurrent ? "page" : undefined}>
        <Icon aria-hidden />
        {t.label}
      </Link>
    );
  };

  return (
    <>
      <nav className="ios-tabbar" aria-label="Primary">
        {left.map(tab)}
        <button
          className="ios-tab ios-tab--capture"
          onClick={() => setCaptureOpen(true)}
          aria-label="Quick capture"
          aria-haspopup="dialog"
        >
          <span className="ios-capture-fab">
            <PlusIcon aria-hidden />
          </span>
        </button>
        {right.map(tab)}
      </nav>
      <CaptureSheet
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        members={members}
        currentUserId={currentUserId}
        sourceApp={sourceApp}
      />
    </>
  );
}
