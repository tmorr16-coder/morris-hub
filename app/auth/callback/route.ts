import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Check if user has completed onboarding
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = createServiceClient() as any;
      const { data: prefs } = await service
        .schema("hub")
        .from("preferences")
        .select("onboarding_completed")
        .eq("user_id", data.user.id)
        .maybeSingle();

      const destination = prefs?.onboarding_completed ? next : "/onboarding";
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }
  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
