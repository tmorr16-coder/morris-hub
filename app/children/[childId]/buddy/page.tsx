export const dynamic = "force-dynamic";

// Everything the child and Buddy have said to each other, for the parents:
// grouped by day, then by sitting. Read-only.

/* eslint-disable @typescript-eslint/no-explicit-any */

import { redirect, notFound } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { LargeTitle, Group, Cell, TabBar } from "@/components/ios";
import { childForGuardian } from "../../_lib/children";

interface Msg { id: string; session_id: string; role: "user" | "assistant"; content: string; created_at: string }

function plain(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, "$1");
}

export default async function BuddyTranscriptsPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const svc = createServiceClient() as any;
  const child = await childForGuardian(svc, childId, user.id);
  if (!child) notFound();
  const first = (child.display_name ?? "Child").split(" ")[0];

  const { data } = await svc.schema("hub").from("child_tutor_messages")
    .select("id, session_id, role, content, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(400);
  const msgs = ((data ?? []) as Msg[]).slice().reverse();

  // Day → sitting → messages.
  const days = new Map<string, Map<string, Msg[]>>();
  for (const m of msgs) {
    const day = new Date(m.created_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const sittings = days.get(day) ?? new Map<string, Msg[]>();
    const arr = sittings.get(m.session_id) ?? [];
    arr.push(m);
    sittings.set(m.session_id, arr);
    days.set(day, sittings);
  }
  const dayList = [...days.entries()].reverse();

  return (
    <div data-ui="ios">
      <div className="ios-scroll">
        <LargeTitle title={`${first} & Buddy`} subtitle={msgs.length === 0 ? "No conversations yet" : `${msgs.length} messages`} />
        {dayList.length === 0 && (
          <Group footer="Every exchange on the child's screen is kept here for you. Nothing has been said yet.">
            <Cell chevron={false} title="Nothing yet" />
          </Group>
        )}
        {dayList.map(([day, sittings]) => (
          [...sittings.entries()].reverse().map(([sid, list], i) => (
            <Group key={sid} header={`${day}${sittings.size > 1 ? ` · sitting ${sittings.size - i}` : ""}`} footer={`${new Date(list[0].created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${new Date(list[list.length - 1].created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}>
              {list.map((m) => (
                <Cell key={m.id} chevron={false} lead={<span style={{ fontSize: 20, width: 30, textAlign: "center" }}>{m.role === "assistant" ? "🦉" : "🧒"}</span>} title={<span style={{ fontWeight: m.role === "user" ? 600 : 400, color: m.role === "assistant" ? "var(--ios-label-2)" : "var(--ios-label)", whiteSpace: "pre-wrap" }}>{plain(m.content)}</span>} />
              ))}
            </Group>
          ))
        ))}
        <div style={{ height: 24 }} />
      </div>
      <TabBar current="more" currentUserId={user.id} sourceApp="children" />
    </div>
  );
}
