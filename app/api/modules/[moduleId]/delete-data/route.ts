import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { moduleId } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  try {
    switch (moduleId) {
      case "career":
        await Promise.all([
          service.schema("career").from("career_profile").delete().eq("user_id", userId),
          service.schema("career").from("career_goals").delete().eq("user_id", userId),
          service.schema("career").from("career_experiences").delete().eq("user_id", userId),
          service.schema("career").from("career_learning").delete().eq("user_id", userId),
          service.schema("career").from("career_relationships").delete().eq("user_id", userId),
          service.schema("career").from("career_advisor_messages").delete().eq("user_id", userId),
        ]);
        break;
      case "investments":
        await Promise.all([
          service.schema("hub").from("investment_ideas").delete().eq("user_id", userId),
          service.schema("hub").from("preferences").update({ watched_stocks: [] }).eq("user_id", userId),
        ]);
        break;
      case "student-success":
      case "children":
      case "bible":
      case "health":
      case "finance":
        // Cross-project or complex schemas — log and surface instruction to user
        console.log(`[modules/delete] ${moduleId} for ${userId}: data lives in separate app, user must delete from that module's settings`);
        break;
      default:
        return NextResponse.json({ error: `Unknown module: ${moduleId}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, moduleId });
  } catch (err) {
    console.error(`[modules/delete] ${moduleId}:`, err);
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  }
}
