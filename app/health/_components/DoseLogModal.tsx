"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip, IconBadge, Icons } from "@/components/ios";
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
  padding: "11px 14px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 16,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  colorScheme: "light dark",
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
    <>
      <div className="ios-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="Log Zepbound dose">
        <div className="ios-grabber" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button type="button" className="ios-btn--plain" onClick={onClose} disabled={isPending}>Cancel</button>
          <span className="ios-headline">New dose</span>
          <span style={{ width: 52 }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0 18px" }}>
          <IconBadge color="var(--ios-tint)"><Icons.PillIcon /></IconBadge>
          <div>
            <div className="ios-headline">Log Zepbound Dose</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Week {weekNumber} · {defaultDoseMg} mg</div>
          </div>
        </div>

        {/* Date */}
        <div className="ios-group-header" style={{ padding: "0 0 8px" }}>Date</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />

        {/* Dose amount */}
        <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Dose (mg)</div>
        <input
          type="number"
          value={doseMg}
          onChange={(e) => setDoseMg(e.target.value)}
          min="0.5"
          max="15"
          step="0.5"
          style={inputStyle}
        />

        {/* Injection site */}
        <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Injection site</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {INJECTION_SITES.map((s) => (
            <Chip key={s} small selected={site === s} onClick={() => setSite(s)}>
              {s}{s === recommendedSite && site !== s ? " ★" : ""}
            </Chip>
          ))}
        </div>

        {/* Notes */}
        <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Notes (optional)</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any observations, reactions, or reminders…"
          rows={2}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />

        {error && (
          <p className="ios-footnote" style={{ padding: "12px 0 0", color: "var(--ios-red)" }}>{error}</p>
        )}

        <button
          type="button"
          className="ios-btn ios-btn--primary"
          style={{ marginTop: 22, opacity: isPending ? 0.5 : 1 }}
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Confirm dose"}
        </button>
      </div>
    </>
  );
}
