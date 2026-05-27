import { Anthropic } from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { message, courseContext } = body;

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const systemPrompt = courseContext
    ? `You are a research assistant helping a student with their coursework.

Course Context:
${courseContext}

Help the student understand concepts, research topics, and prepare for their studies. Be educational, clear, and encourage deeper understanding.`
    : `You are a research assistant helping a student with their studies. Help them understand concepts, research topics, and prepare for exams. Be educational, clear, and encourage deeper understanding.`;

  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: message,
      },
    ],
  });

  const assistantMessage =
    response.content[0].type === "text" ? response.content[0].text : "Unable to generate response";

  return NextResponse.json({
    message: assistantMessage,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  });
}
