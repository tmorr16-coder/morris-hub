import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { KNOWN_VERSIONS } from "@/lib/bible-api";
import SearchClient from "./_components/SearchClient";

export default async function SearchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data: prefs } = await db.schema("bible").from("user_preferences")
    .select("preferred_bible_id").eq("user_id", user.id).maybeSingle();
  const preferredBibleId = prefs?.preferred_bible_id ?? "de4e12af7f28f599-02";

  const menuUser = { email: user.email, name: user.user_metadata?.full_name ?? user.email, avatarUrl: user.user_metadata?.avatar_url ?? null };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", paddingBottom: 80 }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif, serif)", fontSize: 26, fontWeight: 400, margin: "0 0 20px" }}>
          Search the Bible
        </h1>
        <SearchClient versions={KNOWN_VERSIONS} defaultBibleId={preferredBibleId} />
      </div>
    </div>
  );
}
