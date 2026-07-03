import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { getPreferences } from "@/lib/prefs";
import { LargeTitle, Icons } from "@/components/ios";
import LSATChat from "./LSATChat";

export default async function LSATChatPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/");
  const prefs = await getPreferences(userId);
  if (!prefs.app_access?.includes("career")) redirect("/home");

  return (
    <div className="ios-scroll">
      <Link href="/career/lsat" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ios-tint)", padding: "6px 16px 0", fontWeight: 500 }} className="ios-subhead">
        <Icons.ChevronLeft style={{ width: 16, height: 16 }} /> LSAT
      </Link>
      <LargeTitle title="LSAT Tutor" />
      <LSATChat />
    </div>
  );
}
