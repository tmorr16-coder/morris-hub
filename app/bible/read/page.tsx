import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BIBLE_BOOKS } from "@/lib/bible-api";
import { LargeTitle } from "@/components/ios";
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

  return (
    <div className="ios-scroll">
      <LargeTitle title="Read" subtitle="Select a book" />
      <div style={{ padding: "0 16px 16px" }}>
        <BookPickerClient books={BIBLE_BOOKS} preferredBibleId={preferredBibleId} />
      </div>
    </div>
  );
}
