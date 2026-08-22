import { Anthropic } from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { MODEL_DEEP } from "@/lib/models";

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
  const { message, courseId, sessionId } = body;

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const service = createServiceClient() as any;

  try {
    // Fetch all courses + all content for this user in parallel with session management
    const [allCoursesResult, sessionResult] = await Promise.all([
      service
        .schema("student_support")
        .from("courses")
        .select("id, name, description, instructor, semester")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      sessionId
        ? service
            .schema("student_support")
            .from("research_chat_sessions")
            .select("id, user_id")
            .eq("id", sessionId)
            .maybeSingle()
        : service
            .schema("student_support")
            .from("research_chat_sessions")
            .insert({ user_id: user.id, course_id: courseId })
            .select("id")
            .single(),
    ]);

    const allCourses: Array<{ id: string; name: string; description: string | null; instructor: string | null; semester: string | null }> =
      allCoursesResult.data ?? [];

    if (sessionId) {
      // Verify the client-supplied session belongs to the caller (service client bypasses RLS)
      if (!sessionResult.data) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      if (sessionResult.data.user_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (sessionResult.error) {
      console.error("Session creation error:", sessionResult.error);
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    const currentSessionId: string = sessionResult.data?.id ?? sessionId;

    // Fetch all course content (including extracted text from uploads) across all courses
    const courseIds = allCourses.map((c) => c.id);
    const [messagesResult, allContentResult] = await Promise.all([
      service
        .schema("student_support")
        .from("research_chat_messages")
        .select("role, content")
        .eq("session_id", currentSessionId)
        .order("created_at", { ascending: true }),
      courseIds.length > 0
        ? service
            .schema("student_support")
            .from("course_content")
            .select("course_id, type, title, description, content_url, extracted_text, is_uploaded")
            .in("course_id", courseIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    if (messagesResult.error) {
      console.error("Messages fetch error:", messagesResult.error);
      return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
    }

    const messages = messagesResult.data ?? [];
    const allContent: Array<{
      course_id: string;
      type: string;
      title: string;
      description: string | null;
      content_url: string | null;
      extracted_text: string | null;
      is_uploaded: boolean;
    }> = allContentResult.data ?? [];

    // Build rich system prompt using all courses and their content
    const activeCourse = allCourses.find((c) => c.id === courseId);

    const courseBlocks = allCourses
      .map((course) => {
        const isActive = course.id === courseId;
        const courseContent = allContent.filter((c) => c.course_id === course.id);

        let block = `### ${isActive ? "★ " : ""}${course.name}${course.semester ? ` (${course.semester})` : ""}${isActive ? " ← CURRENT COURSE" : ""}`;
        if (course.instructor) block += `\nInstructor: ${course.instructor}`;
        if (course.description) block += `\nDescription: ${course.description}`;

        if (courseContent.length > 0) {
          block += `\n\nCourse Materials (${courseContent.length} item${courseContent.length !== 1 ? "s" : ""}):`;
          for (const item of courseContent) {
            block += `\n\n  [${item.type.toUpperCase()}] ${item.title}`;
            if (item.description) block += `\n  ${item.description}`;
            if (item.content_url) block += `\n  URL: ${item.content_url}`;
            if (item.extracted_text) {
              // Include up to 3000 chars of extracted text per item
              const excerpt = item.extracted_text.length > 3000
                ? item.extracted_text.slice(0, 3000) + "\n  [... content continues ...]"
                : item.extracted_text;
              block += `\n\n  Full Content:\n  ${excerpt.replace(/\n/g, "\n  ")}`;
            }
          }
        } else {
          block += "\n  (No uploaded materials yet)";
        }

        return block;
      })
      .join("\n\n---\n\n");

    const systemPrompt = `You are a research assistant helping a student with their coursework. You have access to all of their course materials across every course.

${activeCourse ? `The student is currently viewing: **${activeCourse.name}**` : ""}

## All Course Materials

${courseBlocks}

## Instructions
- Draw on any of the above course materials when relevant to the student's question
- If content from another course is relevant, mention which course it's from
- Help the student understand concepts, make connections across courses, and prepare for their studies
- Be educational, clear, and encourage deeper understanding`;

    // Prepare messages for Claude API (include history + new message)
    const conversationMessages: ChatMessage[] = [
      ...messages.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    // Call Claude API with full conversation history
    const response = await client.messages.create({
      model: MODEL_DEEP,
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const assistantMessage =
      response.content[0].type === "text" ? response.content[0].text : "Unable to generate response";

    // Save user + assistant messages and update session timestamp
    await Promise.all([
      service
        .schema("student_support")
        .from("research_chat_messages")
        .insert({ session_id: currentSessionId, role: "user", content: message }),
      service
        .schema("student_support")
        .from("research_chat_messages")
        .insert({ session_id: currentSessionId, role: "assistant", content: assistantMessage }),
      service
        .schema("student_support")
        .from("research_chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentSessionId),
    ]);

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

    // Verify the session belongs to the caller (service client bypasses RLS)
    const { data: ownerCheck } = await service
      .schema("student_support")
      .from("research_chat_sessions")
      .select("user_id")
      .eq("id", currentSessionId)
      .maybeSingle();

    if (!ownerCheck) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (ownerCheck.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
