"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRecordDocument, getRecordFileUrl } from "../actions";

/**
 * View-original and delete for a saved report. Both are client-side because
 * the signed storage URL is minted on demand (it expires in five minutes,
 * so it can't be baked into the server-rendered page) and deletion needs a
 * confirmation step.
 */
export default function DocumentActions({
  documentId,
  title,
  hasFile,
  fileName,
}: {
  documentId: string;
  title: string;
  hasFile: boolean;
  fileName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openOriginal() {
    setBusy(true);
    setError(null);
    const { url, error: urlError } = await getRecordFileUrl(documentId);
    setBusy(false);
    if (urlError || !url) {
      setError(urlError ?? "Could not open that file.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const { error: delError } = await deleteRecordDocument(documentId);
    if (delError) {
      setError(delError);
      setBusy(false);
      return;
    }
    router.push("/health/records");
    router.refresh();
  }

  return (
    <div style={{ padding: "22px 16px 0", display: "grid", gap: 10 }}>
      {hasFile && (
        <button
          type="button"
          onClick={openOriginal}
          disabled={busy}
          className="ios-list"
          style={{ margin: 0, padding: "13px 16px", border: "none", color: "var(--ios-tint)", fontWeight: 600, fontSize: 16, textAlign: "left" }}
        >
          {busy ? "Opening…" : `View original${fileName ? ` (${fileName})` : ""}`}
        </button>
      )}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="ios-list"
          style={{ margin: 0, padding: "13px 16px", border: "none", color: "var(--ios-red)", fontWeight: 600, fontSize: 16, textAlign: "left" }}
        >
          Delete this record
        </button>
      ) : (
        <div className="ios-list" style={{ margin: 0, padding: 16 }}>
          <div className="ios-subhead" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Delete <strong>{title}</strong>? Its results, scan values and the stored original are
            removed permanently.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              style={{ padding: "10px 16px", borderRadius: 10, background: "var(--ios-red)", color: "#fff", fontWeight: 600, fontSize: 15, border: "none" }}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              style={{ padding: "10px 16px", borderRadius: 10, background: "var(--ios-fill, rgba(120,120,128,0.12))", color: "var(--ios-label)", fontWeight: 600, fontSize: 15, border: "none" }}
            >
              Keep
            </button>
          </div>
        </div>
      )}

      {error && (
        <span className="ios-footnote" style={{ color: "var(--ios-red)", padding: "0 4px" }}>{error}</span>
      )}
    </div>
  );
}
