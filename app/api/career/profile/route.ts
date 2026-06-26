import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET: fetch career_profile for the logged-in user. Returns the profile or null if not set up yet.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data, error } = await db
    .schema("career")
    .from("career_profile")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[career/profile GET] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}

// POST/PATCH: upsert career_profile. Body: any subset of profile fields.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    current_title,
    current_company,
    years_experience,
    industry,
    resume_text,
    linkedin_url,
    linkedin_bio,
    portfolio_urls,
    other_context,
    assessment_completed,
    assessment_responses,
    career_profile_summary,
    career_interests,
    target_roles,
  } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const payload: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  if (current_title !== undefined) payload.current_title = current_title;
  if (current_company !== undefined) payload.current_company = current_company;
  if (years_experience !== undefined) payload.years_experience = years_experience;
  if (industry !== undefined) payload.industry = industry;
  if (resume_text !== undefined) payload.resume_text = resume_text;
  if (linkedin_url !== undefined) payload.linkedin_url = linkedin_url;
  if (linkedin_bio !== undefined) payload.linkedin_bio = linkedin_bio;
  if (portfolio_urls !== undefined) payload.portfolio_urls = portfolio_urls;
  if (other_context !== undefined) payload.other_context = other_context;
  if (assessment_completed !== undefined) payload.assessment_completed = assessment_completed;
  if (assessment_responses !== undefined) payload.assessment_responses = assessment_responses;
  if (career_profile_summary !== undefined) payload.career_profile_summary = career_profile_summary;
  if (career_interests !== undefined) payload.career_interests = career_interests;
  if (target_roles !== undefined) payload.target_roles = target_roles;

  const { data, error } = await db
    .schema("career")
    .from("career_profile")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("[career/profile POST] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH: alias for POST (upsert)
export const PATCH = POST;
