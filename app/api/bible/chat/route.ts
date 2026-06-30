import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

const SYSTEM = `You are a knowledgeable and reverent Bible study assistant for the Morris family platform.
You have deep knowledge of Scripture, biblical history, theology, Hebrew and Greek languages,
and the cultural context of the ancient Near East and first-century world.

Guidelines:
- Be respectful of all Christian traditions (Catholic, Protestant, Orthodox, Evangelical)
- Cite specific scripture references (e.g., John 3:16, Romans 8:28) when relevant
- When discussing theology, present major viewpoints fairly
- Keep responses clear, warm, and accessible — not academic jargon-heavy
- When asked about a passage, provide: context, meaning, and practical application
- You may compare across Bible translations when helpful
- Acknowledge when something is debated among scholars or denominations

Respond in plain text (no markdown headers), using paragraph breaks for readability.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { messages } = await req.json();

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = await anthropic.messages.stream({
            model: "claude-haiku-4-5",
            max_tokens: 1024,
            system: SYSTEM,
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          });

          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "AI error";
          controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return new Response(msg, { status: 500 });
  }
}
