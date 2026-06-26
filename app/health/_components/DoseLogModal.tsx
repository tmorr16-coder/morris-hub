"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logDose } from "../actions";

const INJECTION_SITES = [
  "Left abdomen",
  "Right abdomen",
  "Left thigh",
  "Right thigh",
  "Left arm",
  "Right arm",
];

interface Props {
  open: boolean;
  onClose: () => void;
  recommendedSite: string;
  defaultDoseMg?: number;
  weekNumber: number;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--color-line)",
  background: "var(--color-bg-sunk)",
  color: "var(--color-ink)",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--color-ink-3)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  fontWeight: 500,
};

export default function DoseLogModal({
  open,
  onClose,
  recommendedSite,
  defaultDoseMg = 5,
  weekNumber,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const todayStr = new Date().toLocaleDateString("sv");

  const [date, setDate] = useState(todayStr);
  const [doseMg, setDoseMg] = useState(String(defaultDoseMg));
  const [site, setSite] = useState(recommendedSite);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await logDose({
        date,
        dose_mg: parseFloat(doseMg) || defaultDoseMg,
        injection_site: site,
        notes,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(22,20,15,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-line)",
          borderRadius: 16,
          padding: 28,
          width: "100%",
          maxWidth: 440,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>💉</div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "var(--color-ink)",
            }}
          >
            Log Zepbound Dose
          </div>
          <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginTop: 4 }}>
            Week {weekNumber} · {defaultDoseMg} mg
          </div>
        </div>

        {/* Date */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Date</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Dose amount */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Dose (mg)</div>
          <input
            type="number"
            value={doseMg}
            onChange={(e) => setDoseMg(e.target.value)}
            min="0.5"
            max="15"
            step="0.5"
            style={inputStyle}
          />
        </div>

        {/* Injection site */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Injection Site</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {INJECTION_SITES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSite(s)}
                style={{
                  padding: "10px",
                  borderRadius: 8,
                  border: `1px solid ${site === s ? "var(--color-accent)" : "var(--color-line)"}`,
                  background: site === s ? "var(--color-accent-soft)" : "var(--color-bg-sunk)",
                  color: site === s ? "var(--color-accent)" : "var(--color-ink-2)",
                  fontSize: 12,
                  fontWeight: site === s ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                {s}
                {s === recommendedSite && site !== s ? " ★" : ""}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>Notes (optional)</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any observations, reactions, or reminders…"
            rows={2}
            style={{
              ...inputStyle,
              resize: "vertical",
              lineHeight: 1.5,
            }}
          />
        </div>

        {error && (
          <div
            style={{ color: "var(--color-accent)", fontSize: 12, marginBottom: 12, textAlign: "center" }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 10,
              border: "1px solid var(--color-line)",
              background: "transparent",
              color: "var(--color-ink-3)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            style={{
              flex: 2,
              padding: "12px",
              borderRadius: 10,
              border: "none",
              background: isPending ? "var(--color-bg-sunk)" : "var(--color-ink)",
              color: isPending ? "var(--color-ink-4)" : "var(--color-bg)",
              fontSize: 13,
              fontWeight: 600,
              cursor: isPending ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {isPending ? "Saving…" : "✓ Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
