import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL_FAST } from "@/lib/models";
import { CONTEXT_RULE, withAppContext } from "@/lib/ai/context";

const anthropic = new Anthropic();

// POST: cert-specific AI chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { messages, examContext } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Fetch exam info scoped to user
  const { data: exam } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("name, exam_code")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!exam) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch domains for context
  const { data: domains } = await db
    .schema("student_support")
    .from("cert_domains")
    .select("name")
    .eq("exam_id", id)
    .order("created_at", { ascending: true });

  const examLabel = `${exam.name}${exam.exam_code ? ` (${exam.exam_code})` : ""}`;

  const domainLines =
    domains && domains.length > 0
      ? `\n\nExam domains covered:\n${(domains as Array<{ name: string }>)
          .map((d) => `- ${d.name}`)
          .join("\n")}`
      : "";

  const extraContext = typeof examContext === "string" && examContext.trim() ? `\n\nAdditional context: ${examContext}` : "";

  // Fixed instructions only. The exam, its domains and anything the screen
  // sends are data in the conversation — see lib/ai/context.ts.
  const systemPrompt = `You are an expert certification exam instructor. The exam the user is preparing for, and its domains, are given in the app context. Help the user understand concepts, practice questions, and prepare effectively.

Be clear, practical, and encouraging. When explaining technical concepts, use concrete examples. If the user shares a question they got wrong, help them understand the reasoning, not just the answer.

${CONTEXT_RULE}`;
  const examData = `Exam: ${examLabel}${domainLines}${extraContext}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 1024,
      system: systemPrompt,
      messages: withAppContext(
        messages
          .filter((m: { role?: unknown; content?: unknown }) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-20)
          .map((m: { role: "user" | "assistant"; content: string }) => ({ role: m.role, content: m.content.slice(0, 8000) })),
        examData,
      ),
    });

    const reply = response.content.find((b) => b.type === "text")?.text ?? "";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[certifications/chat POST] Claude error:", err);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
