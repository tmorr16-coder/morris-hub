"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function PlanUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/bible/plans/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setSuccess(`"${data.title}" imported — ${data.daysExtracted} days extracted.`);
      setTimeout(() => {
        setSuccess(null);
        router.push(`/bible/plans/${data.planId}`);
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Upload an existing reading plan (PDF, image, or text file)"
        style={{
          padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
          border: "1px solid var(--color-rule)",
          background: uploading ? "var(--color-bg-deep)" : "var(--color-bg-card)",
          color: "var(--color-ink-2)", cursor: uploading ? "default" : "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        {uploading ? (
          <>
            <span style={{ fontSize: 11, animation: "spin 1s linear infinite", display: "inline-block" }}>↻</span>
            Extracting…
          </>
        ) : (
          <>📄 Upload plan</>
        )}
      </button>

      {/* Feedback toasts */}
      {(error || success) && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          padding: "10px 14px", borderRadius: 10, fontSize: 13, zIndex: 50,
          maxWidth: 280, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          background: error ? "rgba(154,59,42,0.95)" : "rgba(74,107,58,0.95)",
          color: "#fff", lineHeight: 1.4,
        }}>
          {error ?? success}
          {error && (
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: 8, background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 12 }}
            >✕</button>
          )}
        </div>
      )}

      {uploading && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          padding: "10px 14px", borderRadius: 10, fontSize: 12, zIndex: 50,
          background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
          boxShadow: "var(--shadow-float)", color: "var(--color-ink-3)", maxWidth: 240,
        }}>
          Claude is reading your plan and extracting the schedule in batches. A 365-day plan takes ~60–90 seconds — please wait.
        </div>
      )}
    </div>
  );
}
