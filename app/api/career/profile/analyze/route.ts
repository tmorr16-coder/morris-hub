import { Anthropic } from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const client = new Anthropic();

// Assessment question labels for building the prompt
const QUESTION_LABELS: Record<string, string> = {
  q1: "What energizes you most at work? (task-completion / problem-solving / people / creating / leading)",
  q2: "How do you prefer to work? (independently / small-team / large-org)",
  q3: "What kind of impact matters most to you? (business-results / people-development / innovation / mission)",
  q4: "How do you approach risk? (conservative / balanced / risk-tolerant)",
  q5: "What's your relationship with authority? (prefer-leading / collaborative-peer / prefer-following)",
  q6: "What motivates you most? (compensation / recognition / growth / purpose / stability)",
  q7: "Where do you want to be in 5 years?",
  q8: "What subjects or domains excite you?",
  q9: "What are your top 3 strengths?",
  q10: "What skills do you most want to develop?",
  q11: "What's holding you back from your goals?",
  q12: "What does career success look like for you?",
};

// POST: Generate AI career profile summary from assessment responses.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const { data: profile, error: profileError } = await db
    .schema("career")
    .from("career_profile")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[career/profile/analyze POST] fetch error:", profileError.message);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Career profile not found" }, { status: 404 });
  }

  const responses: Record<string, string> = profile.assessment_responses ?? {};

  // Format the assessment responses into readable lines
  const formattedResponses = Object.entries(QUESTION_LABELS)
    .map(([key, label]) => {
      const value = responses[key];
      return `${label}\nAnswer: ${value ?? "(not answered)"}`;
    })
    .join("\n\n");

  const backgroundLines = [
    profile.current_title && `Current Title: ${profile.current_title}`,
    profile.current_company && `Current Company: ${profile.current_company}`,
    profile.years_experience != null && `Years of Experience: ${profile.years_experience}`,
    profile.industry && `Industry: ${profile.industry}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Please analyze the following career interest assessment and professional background.

## Professional Background
${backgroundLines || "(No background info provided)"}

## Assessment Responses
${formattedResponses}

Return ONLY valid JSON (no markdown fences) in this exact shape:
{
  "summary": ["paragraph1", "paragraph2", "paragraph3"],
  "strengths": ["strength1", "strength2", "strength3", "strength4", "strength5"],
  "growth_areas": ["area1", "area2", "area3"],
  "career_themes": ["theme1", "theme2", "theme3"],
  "suggested_directions": [
    {
      "title": "Role or path title",
      "description": "1-2 sentence description",
      "horizon": "short|medium|long"
    }
  ]
}

Rules:
- summary: an array of 3-4 strings, one per paragraph, synthesizing their profile, motivations, and career identity
- strengths: 5-7 specific strengths inferred from their responses and background
- growth_areas: 3-5 development areas they've identified or that would support their goals
- career_themes: 3-5 overarching themes that characterize their career trajectory
- suggested_directions: 2-4 concrete career paths or roles that align with their profile
- horizon values: short (0-6mo), medium (6-24mo), long (2yr+)
- Do not include any text outside the JSON object`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system:
        "You are an insightful career development coach. Analyze this career interest assessment and professional background to create a personalized career profile.",
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Strip markdown fences if present
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("[career/profile/analyze POST] JSON parse error:", rawText);
      return NextResponse.json(
        { error: "AI returned invalid JSON" },
        { status: 500 }
      );
    }

    // Save the summary back to career_profile
    const { error: saveError } = await db
      .schema("career")
      .from("career_profile")
      .update({
        career_profile_summary: analysis.summary ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (saveError) {
      console.error("[career/profile/analyze POST] save error:", saveError.message);
      // Non-fatal — still return the analysis
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[career/profile/analyze POST] AI error:", error);
    return NextResponse.json(
      { error: "Failed to generate career profile analysis" },
      { status: 500 }
    );
  }
}
