import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

// Test login bypass — only active when ENABLE_TEST_AUTH=true in server env.
// Lets internal team sign in without Google OAuth for testing.
export async function POST(req: NextRequest) {
  if (process.env.ENABLE_TEST_AUTH !== "true") {
    return NextResponse.json({ error: "Test auth not enabled" }, { status: 403 });
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  // Sign in via standard password auth (requires email+password enabled in Supabase)
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://morrisai.family";
  return NextResponse.json({ ok: true, redirectTo: `${appUrl}/home`, userId: data.user?.id });
}

// GET — create a test user account (admin only, server-side)
// Used to provision test accounts without going through the normal signup flow.
export async function PUT(req: NextRequest) {
  if (process.env.ENABLE_TEST_AUTH !== "true") {
    return NextResponse.json({ error: "Test auth not enabled" }, { status: 403 });
  }

  const { email, password, name } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createServiceClient() as any;

  // Create user via admin API — skips email verification
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // auto-confirm so they can log in immediately
    user_metadata: { full_name: name ?? email.split("@")[0] },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Create hub.preferences row so the user bypasses onboarding
  try {
    await admin.schema("hub").from("preferences").upsert(
      { user_id: data.user.id, onboarding_completed: true, app_access: ["hub", "health", "finance", "investments", "career", "student-success", "bible"] },
      { onConflict: "user_id" }
    );
  } catch { /* ignore if table not ready */ }

  return NextResponse.json({ ok: true, userId: data.user.id, email: data.user.email });
}
