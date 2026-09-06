import { redirect } from "next/navigation";
import { createServiceClient, getCurrentUser } from "@/lib/supabase/server";
import { KNOWN_VERSIONS } from "@/lib/bible-api";
import SearchAndAsk from "./_components/SearchAndAsk";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
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

  // ReferenceField sends a query that is not a reference here as ?q=, from
  // whichever screen it was typed on. Without picking it up, a topic search
  // from the dashboard arrived at an empty search box and had to be retyped.
  const { tab, q } = await searchParams;
  const initialTab = tab === "ask" ? "ask" : "search";
  const initialQuery = (q ?? "").slice(0, 200);

  return (
    <div className="ios-scroll">
      <SearchAndAsk
        versions={KNOWN_VERSIONS}
        defaultBibleId={preferredBibleId}
        initialTab={initialTab}
        initialQuery={initialQuery}
        firstName={user.user_metadata?.full_name?.split(" ")[0] ?? ""}
      />
    </div>
  );
}
