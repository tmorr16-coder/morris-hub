import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { name, email, note } = await request.json().catch(() => ({}));

  if (!name?.trim() || !email?.trim()) {
    return Response.json({ error: "Name and email are required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { error } = await service
    .schema("hub")
    .from("waitlist")
    .insert({ name: name.trim(), email: email.trim().toLowerCase(), note: note?.trim() || null });

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "This email is already on the waitlist." }, { status: 409 });
    }
    return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
