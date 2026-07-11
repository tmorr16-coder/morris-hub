"use client";

// Demo wrapper: feeds mock props into the PRODUCTION TodayHubIOS component
// (app/home/_components/TodayHubIOS) that the real /home route will render.

import TodayHubIOS from "@/app/home/_components/TodayHubIOS";

export default function TodayScreen({ onOpenMoney, onOpenAsk }: { onOpenMoney?: () => void; onOpenAsk?: () => void }) {
  return (
    <TodayHubIOS
      firstName="Terry"
      dateLabel="Wednesday, July 2"
      greeting="Good morning"
      onOpenMoney={onOpenMoney}
      onOpenAsk={onOpenAsk}
      glance={{
        weather: { value: "72°", sub: "Sunny · H 78°", href: "/news" },
        reminders: { value: "3 due", sub: "Duke Energy · 5 PM first", badge: 3, href: "/home" },
        health: { value: "8,240", sub: "steps · Workout 6 PM", href: "/health" },
        money: { value: "$482,300", sub: "+$1,240 today", href: "/finance/dashboard" },
      }}
      attention={[
        { id: "a1", severity: "urgent", title: "Missed Upper Body workout", context: "was scheduled Jul 1", category: "workout", href: "/health/train", kind: "workout", actionId: "w1" },
        { id: "a2", severity: "today", title: "Overlapping events today", context: "2 events within 30 min", category: "calendar", href: "/home", kind: "conflict", actionId: "" },
        { id: "a3", severity: "today", title: "Duke Energy bill", context: "payment due today · 5:00 PM", category: "bill", href: "/finance/dashboard", kind: "reminder", actionId: "r1" },
        { id: "a4", severity: "week", title: "Emma's Biology quiz", context: "due Jul 5", category: "course", href: "/home/me/courses", kind: "course_reminder", actionId: "c1" },
      ]}
      timeline={[
        { id: "t1", time: "8:00 AM", label: "Take Mounjaro", category: "medication", kind: "reminder", actionId: "r2", href: "/health" },
        { id: "t2", time: "9:30 AM", label: "Standup", category: "work", kind: "reminder", actionId: "r3" },
        { id: "t3", time: "4:30 PM", label: "Soccer practice — Emma", category: "family", kind: "reminder", actionId: "r4", href: "/home/family" },
        { id: "t4", time: "6:00 PM", label: "Upper Body workout", category: "workout", kind: "workout", actionId: "w2" },
        { id: "t5", time: "Due today", label: "Renew car registration", category: "todo", kind: "todo", actionId: "td1" },
      ]}
      priorities={[
        { id: "p1", title: "Call plumber about leak", flag: "High priority" },
        { id: "p2", title: "Review Q3 budget" },
        { id: "p3", title: "Buy Emma's birthday gift", done: true },
      ]}
      family={[
        { id: "me", name: "Terry (you)", status: "2 tasks today", color: "var(--ios-tint)", initial: "T", href: "/home/me" },
        { id: "sarah", name: "Sarah", status: "All clear", color: "#B565A7", initial: "S", href: "/home/family" },
        { id: "emma", name: "Emma", status: "Quiz Jul 5 · soccer 4:30", color: "#E8607A", initial: "E", href: "/home/family" },
        { id: "jack", name: "Jack", status: "All clear", color: "#34A56F", initial: "J", href: "/home/family" },
      ]}
    />
  );
}
