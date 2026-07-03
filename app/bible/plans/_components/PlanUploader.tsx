"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden style={{ animation: "plan-uploader-spin 0.8s linear infinite" }}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

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
      <style>{`@keyframes plan-uploader-spin { to { transform: rotate(360deg); } }`}</style>
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
        className="ios-btn ios-btn--plain"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: 0 }}
      >
        {uploading ? (
          <>
            <Spinner />
            Extracting…
          </>
        ) : (
          <>
            <UploadIcon />
            Upload plan
          </>
        )}
      </button>

      {/* Feedback toasts */}
      {(error || success) && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          padding: "12px 14px", borderRadius: "var(--ios-radius-card)", fontSize: 13, zIndex: 50,
          maxWidth: 280, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          background: error ? "var(--ios-red)" : "var(--ios-green)",
          color: "var(--ios-on-tint)", lineHeight: 1.4,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ flex: 1 }}>{error ?? success}</span>
          {error && (
            <button
              onClick={() => setError(null)}
              aria-label="Dismiss"
              style={{ background: "none", border: "none", color: "var(--ios-on-tint)", cursor: "pointer", padding: 0, lineHeight: 1 }}
            >
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {uploading && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          padding: "12px 14px", borderRadius: "var(--ios-radius-card)", fontSize: 12, zIndex: 50,
          background: "var(--ios-bg-elevated)", border: "1px solid var(--ios-separator)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", color: "var(--ios-label-2)", maxWidth: 240,
        }}>
          Reading your plan and extracting the schedule in batches. A 365-day plan takes ~60–90 seconds — please wait.
        </div>
      )}
    </div>
  );
}
