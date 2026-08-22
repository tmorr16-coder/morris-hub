export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import JournalClient, { type JournalEntry } from "./_components/JournalClient";

export default async function JournalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data } = await service.schema("hub").from("journal_entries")
    .select("id, title, content, mood, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const entries: JournalEntry[] = (data as JournalEntry[] | null) ?? [];

  return (
    <IOSScreen>
      <LargeTitle
        title="Journal"
        subtitle="Your private reflections"
        avatarInitial={(user.user_metadata?.full_name ?? "T")[0]?.toUpperCase()}
      />

      <div style={{ padding: "0 16px" }}>
        <JournalClient initialEntries={entries} userId={user.id} />
      </div>

      <div style={{ height: 12 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
