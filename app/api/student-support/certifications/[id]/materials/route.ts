import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const materialId = request.nextUrl.searchParams.get("materialId");
  if (!materialId) return NextResponse.json({ error: "materialId required" }, { status: 400 });

  const db = createServiceClient() as any;
  // Verify ownership via exam
  const { data: mat } = await db.schema("student_support").from("cert_materials")
    .select("id, exam_id").eq("id", materialId).maybeSingle();
  if (!mat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: exam } = await db.schema("student_support").from("cert_exams")
    .select("id").eq("id", mat.exam_id).eq("user_id", user.id).maybeSingle();
  if (!exam || exam.id !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await db.schema("student_support").from("cert_materials").delete().eq("id", materialId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// GET: list materials for exam
export async function GET(
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Verify exam ownership
  const { data: exam } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!exam) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await db
    .schema("student_support")
    .from("cert_materials")
    .select("*")
    .eq("exam_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

// POST: add material (type: url|text, title, url, extracted_text optional)
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
  const { type, title, url, extracted_text } = body;

  if (!type || !title) {
    return NextResponse.json({ error: "type and title are required" }, { status: 400 });
  }

  if (!["url", "text"].includes(type)) {
    return NextResponse.json({ error: "type must be 'url' or 'text'" }, { status: 400 });
  }

  if (type === "url" && !url) {
    return NextResponse.json({ error: "url is required for type 'url'" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  // Verify exam ownership
  const { data: exam } = await db
    .schema("student_support")
    .from("cert_exams")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!exam) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // For URL type: attempt lazy text extraction
  let resolvedExtractedText = extracted_text ?? null;
  let extractionNote: string | null = null;

  if (type === "url" && url && !resolvedExtractedText) {
    const urlLower = (url as string).toLowerCase();

    if (urlLower.endsWith(".pdf")) {
      // PDF extraction requires server-side processing (e.g. pdf-parse or external service)
      // Store the URL; extraction is deferred
      extractionNote = "PDF detected — text extraction requires server-side processing. Content will be indexed on next extraction pass.";
    } else {
      // Attempt to fetch plain HTML and strip tags for basic text extraction
      try {
        const fetchRes = await fetch(url as string, {
          headers: { "User-Agent": "MorrisHub/1.0 (study material indexer)" },
          signal: AbortSignal.timeout(8000),
        });

        if (fetchRes.ok) {
          const html = await fetchRes.text();
          // Strip HTML tags for a rough text extraction
          const stripped = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();

          // Truncate to a reasonable size for storage
          resolvedExtractedText = stripped.length > 20000
            ? stripped.slice(0, 20000) + "\n[truncated]"
            : stripped;
        }
      } catch (fetchErr) {
        console.warn("[certifications/materials POST] URL fetch failed:", fetchErr);
        extractionNote = "URL could not be fetched at creation time. Extraction will be retried later.";
      }
    }
  }

  const { data: material, error: insertErr } = await db
    .schema("student_support")
    .from("cert_materials")
    .insert([
      {
        exam_id: id,
        type,
        title,
        url: url ?? null,
        extracted_text: resolvedExtractedText,
      },
    ])
    .select()
    .single();

  if (insertErr) {
    console.error("[certifications/materials POST] insert error:", insertErr.message);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json(
    { ...material, extractionNote },
    { status: 201 }
  );
}
