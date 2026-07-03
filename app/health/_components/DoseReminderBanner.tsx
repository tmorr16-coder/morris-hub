"use client";

import { useState } from "react";
import { IconBadge, Icons } from "@/components/ios";
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
      <div className="ios-list" style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IconBadge color="var(--ios-tint)"><Icons.PillIcon /></IconBadge>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ios-footnote" style={{ color: "var(--ios-tint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Next Zepbound Dose
            </div>
            <div className="ios-headline" style={{ marginTop: 1 }}>
              {nextDoseDate}{" "}
              <span className="ios-num" style={{ color: "var(--ios-label-2)", fontWeight: 400 }}>· 7:30 AM</span>
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
              {defaultDoseMg} mg · Suggested site:{" "}
              <span style={{ color: "var(--ios-tint)", fontWeight: 500 }}>{recommendedSite}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="ios-btn ios-btn--primary"
          style={{ marginTop: 14 }}
          onClick={() => setShowModal(true)}
        >
          Log dose now
        </button>
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
