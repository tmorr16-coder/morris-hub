import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { getPreferences } from "@/lib/prefs";
import { LargeTitle } from "@/components/ios";
import LSATChat from "./LSATChat";

export default async function LSATChatPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/");
  const prefs = await getPreferences(userId);
  if (!prefs.app_access?.includes("career")) redirect("/home");

  return (
    <div className="ios-scroll">      <LargeTitle title="LSAT Tutor" />
      <LSATChat />
    </div>
  );
}
