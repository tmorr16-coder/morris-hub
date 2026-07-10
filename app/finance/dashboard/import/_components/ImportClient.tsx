"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importStatement } from "../actions";

export default function ImportClient({ userId }: { userId: string }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // suppress userId lint warning — available for future use
  void userId;

  function handleFile(f: File) {
    setFile(f);
    setError(null);
    setSuccess(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleSubmit() {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await importStatement(fd);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setFile(null);
        router.refresh();
      }
    });
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--ios-tint)" : "var(--ios-separator)"}`,
          borderRadius: 14,
          padding: "36px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "var(--ios-fill)" : "transparent",
          transition: "border-color 150ms, background 150ms",
        }}
      >
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden
          style={{ width: 34, height: 34, color: dragging ? "var(--ios-tint)" : "var(--ios-label-3)", marginBottom: 12 }}
        >
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <path d="M14 3v5h5M9 13h6M9 17h6" />
        </svg>
        <div className="ios-callout" style={{ fontWeight: 500, color: "var(--ios-label)", marginBottom: 4 }}>
          {file ? file.name : "Drop your statement here"}
        </div>
        <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>
          {file
            ? `${(file.size / 1024).toFixed(0)} KB — tap Upload to import`
            : "or tap to browse — PDF, CSV, or TXT, up to 10 MB"}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,.txt"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {file && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="ios-btn ios-btn--primary"
            style={{ opacity: isPending ? 0.5 : 1 }}
          >
            {isPending ? "Extracting…" : "Upload & Extract"}
          </button>
          <button
            onClick={() => { setFile(null); setError(null); }}
            className="ios-btn--plain ios-btn--full"
          >
            Clear
          </button>
        </div>
      )}

      {isPending && (
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "12px 0 0" }}>
          Extracting from document — PDFs may take 10–15 seconds…
        </p>
      )}

      {error && (
        <p className="ios-subhead" style={{ color: "var(--ios-red)", padding: "12px 0 0" }}>
          {error}
        </p>
      )}

      {success && (
        <p className="ios-subhead" style={{ color: "var(--ios-green)", padding: "12px 0 0", display: "flex", alignItems: "center", gap: 6 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 16, height: 16 }}>
            <path d="M5 12.5 10 17.5 19 6.5" />
          </svg>
          Statement imported — scroll down to see the extracted account.
        </p>
      )}

      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.6, marginTop: 16 }}>
        <strong style={{ color: "var(--ios-label)" }}>Privacy:</strong> Your file is sent directly to Anthropic for extraction and is not stored on our servers. Only the extracted data (balance, fund names, allocation %) is saved.
      </p>
    </div>
  );
}
