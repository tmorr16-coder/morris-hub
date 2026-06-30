import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { KNOWN_VERSIONS } from "@/lib/bible-api";
import SearchAndAsk from "./_components/SearchAndAsk";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data: prefs } = await db
    .schema("bible")
    .from("user_preferences")
    .select("preferred_bible_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const preferredBibleId = prefs?.preferred_bible_id ?? "de4e12af7f28f599-02";

  const { tab } = await searchParams;
  const initialTab = tab === "ask" ? "ask" : "search";

  return (
    <SearchAndAsk
      versions={KNOWN_VERSIONS}
      defaultBibleId={preferredBibleId}
      initialTab={initialTab}
      firstName={user.user_metadata?.full_name?.split(" ")[0] ?? ""}
    />
  );
}
