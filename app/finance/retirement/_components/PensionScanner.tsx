"use client";

import { useRef, useState } from "react";
import type { PensionExtractResult, PensionOption } from "@/app/api/finance/retirement/pension-extract/route";

interface Props {
  spouseEnabled: boolean;
  spouseName: string | null;
  onSelect: (option: PensionOption, owner: "self" | "spouse", name: string) => void;
}

export default function PensionScanner({ spouseEnabled, spouseName, onSelect }: Props) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PensionExtractResult | null>(null);
  const [owner, setOwner] = useState<"self" | "spouse">("self");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setScanning(true);

    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/finance/retirement/pension-extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      if (!data.options?.length) throw new Error("No pension options found in the image. Try a clearer photo.");
      setResult(data as PensionExtractResult);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--color-rule)",
        borderRadius: 10,
        padding: "16px 18px",
        background: "var(--color-paper-deep)",
        marginTop: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink-2)" }}>
          Scan pension statement
        </div>
        {spouseEnabled && (
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as "self" | "spouse")}
            style={{
              padding: "5px 10px",
              border: "1px solid var(--color-rule)",
              borderRadius: 7,
              background: "var(--color-paper)",
              color: "var(--color-ink)",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            <option value="self">My pension</option>
            <option value="spouse">{spouseName ?? "Spouse"}&apos;s pension</option>
          </select>
        )}
      </div>

      <p style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.5, marginBottom: 12 }}>
        Upload a photo or screenshot of your Lilly pension benefit statement. Morris will extract the payment options automatically.
      </p>

      {!result && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 16px",
            borderRadius: 8,
            border: "1px dashed var(--color-bronze)",
            background: "rgba(139,106,71,0.05)",
            color: "var(--color-bronze-dark)",
            fontSize: 13,
            fontWeight: 500,
            cursor: scanning ? "wait" : "pointer",
            opacity: scanning ? 0.7 : 1,
            width: "fit-content",
          }}
        >
          {scanning ? "Scanning…" : "Choose image"}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            disabled={scanning}
            style={{ display: "none" }}
          />
        </label>
      )}

      {error && (
        <div
          style={{
            background: "rgba(154,59,42,0.08)",
            border: "1px solid rgba(154,59,42,0.3)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "var(--color-red)",
            marginTop: 10,
          }}
        >
          {error}
          <button
            onClick={() => { setError(null); fileRef.current?.click(); }}
            style={{
              marginLeft: 10,
              border: "none",
              background: "none",
              color: "var(--color-bronze-dark)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              textDecoration: "underline",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {result && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", marginBottom: 10 }}>
            {result.pension_name || "Pension options found"} — select one to add:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onSelect(opt, owner, result.pension_name || "Pension")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 9,
                  border: "1px solid var(--color-rule)",
                  background: "var(--color-paper)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = "var(--color-bronze)")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = "var(--color-rule)")}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", marginBottom: 2 }}>
                    {opt.name}
                  </div>
                  {opt.notes && (
                    <div style={{ fontSize: 11, color: "var(--color-ink-3)" }}>{opt.notes}</div>
                  )}
                </div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 500, color: "var(--color-ink)", flexShrink: 0, marginLeft: 16 }}>
                  ${opt.monthly_amount.toLocaleString()}/mo
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setResult(null)}
            style={{
              marginTop: 10,
              border: "none",
              background: "none",
              color: "var(--color-ink-3)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              textDecoration: "underline",
            }}
          >
            Scan a different image
          </button>
        </div>
      )}
    </div>
  );
}
