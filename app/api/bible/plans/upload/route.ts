import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

type Day = { day: number; readings: string[] };

async function extractBatch(
  content: Anthropic.MessageParam["content"],
  startDay: number,
  endDay: number
): Promise<Day[]> {
  const batchPrompt = `Extract ONLY days ${startDay} through ${endDay} from this reading plan.

Return ONLY a compact JSON array (no spaces/newlines inside values):
[{"day":${startDay},"readings":["Book Chapter"]},{"day":${startDay + 1},"readings":["Book Chapter","Book Chapter"]}]

Rules:
- Exactly one object per day, numbered ${startDay} to ${endDay}
- Each reading in "Book Chapter" format (e.g. "John 3", "Psalms 23-25", "Genesis 1-2")
- If a day doesn't exist in the plan, skip it
- Return ONLY the JSON array, nothing else`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        ...(Array.isArray(content) ? content : [content]),
        { type: "text", text: batchPrompt },
      ] as Anthropic.ContentBlockParam[],
    },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages,
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]) as Day[];
  } catch {
    return [];
  }
}

async function extractMeta(
  content: Anthropic.ContentBlockParam[]
): Promise<{ title: string; description: string; duration_days: number }> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          ...content,
          {
            type: "text",
            text: `What is the title, a one-sentence description, and total number of days in this reading plan?
Return ONLY JSON: {"title":"...","description":"...","duration_days":365}`,
          },
        ] as Anthropic.ContentBlockParam[],
      },
    ],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { title: "Uploaded Plan", description: "", duration_days: 365 };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { title: "Uploaded Plan", description: "", duration_days: 365 };
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const fileType = file.type;

  // Build document content block (reused across all batch calls)
  let docContent: Anthropic.ContentBlockParam[];

  if (fileType === "application/pdf") {
    docContent = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      } as Anthropic.ContentBlockParam,
    ];
  } else if (fileType.startsWith("image/")) {
    docContent = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: fileType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: base64,
        },
      } as Anthropic.ContentBlockParam,
    ];
  } else {
    const text = Buffer.from(bytes).toString("utf-8");
    docContent = [{ type: "text", text: `READING PLAN:\n${text}` }];
  }

  try {
    // Step 1: Extract metadata (fast — 1 call)
    const meta = await extractMeta(docContent);
    const totalDays = Math.max(meta.duration_days ?? 365, 1);

    // Step 2: Extract readings in batches of 60 days
    const BATCH_SIZE = 60;
    const batches = Math.ceil(totalDays / BATCH_SIZE);
    const allDays: Day[] = [];

    for (let b = 0; b < batches; b++) {
      const start = b * BATCH_SIZE + 1;
      const end = Math.min((b + 1) * BATCH_SIZE, totalDays);
      const days = await extractBatch(docContent, start, end);
      allDays.push(...days);
      // Small pause to avoid rate limits
      if (b < batches - 1) await new Promise((r) => setTimeout(r, 500));
    }

    // Step 3: Save to database — service client required for bible schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any;
    const { data: plan, error: dbErr } = await db
      .schema("bible")
      .from("reading_plans")
      .insert({
        user_id: user.id,
        title: meta.title ?? "Uploaded Reading Plan",
        description: meta.description ?? null,
        is_ai_generated: false,
        is_public: false,
        duration_days: allDays.length || totalDays,
        readings: allDays,
      })
      .select("id")
      .single();

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    // Auto-enroll
    await db.schema("bible").from("user_plans").upsert(
      { user_id: user.id, plan_id: plan.id },
      { onConflict: "user_id,plan_id" }
    );

    return NextResponse.json({
      planId: plan.id,
      title: meta.title,
      durationDays: totalDays,
      daysExtracted: allDays.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to process plan: ${err instanceof Error ? err.message : err}` },
      { status: 500 }
    );
  }
}
