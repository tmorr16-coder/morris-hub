export interface RetirementProfile {
  id: string;
  user_id: string;
  current_age: number;
  retirement_age: number;
  life_expectancy: number;
  spouse_enabled: boolean;
  spouse_name: string | null;
  spouse_age: number | null;
  spouse_retirement_age: number | null;
  base_return: number;
  inflation_rate: number;
  created_at: string;
  updated_at: string;
}

export interface RetirementAccount {
  id: string;
  profile_id: string;
  name: string;
  type: string;
  owner: string;
  balance: number;
  monthly_contribution: number;
  employer_match_pct: number;
  return_override: number | null;
  plaid_account_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface RetirementIncome {
  id: string;
  profile_id: string;
  name: string;
  type: string;           // salary | social_security | pension | bonus | stock_award | part_time | other
  owner: string;
  monthly_amount: number; // per-period amount; interpret with `frequency`
  frequency: string;      // monthly | annual | one_time
  annual_growth_pct: number | null;
  vest_years: number | null;  // stock_award: vesting period in years
  start_age: number | null;
  end_age: number | null;
  ss_claim_age: number | null;
  match_eligible: boolean | null; // counts toward the 401(k) employer match base (null = salary only)
  sort_order: number;
  created_at: string;
}

export interface RetirementExpense {
  id: string;
  profile_id: string;
  name: string;
  monthly_amount: number;
  essential: boolean;
  category: string | null;
  start_date: string | null;     // ISO date the outflow begins (null = from now)
  end_date: string | null;       // ISO date the outflow stops, e.g. tuition (null = ongoing through working years)
  annual_growth_pct: number | null; // null = grow with plan inflation
  sort_order: number;
  created_at: string;
}

export interface RetirementDebt {
  id: string;
  profile_id: string;
  name: string;
  subtype: string;
  type: string;
  balance: number | null;
  rate_pct: number | null;
  monthly_payment: number | null;
  lease_monthly_payment: number | null;
  lease_term_months: number | null;
  lease_months_remaining: number | null;
  lease_residual: number | null;
  lease_mileage_allowance: number | null;
  lease_overage_cpm: number | null;
  lease_disposition_fee: number | null;
  lease_end_decision: string | null;
  sort_order: number;
  created_at: string;
}

export interface RetirementScenario {
  id: string;
  profile_id: string;
  selected_scenario: string;
  lean_monthly_spend: number;
  balanced_monthly_spend: number;
  abundant_monthly_spend: number;
  custom_monthly_spend: number;
  annual_travel: number;
  legacy_goal: number;
  housing_windfall: number;
  monthly_health_premium: number;
  survivor_spend_pct: number;
  tithe_enabled: boolean | null;      // include an automatic tithe outflow
  tithe_pct: number | null;           // percent of income tithed (default 10)
  tithe_basis: string | null;         // 'gross' (all income) | 'net' (after-tax income)
  offering_monthly: number | null;    // assumed additional monthly giving beyond the tithe
  tithe_tax_rate: number | null;      // assumed effective tax rate for the net basis (default 25)
  created_at: string;
  updated_at: string;
}

export interface PlaidAccountSuggestion {
  id: string;
  name: string;
  type: string;
  mask: string | null;
  balance: number | null;
}

export interface SavedAccountSuggestion {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number;
}

export interface SharedAccountSuggestion {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number;
  shared_by: string; // display label: "Shared by [name/email]"
}

export interface ProjectionPoint {
  age: number;
  portfolio: number;
  isRetired: boolean;
}

export interface PlanSnapshot {
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
  scenario: RetirementScenario;
  nestEgg: number;
  safeMonthlyWithdrawal: number;
  depletionAge: number | null;
  runway: number | string;
}
