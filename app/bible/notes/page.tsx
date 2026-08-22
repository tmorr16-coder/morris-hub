import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import NotesClient from "./NotesClient";

export default async function NotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data: notes } = await db.schema("bible").from("notes")
    .select("*").eq("user_id", user.id).order("created_at", { ascending: false });

  return (
    <div className="ios-scroll">
      <NotesClient initialNotes={notes ?? []} userId={user.id} />
    </div>
  );
}
