"use client";

// Client shell for the iOS-native Today hub: holds the interactive Today lists
// (needs-attention, timeline, priorities) in local state so taps apply
// OPTIMISTICALLY — the item drops out / updates instantly, and we only fall
// back to a server refresh if the underlying action fails. Renders the
// production TodayHubIOS presentation inside the iOS scope with the real
// translucent tab bar + Quick Capture.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IOSScreen, TabBar } from "@/components/ios";
import TodayHubIOS, {
  type TodayHubProps, type ItemKind,
} from "./_components/TodayHubIOS";
import {
  toggleTodo, updateTodo, deleteTodo,
  completeReminder, completeCourseReminder, snoozeReminder, deleteReminder, updateReminder,
} from "./actions";

export default function HomeClient({
  members,
  currentUserId,
  ...hub
}: TodayHubProps & { members: { id: string; label: string }[]; currentUserId: string }) {
  const router = useRouter();
  const [, start] = useTransition();

  // Local, optimistic copies of the interactive lists.
  const [attention, setAttention] = useState(hub.attention);
  const [timeline, setTimeline] = useState(hub.timeline);
  const [priorities, setPriorities] = useState(hub.priorities);

  // Re-seed from the server when it sends fresh data (router.refresh /
  // navigation). Using the "adjust state during render" pattern instead of an
  // effect keeps this lint-clean and avoids a flash of stale rows.
  const sig = JSON.stringify([
    hub.attention.map((a) => a.id),
    hub.timeline.map((t) => t.id),
    hub.priorities.map((p) => [p.id, p.done]),
  ]);
  const [seed, setSeed] = useState(sig);
  if (sig !== seed) {
    setSeed(sig);
    setAttention(hub.attention);
    setTimeline(hub.timeline);
    setPriorities(hub.priorities);
  }

  // Run a server action; on failure, revert the optimistic state and refresh
  // so the UI resyncs with the truth.
  function run(action: Promise<{ error?: string }>, revert: () => void) {
    start(async () => {
      const res = await action.catch(() => ({ error: "failed" }) as { error?: string });
      if (res?.error) {
        revert();
        router.refresh();
      }
    });
  }

  const dropByAction = (actionId: string) => {
    setAttention((prev) => prev.filter((a) => a.actionId !== actionId));
    setTimeline((prev) => prev.filter((t) => t.actionId !== actionId));
  };

  const onToggleTodo = (id: string, completed: boolean) => {
    const snap = priorities;
    setPriorities((prev) => prev.map((p) => (p.id === id ? { ...p, done: completed } : p)));
    run(toggleTodo(id, completed), () => setPriorities(snap));
  };

  const onCompleteItem = (kind: ItemKind, actionId: string) => {
    const snapA = attention, snapT = timeline, snapP = priorities;
    const revert = () => { setAttention(snapA); setTimeline(snapT); setPriorities(snapP); };
    dropByAction(actionId);
    if (kind === "todo") setPriorities((prev) => prev.filter((p) => p.id !== actionId));

    const action =
      kind === "reminder" ? completeReminder(actionId)
      : kind === "course_reminder" ? completeCourseReminder(actionId)
      : kind === "todo" ? toggleTodo(actionId, true)
      : null;
    if (!action) return;
    run(action, revert);
  };

  const onDeleteItem = (kind: ItemKind, actionId: string) => {
    const snapA = attention, snapT = timeline, snapP = priorities;
    const revert = () => { setAttention(snapA); setTimeline(snapT); setPriorities(snapP); };
    dropByAction(actionId);
    if (kind === "todo") setPriorities((prev) => prev.filter((p) => p.id !== actionId));

    const action =
      kind === "reminder" ? deleteReminder(actionId)
      : kind === "todo" ? deleteTodo(actionId)
      : null;
    if (!action) return;
    run(action, revert);
  };

  const onSnoozeItem = (actionId: string, until: string) => {
    const snapA = attention, snapT = timeline;
    const revert = () => { setAttention(snapA); setTimeline(snapT); };
    dropByAction(actionId);
    run(snoozeReminder(actionId, until), revert);
  };

  const onEditItem = (
    kind: ItemKind,
    actionId: string,
    patch: { title?: string; due?: string | null },
  ) => {
    const snapA = attention, snapT = timeline, snapP = priorities;
    const revert = () => { setAttention(snapA); setTimeline(snapT); setPriorities(snapP); };
    if (patch.title !== undefined) {
      const t = patch.title;
      setAttention((prev) => prev.map((a) => (a.actionId === actionId ? { ...a, title: t } : a)));
      setTimeline((prev) => prev.map((r) => (r.actionId === actionId ? { ...r, label: t } : r)));
      if (kind === "todo") setPriorities((prev) => prev.map((p) => (p.id === actionId ? { ...p, title: t } : p)));
    }

    const action =
      kind === "reminder"
        ? updateReminder(actionId, {
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.due ? { due_at: patch.due } : {}),
          })
      : kind === "todo"
        ? updateTodo(actionId, {
            ...(patch.title !== undefined ? { title: patch.title } : {}),
            ...(patch.due !== undefined ? { due_date: patch.due } : {}),
          })
      : null;
    if (!action) return;
    run(action, revert);
  };

  return (
    // The platform skin used to be applied here, on this screen alone, as a
    // trial. It now lives on <body> in app/layout.tsx for every screen.
    <>
      <IOSScreen>
        <TodayHubIOS
          {...hub}
          attention={attention}
          timeline={timeline}
          priorities={priorities}
          onOpenMoney={() => router.push("/finance/dashboard")}
          onOpenAsk={() => router.push("/home/ask")}
          onToggleTodo={onToggleTodo}
          onCompleteItem={onCompleteItem}
          onDeleteItem={onDeleteItem}
          onSnoozeItem={onSnoozeItem}
          onEditItem={onEditItem}
        />
        <TabBar current="today" members={members} currentUserId={currentUserId} sourceApp="hub" />
      </IOSScreen>
    </>
  );
}
