import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { getPreferences } from "@/lib/prefs";
import LSATChat from "./LSATChat";

export default async function LSATChatPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/");
  const prefs = await getPreferences(userId);
  if (!prefs.app_access?.includes("student-success")) redirect("/home");

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <LSATChat />
    </div>
  );
}
