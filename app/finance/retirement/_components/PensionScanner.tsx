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
        borderRadius: 10,
        padding: "16px 18px",
        background: "var(--ios-fill-2)",
        marginTop: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)" }}>
          Scan pension statement
        </div>
        {spouseEnabled && (
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value as "self" | "spouse")}
            style={{
              padding: "7px 10px",
              border: "1px solid var(--ios-separator)",
              borderRadius: 8,
              background: "var(--ios-bg)",
              color: "var(--ios-label)",
              fontSize: 14,
            }}
          >
            <option value="self">My pension</option>
            <option value="spouse">{spouseName ?? "Spouse"}&apos;s pension</option>
          </select>
        )}
      </div>

      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5, marginBottom: 12 }}>
        Upload a photo or screenshot of your Lilly pension benefit statement. Morris will extract the payment options automatically.
      </p>

      {!result && (
        <label
          className="ios-subhead"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            borderRadius: 999,
            background: "var(--ios-tint)",
            color: "var(--ios-on-tint)",
            fontWeight: 600,
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
          className="ios-footnote"
          style={{
            background: "var(--ios-fill)",
            borderRadius: 8,
            padding: "8px 12px",
            color: "var(--ios-red)",
            marginTop: 10,
          }}
        >
          {error}
          <button
            onClick={() => { setError(null); fileRef.current?.click(); }}
            style={{
              marginLeft: 10,
              color: "var(--ios-tint)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {result && (
        <div>
          <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 10 }}>
            {result.pension_name || "Pension options found"} — select one to add:
          </div>
          <div className="ios-list" style={{ margin: 0 }}>
            {result.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onSelect(opt, owner, result.pension_name || "Pension")}
                className="ios-cell"
                style={{ justifyContent: "space-between", textAlign: "left" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)", marginBottom: 2 }}>
                    {opt.name}
                  </div>
                  {opt.notes && (
                    <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>{opt.notes}</div>
                  )}
                </div>
                <div className="ios-num" style={{ fontSize: 18, fontWeight: 700, color: "var(--ios-label)", flexShrink: 0, marginLeft: 16 }}>
                  ${opt.monthly_amount.toLocaleString()}/mo
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setResult(null)}
            style={{
              marginTop: 10,
              color: "var(--ios-tint)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Scan a different image
          </button>
        </div>
      )}
    </div>
  );
}
