import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import NotesClient from "./NotesClient";

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const db = createServiceClient() as any;
  const { data: notes } = await db.schema("bible").from("notes")
    .select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  const menuUser = { email: user.email, name: user.user_metadata?.full_name ?? user.email, avatarUrl: user.user_metadata?.avatar_url ?? null };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: 80 }}>
      <NotesClient initialNotes={notes ?? []} userId={user.id} />
    </div>
  );
}
