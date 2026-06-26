import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// pdf-parse does not have ESM exports; use require
const pdfParse = require("pdf-parse");

// POST: Accept a PDF file upload, extract text using pdf-parse, return the extracted text.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Failed to parse form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: "No file provided. Send a PDF as form field 'file'." },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF files are accepted." },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await pdfParse(buffer);
    const text: string = result.text ?? "";

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[career/profile/upload-resume POST] pdf-parse error:", error);
    return NextResponse.json(
      { error: "Failed to extract text from PDF" },
      { status: 500 }
    );
  }
}
