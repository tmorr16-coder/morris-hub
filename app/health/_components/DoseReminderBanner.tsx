"use client";

import { useState } from "react";
import DoseLogModal from "./DoseLogModal";

interface Props {
  recommendedSite: string;
  doseCount: number;
  nextDoseDate: string;
  defaultDoseMg: number;
}

export default function DoseReminderBanner({
  recommendedSite,
  doseCount,
  nextDoseDate,
  defaultDoseMg,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        style={{
          gridColumn: "1 / -1",
          background: "var(--color-bg-raised)",
          border: "1px solid var(--color-line)",
          borderRadius: 14,
          padding: "20px 22px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: "var(--color-accent-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                flexShrink: 0,
              }}
            >
              💉
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--color-accent)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  marginBottom: 3,
                }}
              >
                Next Zepbound Dose
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  fontWeight: 400,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                  color: "var(--color-ink)",
                }}
              >
                {nextDoseDate}{" "}
                <span style={{ color: "var(--color-ink-3)", fontSize: 14, fontFamily: "var(--font-sans)", fontWeight: 400 }}>
                  · 7:30 AM
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 3 }}>
                {defaultDoseMg} mg · Suggested site:{" "}
                <span style={{ color: "var(--color-accent)", fontWeight: 500 }}>{recommendedSite}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: "var(--color-ink)",
              color: "var(--color-bg)",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            ✓ Log Dose Now
          </button>
        </div>
      </div>

      <DoseLogModal
        open={showModal}
        onClose={() => setShowModal(false)}
        recommendedSite={recommendedSite}
        defaultDoseMg={defaultDoseMg}
        weekNumber={doseCount + 1}
      />
    </>
  );
}
