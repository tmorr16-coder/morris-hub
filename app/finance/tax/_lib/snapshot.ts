// Tax snapshot — the user's current tax picture + opportunity flags, computed
// from their retirement-plan data using the same tax engine the projection uses.

import type { RetirementProfile, RetirementAccount, RetirementIncome, RetirementExpense, RetirementDebt, RetirementScenario } from "../../retirement/types";
import {
  titheGrossBaseAt, estimatedTaxAt, accountTaxMix, type CashflowInputs,
} from "../../retirement/_lib/cashflow";

export interface TaxOpportunity {
  key: string;
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
}

export interface TaxSnapshot {
  filing: "Married filing jointly" | "Single";
  state: string;
  grossIncome: number;
  estimatedTax: number;
  effectiveRate: number;   // 0..1
  marginalRate: number;    // 0..1
  mix: { pretax: number; roth: number; taxable: number; hsa: number };
  concentrationNote: string | null;
  surtaxes: string[];      // active surtax exposures
  opportunities: TaxOpportunity[];
}

const RMD_AGE = 73;

export function buildTaxSnapshot(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  expenses: RetirementExpense[],
  debts: RetirementDebt[],
  scenario: RetirementScenario,
): TaxSnapshot {
  const inp: CashflowInputs = { profile, accounts, incomes, expenses, debts, scenario };
  const age = profile.current_age;
  const now = Date.now();
  const filingMFJ = !!profile.spouse_enabled;

  const grossIncome = titheGrossBaseAt(incomes, age, profile);
  const estimatedTax = estimatedTaxAt(inp, age, now);
  const effectiveRate = grossIncome > 0 ? estimatedTax / grossIncome : 0;
  // Empirical marginal rate: tax on the next $10k of ordinary income.
  let marginalRate = 0;
  if (grossIncome > 0) {
    const bump: RetirementIncome = {
      id: "_bump", profile_id: "", name: "_bump", type: "other", owner: "self",
      monthly_amount: 10000, frequency: "annual", annual_growth_pct: null, vest_years: null,
      start_age: age, end_age: age, ss_claim_age: null, match_eligible: false, sort_order: 999, created_at: "",
    };
    const bumpInp: CashflowInputs = { ...inp, incomes: [...incomes, bump] };
    marginalRate = Math.max(0, (estimatedTaxAt(bumpInp, age, now) - estimatedTax) / 10000);
  }

  const mix = accountTaxMix(accounts);

  // Surtax exposure at current income.
  const surtaxes: string[] = [];
  const wageThreshold = filingMFJ ? 250000 : 200000;
  if (grossIncome > wageThreshold) surtaxes.push("Additional Medicare tax (0.9%) on wages over the threshold");
  if (grossIncome > wageThreshold) surtaxes.push("Net Investment Income Tax (3.8%) exposure on investment income");

  // Employer-stock / single-name concentration — inferred from account names.
  const total = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const stockNames = accounts.filter((a) => /stock|\bLLY\b|espp|equity/i.test(a.name));
  const stockTotal = stockNames.reduce((s, a) => s + (a.balance ?? 0), 0);
  const concentrationNote = total > 0 && stockTotal / total > 0.15
    ? `~${Math.round((stockTotal / total) * 100)}% of tracked balances sit in employer/single-stock positions (${stockNames.map((a) => a.name).slice(0, 2).join(", ")}…).`
    : null;

  // ── Opportunities ─────────────────────────────────────────────────────────
  const opportunities: TaxOpportunity[] = [];

  // 1. Roth-conversion window: early retirement before SS/RMDs, pre-tax heavy.
  const rothWindow = RMD_AGE - profile.retirement_age;
  if (profile.retirement_age < RMD_AGE && mix.pretax > 0.4 && rothWindow >= 3) {
    opportunities.push({
      key: "roth-conversions",
      title: "Roth-conversion window",
      detail: `You retire at ${profile.retirement_age} with a ~${rothWindow}-year low-income runway before RMDs at ${RMD_AGE}. Converting pre-tax dollars to Roth in those years — filling the 24%/32% brackets — can cut lifetime tax before large RMDs push you into higher brackets.`,
      impact: "high",
    });
  }

  // 2. Charitable efficiency: they give + hold appreciated/taxable stock.
  const gives = !!scenario.tithe_enabled || (scenario.offering_monthly ?? 0) > 0;
  if (gives && (mix.taxable > 0 || stockTotal > 0)) {
    opportunities.push({
      key: "charitable",
      title: "Give appreciated stock, not cash",
      detail: "You give regularly and hold appreciated/taxable positions. Donating appreciated shares (or via a Donor-Advised Fund) avoids the capital-gains tax you'd pay on a sale, gives a full-value deduction, and reduces concentration. After 70½, QCDs from an IRA satisfy RMDs tax-free.",
      impact: "high",
    });
  }

  // 3. Tax diversification: heavily pre-tax.
  if (mix.pretax > 0.7) {
    opportunities.push({
      key: "asset-location",
      title: "Add tax diversification",
      detail: `~${Math.round(mix.pretax * 100)}% of your assets are pre-tax, so nearly every retirement dollar is taxed as ordinary income. Building Roth (mega-backdoor if your plan allows), HSA, and taxable balances gives you levers to manage brackets in retirement.`,
      impact: "medium",
    });
  }

  // 4. RMD drag heads-up for large pre-tax balances.
  const pretaxBal = total * mix.pretax;
  if (pretaxBal > 1_000_000) {
    opportunities.push({
      key: "rmd-runway",
      title: "Plan for RMD tax drag",
      detail: `Your pre-tax balance (~$${(pretaxBal / 1e6).toFixed(1)}M) will grow before RMDs begin at ${RMD_AGE}, forcing large taxable withdrawals whether or not you need them — which also raises Medicare (IRMAA) premiums and Social Security taxation. Roth conversions now reduce that future drag.`,
      impact: "medium",
    });
  }

  return {
    filing: filingMFJ ? "Married filing jointly" : "Single",
    state: `${scenario.state_tax_rate ?? 5}% assumed state/local`,
    grossIncome,
    estimatedTax,
    effectiveRate,
    marginalRate,
    mix,
    concentrationNote,
    surtaxes,
    opportunities,
  };
}
