import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/site-url";
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
    const hint = error.message.includes("Email logins are disabled")
      ? "Enable Email/Password in Supabase Auth → Providers, then try again."
      : error.message.includes("Invalid login credentials")
      ? "Wrong email or password. Use PUT /api/auth/test-login to set the password first."
      : error.message;
    return NextResponse.json({ error: hint }, { status: 401 });
  }

  return NextResponse.json({ ok: true, redirectTo: `${publicOrigin()}/home`, userId: data.user?.id });
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

  // Try to find existing user first and update their password
  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 200 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = (listData?.users ?? []).find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    // User exists (e.g. from Google OAuth) — set/update their password
    const { data: updated, error: updateErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });
    try {
      await admin.schema("hub").from("preferences").upsert(
        { user_id: existing.id, onboarding_completed: true, app_access: ["hub", "health", "finance", "investments", "career", "student-success", "children", "bible"] },
        { onConflict: "user_id" }
      );
    } catch { /* ignore */ }
    return NextResponse.json({ ok: true, userId: updated?.user?.id ?? existing.id, email, action: "password_updated" });
  }

  // Create new user — skips email verification
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name ?? email.split("@")[0] },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Create hub.preferences row so the user bypasses onboarding
  try {
    await admin.schema("hub").from("preferences").upsert(
      { user_id: data.user.id, onboarding_completed: true, app_access: ["hub", "health", "finance", "investments", "career", "student-success", "children", "bible"] },
      { onConflict: "user_id" }
    );
  } catch { /* ignore if table not ready */ }

  return NextResponse.json({ ok: true, userId: data.user.id, email: data.user.email, action: "created" });
}
