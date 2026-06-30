import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { planId } = await req.json();
  const db = createServiceClient() as any;

  const { error } = await db.schema("bible").from("user_plans").upsert({
    user_id: user.id,
    plan_id: planId,
  }, { onConflict: "user_id,plan_id" });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
