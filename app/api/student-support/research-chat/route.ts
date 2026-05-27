import { Anthropic } from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { message, courseId, courseContext, sessionId } = body;

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const service = createServiceClient() as any;

  try {
    // Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await service
        .schema("student_support")
        .from("research_chat_sessions")
        .insert({ user_id: user.id, course_id: courseId })
        .select("id")
        .single();

      if (sessionError) {
        console.error("Session creation error:", sessionError);
        return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
      }
      currentSessionId = newSession.id;
    }

    // Fetch conversation history
    const { data: messages, error: messagesError } = await service
      .schema("student_support")
      .from("research_chat_messages")
      .select("*")
      .eq("session_id", currentSessionId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Messages fetch error:", messagesError);
      return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
    }

    // Build system prompt with course context
    const systemPrompt = courseContext
      ? `You are a research assistant helping a student with their coursework.

Course Context:
${courseContext}

Help the student understand concepts, research topics, and prepare for their studies. Be educational, clear, and encourage deeper understanding.`
      : `You are a research assistant helping a student with their studies. Help them understand concepts, research topics, and prepare for exams. Be educational, clear, and encourage deeper understanding.`;

    // Prepare messages for Claude API (include history + new message)
    const conversationMessages: ChatMessage[] = [
      ...(messages || []).map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    // Call Claude API with full conversation history
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const assistantMessage =
      response.content[0].type === "text" ? response.content[0].text : "Unable to generate response";

    // Save user message
    await service
      .schema("student_support")
      .from("research_chat_messages")
      .insert({
        session_id: currentSessionId,
        role: "user",
        content: message,
      });

    // Save assistant message
    await service
      .schema("student_support")
      .from("research_chat_messages")
      .insert({
        session_id: currentSessionId,
        role: "assistant",
        content: assistantMessage,
      });

    // Update session updated_at
    await service
      .schema("student_support")
      .from("research_chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", currentSessionId);

    return NextResponse.json({
      sessionId: currentSessionId,
      message: assistantMessage,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("Research chat error:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const courseId = searchParams.get("courseId");

  const service = createServiceClient() as any;

  try {
    // If courseId provided, get or create latest session for that course
    let currentSessionId = sessionId;
    if (!currentSessionId && courseId) {
      const { data: session, error: sessionError } = await service
        .schema("student_support")
        .from("research_chat_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (session) {
        currentSessionId = session.id;
      } else if (sessionError?.code === "PGRST116") {
        // No session found, this is OK - just return empty
        return NextResponse.json({ sessionId: null, messages: [] });
      }
    }

    if (!currentSessionId) {
      return NextResponse.json({ error: "sessionId or courseId is required" }, { status: 400 });
    }

    // Fetch messages for session
    const { data: messages, error: messagesError } = await service
      .schema("student_support")
      .from("research_chat_messages")
      .select("*")
      .eq("session_id", currentSessionId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Messages fetch error:", messagesError);
      return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: currentSessionId,
      messages: messages || [],
    });
  } catch (error) {
    console.error("Research chat fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}
