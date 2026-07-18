export const dynamic = "force-dynamic";

import { loadPlan } from "../../retirement/actions";
import { LargeTitle } from "@/components/ios";
import TaxEstimatorClient from "./_components/TaxEstimatorClient";

export default async function TaxEstimatePage() {
  const plan = await loadPlan().catch(() => null);

  // Seed filing status + state rate from the retirement plan when available.
  const seedFiling: "mfj" | "single" =
    plan?.profile?.spouse_enabled ? "mfj" : "single";
  const seedStateRate =
    plan?.scenario?.state_tax_rate != null ? Number(plan.scenario.state_tax_rate) : undefined;

  return (
    <div className="ios-scroll">
      <LargeTitle
        title="Tax Estimator"
        subtitle="Model next year's refund or payment"
      />
      <div style={{ padding: "0 16px" }}>
        <TaxEstimatorClient seedFiling={seedFiling} seedStateRate={seedStateRate} />
      </div>
      <p className="ios-caption" style={{ color: "var(--ios-label-3)", padding: "8px 20px 0", lineHeight: 1.5 }}>
        A simplified federal + state/local estimate for planning only — not tax advice or a filed return. Uploaded
        documents are read to pre-fill figures and are not stored. Confirm anything material with a qualified CPA.
      </p>
      <div style={{ height: 24 }} />
    </div>
  );
}
