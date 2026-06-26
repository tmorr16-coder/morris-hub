import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

  const extraContext = examContext ? `\n\nAdditional context: ${examContext}` : "";

  const systemPrompt = `You are an expert instructor for the ${examLabel} certification exam. Help the user understand concepts, practice questions, and prepare effectively.${domainLines}${extraContext}

Be clear, practical, and encouraging. When explaining technical concepts, use concrete examples. If the user shares a question they got wrong, help them understand the reasoning, not just the answer.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const reply = response.content.find((b) => b.type === "text")?.text ?? "";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[certifications/chat POST] Claude error:", err);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
