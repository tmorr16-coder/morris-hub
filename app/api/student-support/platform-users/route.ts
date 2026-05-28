import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// ── GET: list other platform users (for the share picker) ────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Fetch all profiles except the current user
  const { data: profiles, error } = await service
    .from("profiles")
    .select("id, email, full_name, app_access")
    .neq("id", user.id)
    .eq("status", "approved");

  if (error) {
    // profiles table may not have a status column — fall back without the filter
    const { data: allProfiles, error: err2 } = await service
      .from("profiles")
      .select("id, email, full_name, app_access")
      .neq("id", user.id);

    if (err2) {
      return NextResponse.json({ error: err2.message }, { status: 500 });
    }

    return NextResponse.json(allProfiles ?? []);
  }

  return NextResponse.json(profiles ?? []);
}
