import {
  federalTax,
  ltcgRate,
  additionalMedicareTax,
  FED_BRACKETS,
  STD_DEDUCTION,
} from "@/app/finance/retirement/_lib/cashflow";

export type Filing = "mfj" | "single";

/** A single wage source (a W-2). Box 1 wages are already net of pre-tax 401(k)/HSA. */
export interface W2 {
  id: string;
  employer: string;
  wages: number;              // box 1
  federalWithholding: number; // box 2
  stateWithholding: number;   // box 17
  localWithholding: number;   // box 19
}

export interface EstimateInput {
  taxYear: number;
  filing: Filing;
  w2s: W2[];
  // Additional income
  interestIncome: number;      // ordinary (taxed at bracket)
  ordinaryDividends: number;   // ordinary portion
  qualifiedDividends: number;  // taxed at LTCG rate (subset of ordinary dividends)
  capitalGains: number;        // net long-term gains (LTCG rate)
  businessIncome: number;      // Schedule C / K-1 ordinary income
  otherIncome: number;         // rental, misc. ordinary
  // Above-the-line adjustments (reduce AGI)
  iraDeduction: number;
  hsaDeduction: number;
  otherAdjustments: number;
  // Deductions
  itemize: boolean;
  itemizedTotal: number;
  // Credits & estimated payments
  credits: number;                 // nonrefundable credits (CTC, etc.)
  federalEstPayments: number;      // quarterly federal payments already made
  // State / local
  stateRate: number;               // effective state + local income-tax rate (%)
  stateEstPayments: number;        // state/local estimated payments already made
}

export interface EstimateResult {
  wages: number;
  investmentIncome: number;        // interest + dividends + cap gains (for NIIT)
  ordinaryIncome: number;          // income taxed at ordinary brackets (pre-deduction)
  ltcgIncome: number;              // qualified dividends + LT cap gains
  totalIncome: number;
  adjustments: number;
  agi: number;
  deduction: number;
  deductionKind: "standard" | "itemized";
  taxableOrdinary: number;
  ordinaryTax: number;
  ltcgTax: number;
  ltcgRatePct: number;
  federalIncomeTax: number;        // ordinary + LTCG
  additionalMedicare: number;
  niit: number;
  federalTotal: number;            // income tax + surtaxes − credits
  federalWithheld: number;
  federalPaid: number;             // withholding + est. payments
  federalRefundOrOwe: number;      // paid − total (positive = refund)
  stateTaxableIncome: number;
  stateTax: number;
  stateWithheld: number;
  statePaid: number;
  stateRefundOrOwe: number;
  totalTax: number;                // federal + state
  totalPaid: number;
  totalRefundOrOwe: number;
  effectiveRate: number;           // totalTax / AGI
  marginalRate: number;            // top federal ordinary bracket reached
}

/** Top marginal federal ordinary rate reached at a taxable-income level. */
function marginalRateFor(taxable: number, filing: Filing): number {
  const brackets = FED_BRACKETS[filing];
  let rate = brackets[0][1];
  for (const [lo, r] of brackets) if (taxable > lo) rate = r;
  return rate;
}

export function computeEstimate(inp: EstimateInput): EstimateResult {
  const f = inp.filing;
  const infl = 1; // current-year estimate — brackets already 2025-based

  const wages = inp.w2s.reduce((s, w) => s + (w.wages || 0), 0);
  const federalWithheld =
    inp.w2s.reduce((s, w) => s + (w.federalWithholding || 0), 0);
  const stateWithheld = inp.w2s.reduce(
    (s, w) => s + (w.stateWithholding || 0) + (w.localWithholding || 0),
    0,
  );

  const ltcgIncome = Math.max(0, inp.capitalGains) + Math.max(0, inp.qualifiedDividends);
  const investmentIncome =
    inp.interestIncome + inp.ordinaryDividends + Math.max(0, inp.capitalGains);

  // Ordinary income excludes the qualified-dividend slice (taxed at LTCG rate).
  const ordinaryDivNonQualified = Math.max(0, inp.ordinaryDividends - inp.qualifiedDividends);
  const ordinaryIncome =
    wages +
    inp.interestIncome +
    ordinaryDivNonQualified +
    inp.businessIncome +
    inp.otherIncome;

  const adjustments = inp.iraDeduction + inp.hsaDeduction + inp.otherAdjustments;
  const totalIncome = ordinaryIncome + ltcgIncome;
  const agi = Math.max(0, totalIncome - adjustments);

  const stdDed = STD_DEDUCTION[f];
  const useItemized = inp.itemize && inp.itemizedTotal > stdDed;
  const deduction = useItemized ? inp.itemizedTotal : stdDed;

  // Ordinary-bracket tax. AGI here is ordinary AGI (LTCG stacked on top separately).
  const ordinaryAgi = Math.max(0, ordinaryIncome - adjustments);
  const taxableOrdinary = Math.max(0, ordinaryAgi - deduction);
  const ordinaryTax = federalTax(ordinaryAgi, f, infl, deduction);

  // LTCG rate keys off total taxable income (ordinary stacks under the gains).
  const rate = ltcgRate(taxableOrdinary, f, infl);
  const ltcgTax = ltcgIncome * rate;

  const federalIncomeTax = ordinaryTax + ltcgTax;

  const additionalMedicare = additionalMedicareTax(wages, f, infl);

  // NIIT: 3.8% on the lesser of net investment income and (MAGI − threshold).
  const niitThreshold = f === "mfj" ? 250000 : 200000;
  const niit = 0.038 * Math.max(0, Math.min(investmentIncome, agi - niitThreshold));

  const federalTotal = Math.max(
    0,
    federalIncomeTax + additionalMedicare + niit - inp.credits,
  );
  const federalPaid = federalWithheld + inp.federalEstPayments;
  const federalRefundOrOwe = federalPaid - federalTotal;

  // State/local: flat effective rate on AGI (a practical proxy; most states
  // start from federal AGI with their own modifications).
  const stateTaxableIncome = agi;
  const stateTax = stateTaxableIncome * (inp.stateRate / 100);
  const statePaid = stateWithheld + inp.stateEstPayments;
  const stateRefundOrOwe = statePaid - stateTax;

  const totalTax = federalTotal + stateTax;
  const totalPaid = federalPaid + statePaid;
  const totalRefundOrOwe = totalPaid - totalTax;

  return {
    wages,
    investmentIncome,
    ordinaryIncome,
    ltcgIncome,
    totalIncome,
    adjustments,
    agi,
    deduction,
    deductionKind: useItemized ? "itemized" : "standard",
    taxableOrdinary,
    ordinaryTax,
    ltcgTax,
    ltcgRatePct: rate * 100,
    federalIncomeTax,
    additionalMedicare,
    niit,
    federalTotal,
    federalWithheld,
    federalPaid,
    federalRefundOrOwe,
    stateTaxableIncome,
    stateTax,
    stateWithheld,
    statePaid,
    stateRefundOrOwe,
    totalTax,
    totalPaid,
    totalRefundOrOwe,
    effectiveRate: agi > 0 ? totalTax / agi : 0,
    marginalRate: marginalRateFor(taxableOrdinary, f),
  };
}

export function emptyInput(taxYear: number): EstimateInput {
  return {
    taxYear,
    filing: "mfj",
    w2s: [
      { id: "w2-1", employer: "", wages: 0, federalWithholding: 0, stateWithholding: 0, localWithholding: 0 },
    ],
    interestIncome: 0,
    ordinaryDividends: 0,
    qualifiedDividends: 0,
    capitalGains: 0,
    businessIncome: 0,
    otherIncome: 0,
    iraDeduction: 0,
    hsaDeduction: 0,
    otherAdjustments: 0,
    itemize: false,
    itemizedTotal: 0,
    credits: 0,
    federalEstPayments: 0,
    stateRate: 3.15, // Indiana state (3.05%) + a typical county rate
    stateEstPayments: 0,
  };
}
