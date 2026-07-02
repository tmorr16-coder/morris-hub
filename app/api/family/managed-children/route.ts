import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";

// POST — create a managed (no-login) child profile
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
  if (!displayName) return Response.json({ error: "Name is required" }, { status: 400 });

  const birthYear = body.birth_year ? parseInt(body.birth_year, 10) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data, error } = await service.schema("hub").from("family_members")
    .insert({
      user_id: userId,
      member_user_id: null,
      role: "child",
      display_name: displayName,
      birth_year: birthYear,
    })
    .select("id, member_user_id, role, display_name, birth_year")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    member: {
      id: data.id,
      member_user_id: null,
      role: data.role,
      display_name: data.display_name,
      full_name: null,
      email: null,
      birth_year: data.birth_year,
      appAccess: null,
    },
  });
}

// PATCH — edit a managed child's name/birth year/age-tier override
export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { id, display_name, birth_year, life_stage_override } = body;
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  // Ownership check — only the owning parent can edit a managed profile.
  const { data: existing } = await service.schema("hub").from("family_members")
    .select("id").eq("id", id).eq("user_id", userId).is("member_user_id", null).maybeSingle();
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (typeof display_name === "string") updates.display_name = display_name.trim();
  if (birth_year !== undefined) updates.birth_year = birth_year ? parseInt(birth_year, 10) : null;
  if (life_stage_override !== undefined) {
    if (life_stage_override !== null && !["elementary", "teen", "college"].includes(life_stage_override)) {
      return Response.json({ error: "Invalid life_stage_override" }, { status: 400 });
    }
    updates.life_stage_override = life_stage_override;
  }

  const { error } = await service.schema("hub").from("family_members").update(updates).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
