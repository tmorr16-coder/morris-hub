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
    <div style={{ maxWidth: 560 }}>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--color-bronze)" : "var(--color-rule)"}`,
          borderRadius: 14,
          padding: "40px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "rgba(139,106,71,0.04)" : "var(--color-paper-card)",
          transition: "all 150ms",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-ink)", marginBottom: 6 }}>
          {file ? file.name : "Drop your statement here"}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
          {file
            ? `${(file.size / 1024).toFixed(0)} KB — click Upload to import`
            : "or click to browse — PDF, CSV, or TXT, up to 10 MB"}
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
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            style={{
              flex: 1, padding: "12px", borderRadius: 10, border: "none",
              background: isPending ? "var(--color-paper-deep)" : "var(--color-bronze)",
              color: isPending ? "var(--color-ink-3)" : "#fff",
              fontSize: 14, fontWeight: 600, cursor: isPending ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {isPending ? "Extracting with Claude…" : "Upload & Extract"}
          </button>
          <button
            onClick={() => { setFile(null); setError(null); }}
            style={{
              padding: "12px 16px", borderRadius: 10, border: "1px solid var(--color-rule)",
              background: "transparent", color: "var(--color-ink-3)", fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Clear
          </button>
        </div>
      )}

      {isPending && (
        <div style={{ fontSize: 12, color: "var(--color-ink-3)", padding: "8px 0" }}>
          Sending to Claude for extraction — PDFs may take 10-15 seconds…
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(154,59,42,0.08)", border: "1px solid var(--color-red)", borderRadius: 8, fontSize: 13, color: "var(--color-red)", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ padding: "10px 14px", background: "rgba(77,107,58,0.08)", border: "1px solid var(--color-green)", borderRadius: 8, fontSize: 13, color: "var(--color-green)" }}>
          ✓ Statement imported — scroll down to see the extracted account.
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--color-ink-4)", lineHeight: 1.6, marginTop: 12 }}>
        <strong style={{ color: "var(--color-ink-3)" }}>Privacy:</strong> Your file is sent directly to Anthropic for extraction and is not stored on our servers. Only the extracted data (balance, fund names, allocation %) is saved.
      </div>
    </div>
  );
}
