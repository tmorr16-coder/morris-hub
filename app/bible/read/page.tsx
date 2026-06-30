import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BIBLE_BOOKS } from "@/lib/bible-api";
import BookPickerClient from "./_components/BookPickerClient";

export default async function ReadPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Load user's preferred translation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  // Graceful fallback if user_preferences table not yet migrated
  let preferredBibleId = "de4e12af7f28f599-02";
  try {
    const { data: prefs } = await db
      .schema("bible").from("user_preferences")
      .select("preferred_bible_id").eq("user_id", user.id).maybeSingle();
    if (prefs?.preferred_bible_id) preferredBibleId = prefs.preferred_bible_id;
  } catch { /* table not yet created */ }

  const menuUser = { email: user.email, name: user.user_metadata?.full_name ?? user.email, avatarUrl: user.user_metadata?.avatar_url ?? null };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: 80 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif, serif)", fontSize: 26, fontWeight: 400, margin: "0 0 20px" }}>
          Select a book
        </h1>
        <BookPickerClient books={BIBLE_BOOKS} preferredBibleId={preferredBibleId} />
      </div>
    </div>
  );
}
