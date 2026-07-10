"use client";

// Client shell for the iOS-native Today hub: wires router navigation + the
// toggle-todo server action, and renders the production TodayHubIOS presentation
// inside the iOS scope with the real translucent tab bar + Quick Capture.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IOSScreen, TabBar } from "@/components/ios";
import TodayHubIOS, { type TodayHubProps } from "./_components/TodayHubIOS";
import { toggleTodo } from "./actions";

export default function HomeClient({
  members,
  currentUserId,
  ...hub
}: TodayHubProps & { members: { id: string; label: string }[]; currentUserId: string }) {
  const router = useRouter();
  const [, start] = useTransition();

  return (
    <IOSScreen>
      <TodayHubIOS
        {...hub}
        onOpenMoney={() => router.push("/finance/dashboard")}
        onOpenAsk={() => router.push("/home/ask")}
        onToggleTodo={(id, completed) => start(async () => { await toggleTodo(id, completed); router.refresh(); })}
      />
      <TabBar current="today" members={members} currentUserId={currentUserId} sourceApp="hub" />
    </IOSScreen>
  );
}
