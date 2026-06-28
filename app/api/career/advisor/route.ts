import { Anthropic } from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export interface SuggestionItem {
  type: "goal" | "learning" | "experience" | "relationship";
  title: string;
  description: string;
  horizon?: "short" | "medium" | "long";
}

const SYSTEM_INSTRUCTIONS =
  "You are an expert career advisor and development coach with deep expertise in career planning, skill development, and professional growth strategies. You give specific, actionable, personalized advice.";

// POST: AI career advisor chat endpoint.
// Body: { messages: [{role, content}][], includeContext?: boolean }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { messages, includeContext = true } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Fetch context data in parallel
  const [profileResult, goalsResult, experiencesResult, learningResult] =
    await Promise.all([
      db
        .schema("career")
        .from("career_profile")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      db
        .schema("career")
        .from("career_goals")
        .select("title, horizon, status, progress_pct")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .schema("career")
        .from("career_experiences")
        .select("id")
        .eq("user_id", user.id)
        .gte(
          "experience_date",
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        ),
      db
        .schema("career")
        .from("career_learning")
        .select("title")
        .eq("user_id", user.id)
        .eq("status", "in_progress"),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile: any = profileResult.data ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goals: any[] = goalsResult.data ?? [];
  const experiencesCount: number = (experiencesResult.data ?? []).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const learningInProgress: any[] = learningResult.data ?? [];

  // Build context block
  let contextBlock = "";
  if (includeContext && profile) {
    const backgroundLines = [
      profile.current_title &&
        `Title: ${profile.current_title}${profile.current_company ? ` at ${profile.current_company}` : ""}`,
      profile.years_experience != null &&
        `Experience: ${profile.years_experience} years${profile.industry ? ` in ${profile.industry}` : ""}`,
    ]
      .filter(Boolean)
      .join("\n");

    const resumeExcerpt = profile.resume_text
      ? profile.resume_text.slice(0, 2000)
      : null;

    const goalsBlock =
      goals.length > 0
        ? goals
            .map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (g: any) =>
                `- ${g.title} (horizon: ${g.horizon ?? "medium"}, progress: ${g.progress_pct ?? 0}%)`
            )
            .join("\n")
        : "No active goals set.";

    const learningBlock =
      learningInProgress.length > 0
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? learningInProgress.map((l: any) => `- ${l.title}`).join("\n")
        : "None in progress.";

    contextBlock = `
# Career Profile

## Current Background
${backgroundLines || "(No background info provided)"}
${resumeExcerpt ? `\n### Resume (excerpt)\n${resumeExcerpt}` : ""}
${profile.linkedin_bio ? `\n### LinkedIn Bio\n${profile.linkedin_bio}` : ""}

## Career Profile Summary
${profile.career_profile_summary || "(Assessment not yet completed)"}

## Strengths & Interests
Career interests: ${profile.career_interests?.length ? profile.career_interests.join(", ") : "(not set)"}
Target roles: ${profile.target_roles?.length ? profile.target_roles.join(", ") : "(not set)"}

## Current Goals
${goalsBlock}

## Recent Activity (70/20/10)
Experiences logged (90 days): ${experiencesCount}
Learning in progress:
${learningBlock}
`.trim();
  }

  const systemPrompt = contextBlock
    ? `${SYSTEM_INSTRUCTIONS}\n\n${contextBlock}`
    : SYSTEM_INSTRUCTIONS;

  // Store the last user message for caching
  const lastUserMessage = [...messages].reverse().find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => m.role === "user"
  );

  try {
    // Primary response
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const replyText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Second call: extract structured suggestions
    let suggestions: SuggestionItem[] = [];
    try {
      const suggestionResponse = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `From this career advice response, extract any concrete action items that could be added to a career development plan. Return JSON: { "suggestions": [{ "type": "goal"|"learning"|"experience"|"relationship", "title": string, "description": string, "horizon": "short"|"medium"|"long" }] } Return { "suggestions": [] } if no concrete suggestions.\n\nCareer advice response:\n${replyText}`,
          },
        ],
      });

      const rawSuggestions =
        suggestionResponse.content[0].type === "text"
          ? suggestionResponse.content[0].text
          : "";

      const cleanedSuggestions = rawSuggestions
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      const parsed = JSON.parse(cleanedSuggestions);
      suggestions = parsed.suggestions ?? [];
    } catch {
      // Non-fatal — suggestions extraction failure is acceptable
      suggestions = [];
    }

    // Cache in career_advisor_messages (fire-and-forget errors are logged only)
    const messagesToSave = [];
    if (lastUserMessage) {
      messagesToSave.push({
        user_id: user.id,
        role: "user",
        content: lastUserMessage.content,
        suggestions: null,
      });
    }
    messagesToSave.push({
      user_id: user.id,
      role: "assistant",
      content: replyText,
      suggestions: suggestions.length > 0 ? suggestions : null,
    });

    db.schema("career")
      .from("career_advisor_messages")
      .insert(messagesToSave)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          console.error("[career/advisor POST] cache error:", error.message);
        }
      });

    return NextResponse.json({ reply: replyText, suggestions });
  } catch (error) {
    console.error("[career/advisor POST] AI error:", error);
    return NextResponse.json(
      { error: "Failed to generate career advice" },
      { status: 500 }
    );
  }
}
