"use client";

// Production, props-driven presentation of the iOS-native Today hub. The server
// /home page maps its real data into these props and renders this inside an
// <IOSScreen>. The /ios-demo TodayScreen feeds it mock props — so this exact
// component is what ships. No data fetching here; presentation only.

import { useState } from "react";
import {
  LargeTitle, Group, Cell, IconBadge,
  GlanceGrid, GlanceTile, Segmented, SeverityBadge, AskMorrisPill, Icons,
  type Severity,
} from "@/components/ios";

export type GlanceKey = "calendar" | "reminders" | "health" | "money";
export interface GlanceItem { value: React.ReactNode; sub?: React.ReactNode; badge?: React.ReactNode; href: string; }

export interface AttentionItem { id: string; severity: Severity; title: string; context: React.ReactNode; category: string; href: string; }
export interface TimelineRow { id: string; time: string; label: string; category: string; }
export interface PriorityRow { id: string; title: string; done?: boolean; flag?: string; }
export interface FamilyRow { id: string; name: string; status: string; color: string; initial: string; href: string; }

export interface TodayHubProps {
  firstName: string;
  dateLabel: string;
  greeting: string;
  glance: Partial<Record<GlanceKey, GlanceItem>>;
  attention: AttentionItem[];
  timeline: TimelineRow[];
  priorities: PriorityRow[];
  family: FamilyRow[];
  onOpenMoney?: () => void;
  onOpenAsk?: () => void;
  /** Called with the todo id and its NEW completed state. */
  onToggleTodo?: (id: string, completed: boolean) => void;
  /** Quick-actions row rendered under the glance grid. */
  quickActions?: React.ReactNode;
  /** Streamed server sections (markets, news) rendered under Ask Morris. */
  slot?: React.ReactNode;
}

// category → SF-symbol-style icon + accent color
const CAT: Record<string, { icon: React.ReactNode; color: string }> = {
  workout: { icon: <Icons.DumbbellIcon />, color: "var(--ios-green)" },
  health: { icon: <Icons.HeartIcon />, color: "var(--ios-green)" },
  medication: { icon: <Icons.PillIcon />, color: "var(--ios-green)" },
  bill: { icon: <Icons.WalletIcon />, color: "var(--ios-finance)" },
  finance: { icon: <Icons.WalletIcon />, color: "var(--ios-finance)" },
  appointment: { icon: <Icons.CalendarIcon />, color: "var(--ios-orange)" },
  calendar: { icon: <Icons.CalendarIcon />, color: "var(--ios-orange)" },
  family: { icon: <Icons.PeopleIcon />, color: "var(--ios-orange)" },
  work: { icon: <Icons.BriefcaseIcon />, color: "var(--ios-tint)" },
  course: { icon: <Icons.BookIcon />, color: "var(--ios-tint)" },
  todo: { icon: <Icons.ChecklistIcon />, color: "var(--ios-tint)" },
  general: { icon: <Icons.BellIcon />, color: "var(--ios-tint)" },
};
const cat = (k: string) => CAT[k] ?? CAT.general;

const GLANCE_META: Record<GlanceKey, { label: string; accent: string; icon: React.ReactNode }> = {
  calendar: { label: "Calendar", accent: "var(--ios-tint)", icon: <Icons.CalendarIcon /> },
  reminders: { label: "Reminders", accent: "var(--ios-orange)", icon: <Icons.BellIcon /> },
  health: { label: "Health", accent: "var(--ios-green)", icon: <Icons.HeartIcon /> },
  money: { label: "Money", accent: "var(--ios-finance)", icon: <Icons.WalletIcon /> },
};
const GLANCE_ORDER: GlanceKey[] = ["calendar", "reminders", "health", "money"];

export default function TodayHubIOS({
  firstName, dateLabel, greeting, glance, attention, timeline, priorities, family,
  onOpenMoney, onOpenAsk, onToggleTodo, quickActions, slot,
}: TodayHubProps) {
  const [mode, setMode] = useState<"family" | "personal">("family");
  const glanceKeys = GLANCE_ORDER.filter((k) => glance[k]);

  return (
    <>
      <LargeTitle
        title="Today"
        subtitle={`${dateLabel} · ${greeting}, ${firstName}`}
        avatarInitial={firstName[0]?.toUpperCase()}
        onCompose={onOpenAsk}
        composeLabel="Ask Morris"
        composeIcon={<Icons.SparkleIcon aria-hidden style={{ width: 24, height: 24 }} />}
      />

      <Segmented
        ariaLabel="Scope"
        value={mode}
        onChange={setMode}
        options={[{ value: "family", label: "Family" }, { value: "personal", label: "Personal" }]}
      />

      {glanceKeys.length > 0 && (
        <GlanceGrid>
          {glanceKeys.map((k) => {
            const g = glance[k]!;
            const meta = GLANCE_META[k];
            return (
              <GlanceTile
                key={k}
                label={meta.label}
                accent={meta.accent}
                icon={g.badge == null ? meta.icon : undefined}
                badge={g.badge}
                value={g.value}
                sub={g.sub}
                href={g.href}
                onClick={k === "money" ? onOpenMoney : undefined}
              />
            );
          })}
        </GlanceGrid>
      )}

      {quickActions}

      <AskMorrisPill onClick={onOpenAsk} />

      {slot}

      {attention.length > 0 && (
        <Group header="Needs attention" id="needs-attention">
          {attention.map((a) => {
            const c = cat(a.category);
            return (
              <Cell
                key={a.id}
                lead={<IconBadge color={c.color}>{c.icon}</IconBadge>}
                title={a.title}
                subtitle={<><SeverityBadge level={a.severity} /> · {a.context}</>}
                href={a.href}
              />
            );
          })}
        </Group>
      )}

      {timeline.length > 0 && (
        <Group header="Today's plan" id="today-plan">
          {timeline.map((t) => {
            const c = cat(t.category);
            return (
              <Cell
                key={t.id}
                insetSeparator
                lead={<span className="ios-num ios-footnote" style={{ width: 62, color: "var(--ios-label-2)" }}>{t.time}</span>}
                title={t.label}
                trailing={<IconBadge color={c.color}>{c.icon}</IconBadge>}
                chevron={false}
              />
            );
          })}
        </Group>
      )}

      {mode === "personal" && priorities.length > 0 && (
        <Group header="My priorities" id="priorities">
          {priorities.map((p) => (
            <Cell
              key={p.id}
              lead={<TodoCircle checked={p.done} onClick={onToggleTodo ? () => onToggleTodo(p.id, !p.done) : undefined} />}
              title={p.done ? <s style={{ color: "var(--ios-label-2)" }}>{p.title}</s> : p.title}
              subtitle={p.flag ? <span style={{ color: "var(--ios-red)" }}>{p.flag}</span> : undefined}
              chevron={false}
            />
          ))}
        </Group>
      )}

      {mode === "family" && family.length > 0 && (
        <Group header="Family" id="family">
          {family.map((m) => (
            <Cell
              key={m.id}
              lead={<span aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", background: m.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>{m.initial}</span>}
              title={m.name}
              subtitle={m.status}
              href={m.href}
            />
          ))}
        </Group>
      )}

      <div style={{ height: 12 }} />
    </>
  );
}

function TodoCircle({ checked, onClick }: { checked?: boolean; onClick?: () => void }) {
  const dot = (
    <span
      aria-hidden
      style={{
        width: 22, height: 22, borderRadius: "50%",
        border: `1.7px solid ${checked ? "var(--ios-green)" : "var(--ios-label-3)"}`,
        background: checked ? "var(--ios-green)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      {checked && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>}
    </span>
  );
  if (onClick) return <button type="button" onClick={onClick} aria-label={checked ? "Mark incomplete" : "Mark complete"} style={{ display: "flex" }}>{dot}</button>;
  return dot;
}
