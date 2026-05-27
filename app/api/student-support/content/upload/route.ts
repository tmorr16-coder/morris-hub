import { createClient, createServiceClient } from "@/lib/supabase/server";
import { extractTextFromFile } from "@/lib/file-extraction";
import { NextRequest, NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const courseId = formData.get("courseId") as string;
    const type = formData.get("type") as string;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    // Validate required fields
    if (!file || !courseId || !type || !title) {
      return NextResponse.json(
        { error: "Missing required fields: file, courseId, type, title" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not supported. Allowed: PDF, DOCX, TXT" },
        { status: 400 }
      );
    }

    // Verify course ownership
    const { data: course } = await service
      .schema("student_support")
      .from("courses")
      .select("user_id")
      .eq("id", courseId)
      .maybeSingle();

    if (!course || course.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from file
    const extractedText = await extractTextFromFile(buffer, file.type);

    // Generate storage path: user_id/course_id/timestamp_filename
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/${courseId}/${timestamp}_${safeFileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await service.storage
      .from("student-support-content")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    // Save to course_content table
    const { data: contentData, error: dbError } = await service
      .schema("student_support")
      .from("course_content")
      .insert([
        {
          course_id: courseId,
          type,
          title,
          description: description || null,
          file_path: filePath,
          extracted_text: extractedText,
          is_uploaded: true,
          file_size_kb: Math.ceil(buffer.length / 1024),
        },
      ])
      .select();

    if (dbError) {
      // Clean up uploaded file if DB insert fails
      await service.storage
        .from("student-support-content")
        .remove([filePath])
        .catch(() => {
          /* Ignore cleanup errors */
        });

      console.error("Database insert error:", dbError);
      return NextResponse.json(
        { error: "Failed to save file metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json(contentData[0], { status: 201 });
  } catch (err) {
    console.error("File upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "File upload failed" },
      { status: 500 }
    );
  }
}
