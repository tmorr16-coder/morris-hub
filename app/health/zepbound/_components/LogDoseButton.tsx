"use client";

import { useState } from "react";
import DoseLogModal from "../../_components/DoseLogModal";

interface Props {
  recommendedSite: string;
  defaultDoseMg: number;
  weekNumber: number;
}

export default function LogDoseButton({ recommendedSite, defaultDoseMg, weekNumber }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "10px 20px",
          borderRadius: 10,
          border: "none",
          background: "linear-gradient(135deg, #5b6ee1 0%, #a29bfe 100%)",
          color: "#fff",
          fontFamily: "var(--font-syne)",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        + Log Dose
      </button>

      <DoseLogModal
        open={open}
        onClose={() => setOpen(false)}
        recommendedSite={recommendedSite}
        defaultDoseMg={defaultDoseMg}
        weekNumber={weekNumber}
      />
    </>
  );
}
