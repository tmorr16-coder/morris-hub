import {
  additionalMedicareTax,
  niitTax,
  taxTables,
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
  credits: number;                 // nonrefundable credits (CTC, etc.) — reduce income tax only
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
function marginalRateFor(taxable: number, filing: Filing, year: number): number {
  const brackets = taxTables(year).brackets[filing];
  let rate = brackets[0][1];
  for (const [lo, r] of brackets) if (taxable > lo) rate = r;
  return rate;
}

/** Indiana's flat rate for a year (HB 1001 schedule). */
export function indianaStateRate(year: number): number {
  if (year <= 2024) return 3.05;
  if (year === 2025) return 3.0;
  return 2.95;
}

/** Net capital losses offset up to $3,000 of ordinary income; the rest carries forward. */
const CAPITAL_LOSS_LIMIT = 3000;

export function computeEstimate(inp: EstimateInput): EstimateResult {
  const f = inp.filing;
  const tables = taxTables(inp.taxYear);
  // The tables are for the chosen year, so no inflation scaling: the shared
  // surtax helper takes the planner's inflation factor, and 1 means "this
  // year's dollars".
  const infl = 1;

  const wages = inp.w2s.reduce((s, w) => s + (w.wages || 0), 0);
  const federalWithheld =
    inp.w2s.reduce((s, w) => s + (w.federalWithholding || 0), 0);
  const stateWithheld = inp.w2s.reduce(
    (s, w) => s + (w.stateWithholding || 0) + (w.localWithholding || 0),
    0,
  );

  // A net capital loss offsets up to $3,000 of ordinary income this year.
  const capitalLossOffset = inp.capitalGains < 0 ? Math.min(CAPITAL_LOSS_LIMIT, -inp.capitalGains) : 0;
  const qualified = Math.max(0, Math.min(inp.qualifiedDividends, inp.ordinaryDividends));
  const ltcgIncome = Math.max(0, inp.capitalGains) + qualified;
  const investmentIncome =
    inp.interestIncome + inp.ordinaryDividends + Math.max(0, inp.capitalGains) + Math.max(0, inp.otherIncome) - capitalLossOffset;

  // Ordinary income excludes the qualified-dividend slice (taxed at LTCG rate).
  const ordinaryDivNonQualified = Math.max(0, inp.ordinaryDividends - qualified);
  const ordinaryIncome =
    wages +
    inp.interestIncome +
    ordinaryDivNonQualified +
    inp.businessIncome +
    inp.otherIncome -
    capitalLossOffset;

  const adjustments = inp.iraDeduction + inp.hsaDeduction + inp.otherAdjustments;
  const totalIncome = ordinaryIncome + ltcgIncome;
  const agi = Math.max(0, totalIncome - adjustments);

  const stdDed = tables.stdDeduction[f];
  const useItemized = inp.itemize && inp.itemizedTotal > stdDed;
  const deduction = useItemized ? inp.itemizedTotal : stdDed;

  // Ordinary-bracket tax. AGI here is ordinary AGI (LTCG stacked on top separately).
  const ordinaryAgi = Math.max(0, ordinaryIncome - adjustments);
  const taxableOrdinary = Math.max(0, ordinaryAgi - deduction);
  const ordinaryTax = federalTaxWithTables(ordinaryAgi, f, deduction, tables);

  // Long-term gains and qualified dividends stack on top of ordinary taxable
  // income: 0% up to the bracket top, then 15%, then 20%. Any deduction the
  // ordinary income did not use shelters gains first.
  const gainAfterDeduction = Math.max(0, ltcgIncome - Math.max(0, deduction - ordinaryAgi));
  const { tax: ltcgTax, rate } = capitalGainsTaxWithTables(taxableOrdinary, gainAfterDeduction, f, tables);

  const federalIncomeTax = ordinaryTax + ltcgTax;

  const additionalMedicare = additionalMedicareTax(wages, f, infl);

  // NIIT: 3.8% on the lesser of net investment income and (MAGI − threshold).
  const niit = niitTax(investmentIncome, agi, f);

  // Nonrefundable credits reduce income tax only; the surtaxes are added after.
  const federalTotal = Math.max(0, federalIncomeTax - inp.credits) + additionalMedicare + niit;
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
    marginalRate: marginalRateFor(taxableOrdinary, f, inp.taxYear),
  };
}

// The shared helpers read the planner's current-year tables. The estimator lets
// the year be chosen, so these two evaluate the same formulas against the
// chosen year's tables.
function federalTaxWithTables(income: number, filing: Filing, deduction: number, t: ReturnType<typeof taxTables>): number {
  const taxable = Math.max(0, income - deduction);
  const brackets = t.brackets[filing];
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const lo = brackets[i][0];
    const hi = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (taxable > lo) tax += (Math.min(taxable, hi) - lo) * brackets[i][1];
  }
  return tax;
}
function capitalGainsTaxWithTables(taxableOrdinary: number, gain: number, filing: Filing, t: ReturnType<typeof taxTables>): { tax: number; rate: number } {
  if (gain <= 0) return { tax: 0, rate: 0 };
  const [top0, top15] = t.ltcg[filing];
  const at0 = Math.max(0, Math.min(gain, top0 - taxableOrdinary));
  const at15 = Math.max(0, Math.min(gain - at0, top15 - Math.max(taxableOrdinary, top0)));
  const at20 = Math.max(0, gain - at0 - at15);
  const tax = at15 * 0.15 + at20 * 0.2;
  return { tax, rate: tax / gain };
}

/** Project a mid-year paystub's YTD figures to a full-year estimate.
 *  Prefers deriving elapsed periods from YTD ÷ this-period (most accurate),
 *  else falls back to day-of-year proration. Returns annualized W-2-style figures. */
export function annualizePaystub(ps: {
  pay_frequency?: string | null;
  pay_date?: string | null;
  gross_this_period?: number | null;
  federal_wh_this_period?: number | null;
  state_wh_this_period?: number | null;
  ytd_gross?: number | null;
  ytd_federal_wh?: number | null;
  ytd_state_wh?: number | null;
  ytd_pretax_retirement?: number | null;
  ytd_pretax_other?: number | null;
}): { wages: number; federalWithholding: number; stateWithholding: number; pretaxRetirement: number; basis: string } {
  const periodsPerYear: Record<string, number> = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
  const total = ps.pay_frequency ? periodsPerYear[ps.pay_frequency] ?? 24 : 24;

  const ytdGross = ps.ytd_gross ?? 0;
  const perGross = ps.gross_this_period ?? 0;

  // Elapsed fraction of the year.
  let fraction: number;
  let basis: string;
  if (perGross > 0 && ytdGross > 0) {
    const periodsElapsed = Math.max(1, Math.round(ytdGross / perGross));
    fraction = Math.min(1, periodsElapsed / total);
    basis = `${periodsElapsed} of ${total} pay periods`;
  } else if (ps.pay_date) {
    const d = new Date(`${ps.pay_date}T12:00:00`);
    const start = new Date(d.getFullYear(), 0, 1).getTime();
    const dayOfYear = Math.max(1, Math.round((d.getTime() - start) / 86_400_000) + 1);
    fraction = Math.min(1, dayOfYear / 365);
    basis = `${Math.round(fraction * 100)}% through the year`;
  } else {
    fraction = 0.5;
    basis = "assumed mid-year";
  }

  const scale = (n: number | null | undefined) => (fraction > 0 ? Math.round(((n ?? 0) / fraction)) : (n ?? 0));
  // Box 1 is gross pay less what was deferred before tax: 401(k)/403(b), HSA,
  // and Section 125 premiums. Projecting gross overstated the year's tax by
  // the marginal rate on every dollar deferred.
  const box1 = Math.max(0, ytdGross - (ps.ytd_pretax_retirement ?? 0) - (ps.ytd_pretax_other ?? 0));
  return {
    wages: scale(box1),
    federalWithholding: scale(ps.ytd_federal_wh),
    stateWithholding: scale(ps.ytd_state_wh),
    pretaxRetirement: scale(ps.ytd_pretax_retirement),
    basis,
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
    stateRate: Math.round((indianaStateRate(taxYear) + 1.1) * 100) / 100, // Indiana state rate for the year + Hamilton County (1.1%)
    stateEstPayments: 0,
  };
}
