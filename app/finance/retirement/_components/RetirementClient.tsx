"use client";

import { useState } from "react";
import type {
  RetirementProfile,
  RetirementAccount,
  RetirementIncome,
  RetirementExpense,
  RetirementDebt,
  RetirementScenario,
  PlaidAccountSuggestion,
  SavedAccountSuggestion,
  SharedAccountSuggestion,
  PlanSnapshot,
} from "../types";
import { savePlan, refreshAccountBalances } from "../actions";
import AccountsTab from "./AccountsTab";
import IncomeTab from "./IncomeTab";
import DebtsTab from "./DebtsTab";
import ScenariosTab from "./ScenariosTab";
import ProjectionTab from "./ProjectionTab";
import AdvisorTab from "./AdvisorTab";

const DEFAULT_PROFILE: RetirementProfile = {
  id: "",
  user_id: "",
  current_age: 40,
  retirement_age: 65,
  life_expectancy: 90,
  spouse_enabled: false,
  spouse_name: null,
  spouse_age: null,
  spouse_retirement_age: null,
  base_return: 0.07,
  inflation_rate: 0.03,
  created_at: "",
  updated_at: "",
};

const DEFAULT_SCENARIO: RetirementScenario = {
  id: "",
  profile_id: "",
  selected_scenario: "balanced",
  lean_monthly_spend: 4500,
  balanced_monthly_spend: 7000,
  abundant_monthly_spend: 12000,
  custom_monthly_spend: 7000,
  annual_travel: 5000,
  legacy_goal: 0,
  housing_windfall: 0,
  monthly_health_premium: 600,
  survivor_spend_pct: 75,
  created_at: "",
  updated_at: "",
};

const TABS = ["Accounts", "Income", "Outflows", "Scenarios", "Projection", "Advisor"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  profile: RetirementProfile | null;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  expenses: RetirementExpense[];
  debts: RetirementDebt[];
  scenario: RetirementScenario | null;
  plaidAccounts: PlaidAccountSuggestion[];
  savedAccounts: SavedAccountSuggestion[];
  sharedAccounts: SharedAccountSuggestion[];
}

function computeNestEgg(
  profile: RetirementProfile,
  accounts: RetirementAccount[],
  incomes: RetirementIncome[],
  scenario: RetirementScenario
): { nestEgg: number; safeMonthlyWithdrawal: number; depletionAge: number | null; runway: number | string } {
  const sel = scenario.selected_scenario as
    | "lean"
    | "balanced"
    | "abundant"
    | "custom";
  const spendKey = `${sel}_monthly_spend` as keyof RetirementScenario;
  const baseAnnualSpend =
    (scenario[spendKey] as number) * 12 +
    scenario.annual_travel +
    scenario.monthly_health_premium * 12;

  let portfolio = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  let nestEgg = 0;

  for (let age = profile.current_age; age <= profile.life_expectancy; age++) {
    const yearsFromNow = age - profile.current_age;
    const isRetired = age >= profile.retirement_age;

    if (age === profile.retirement_age) {
      portfolio += scenario.housing_windfall;
    }

    if (age > profile.current_age) {
      const totalBal = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
      const weightedReturn =
        totalBal > 0
          ? accounts.reduce(
              (s, a) =>
                s +
                ((a.balance ?? 0) / totalBal) *
                  (a.return_override ?? profile.base_return),
              0
            )
          : profile.base_return;
      portfolio *= 1 + weightedReturn;
    }

    if (!isRetired) {
      portfolio += accounts.reduce(
        (s, a) =>
          s + a.monthly_contribution * 12 * (1 + a.employer_match_pct / 100),
        0
      );
    } else {
      if (age === profile.retirement_age) nestEgg = portfolio;

      const inflFactor = Math.pow(1 + profile.inflation_rate, yearsFromNow);
      const adjSpend = baseAnnualSpend * inflFactor;

      const retirementIncome = incomes
        .filter((inc) => {
          if (inc.type === "salary") return false;
          const startAge = inc.start_age ?? profile.retirement_age;
          const endAge = inc.end_age ?? 999;
          if (age < startAge || age > endAge) return false;
          if (inc.type === "social_security" && inc.ss_claim_age != null && age < inc.ss_claim_age)
            return false;
          return true;
        })
        .reduce((s, inc) => s + inc.monthly_amount * 12 * inflFactor, 0);

      const netWithdrawal = Math.max(0, adjSpend - retirementIncome);
      portfolio = Math.max(0, portfolio - netWithdrawal);
    }
  }

  const safeMonthlyWithdrawal = (nestEgg * 0.04) / 12;

  let depletionAge: number | null = null;
  let portfolioCheck = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  for (let age = profile.current_age; age <= profile.life_expectancy; age++) {
    const yearsFromNow = age - profile.current_age;
    const isRetired = age >= profile.retirement_age;

    if (age === profile.retirement_age) portfolioCheck += scenario.housing_windfall;

    if (age > profile.current_age) {
      const totalBal = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
      const weightedReturn =
        totalBal > 0
          ? accounts.reduce(
              (s, a) =>
                s +
                ((a.balance ?? 0) / totalBal) *
                  (a.return_override ?? profile.base_return),
              0
            )
          : profile.base_return;
      portfolioCheck *= 1 + weightedReturn;
    }

    if (!isRetired) {
      portfolioCheck += accounts.reduce(
        (s, a) => s + a.monthly_contribution * 12 * (1 + a.employer_match_pct / 100),
        0
      );
    } else {
      const inflFactor = Math.pow(1 + profile.inflation_rate, yearsFromNow);
      const adjSpend = baseAnnualSpend * inflFactor;
      const retirementIncome = incomes
        .filter((inc) => {
          if (inc.type === "salary") return false;
          const startAge = inc.start_age ?? profile.retirement_age;
          const endAge = inc.end_age ?? 999;
          if (age < startAge || age > endAge) return false;
          if (inc.type === "social_security" && inc.ss_claim_age != null && age < inc.ss_claim_age)
            return false;
          return true;
        })
        .reduce((s, inc) => s + inc.monthly_amount * 12 * inflFactor, 0);

      const netWithdrawal = Math.max(0, adjSpend - retirementIncome);
      portfolioCheck = Math.max(0, portfolioCheck - netWithdrawal);
      if (portfolioCheck === 0 && depletionAge === null) {
        depletionAge = age;
      }
    }
  }

  const runway =
    depletionAge != null
      ? depletionAge - profile.retirement_age
      : "lifetime";

  return { nestEgg, safeMonthlyWithdrawal, depletionAge, runway };
}

export default function RetirementClient({
  profile: initialProfile,
  accounts: initialAccounts,
  incomes: initialIncomes,
  expenses: initialExpenses,
  debts: initialDebts,
  scenario: initialScenario,
  plaidAccounts,
  savedAccounts,
  sharedAccounts,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Accounts");
  const [profile, setProfile] = useState<RetirementProfile>(
    initialProfile ?? DEFAULT_PROFILE
  );
  const [accounts, setAccounts] = useState<RetirementAccount[]>(initialAccounts);
  const [incomes, setIncomes] = useState<RetirementIncome[]>(initialIncomes);
  const [expenses, setExpenses] = useState<RetirementExpense[]>(initialExpenses);
  const [debts, setDebts] = useState<RetirementDebt[]>(initialDebts);
  const [scenario, setScenario] = useState<RetirementScenario>(
    initialScenario ?? DEFAULT_SCENARIO
  );

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [refreshState, setRefreshState] = useState<"idle" | "refreshing" | "done" | "error">("idle");
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  async function handleRefreshBalances() {
    setRefreshState("refreshing");
    setRefreshMsg(null);
    const result = await refreshAccountBalances();
    if ("error" in result) {
      setRefreshState("error");
      setRefreshMsg(result.error);
    } else {
      setAccounts(result.accounts);
      setRefreshState("done");
      setRefreshMsg(result.updated > 0 ? `${result.updated} updated` : "up to date");
    }
    setTimeout(() => { setRefreshState("idle"); setRefreshMsg(null); }, 3000);
  }

  const hasLinkedAccounts = accounts.some((a) => a.plaid_account_id);

  async function handleSave(overrideAccounts?: RetirementAccount[]) {
    setSaveState("saving");
    setSaveError(null);
    const result = await savePlan({
      profile,
      accounts: overrideAccounts ?? accounts,
      incomes,
      expenses,
      debts,
      scenario,
    });
    if ("error" in result) {
      setSaveState("error");
      setSaveError(result.error);
    } else {
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  }

  // Auto-save any accounts change (add, edit, delete) so the DB stays in sync
  function handleAccountsChange(updatedAccounts: RetirementAccount[]) {
    setAccounts(updatedAccounts);
    handleSave(updatedAccounts);
  }

  const metrics = computeNestEgg(profile, accounts, incomes, scenario);

  const planSnapshot: PlanSnapshot = {
    profile,
    accounts,
    incomes,
    expenses,
    debts,
    scenario,
    ...metrics,
  };

  return (
    <div>
      {/* Save bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {saveError && (
          <span style={{ fontSize: 12, color: "var(--color-red)" }}>{saveError}</span>
        )}
        {saveState === "saved" && (
          <span style={{ fontSize: 12, color: "var(--color-green)" }}>Saved</span>
        )}
        {refreshMsg && (
          <span style={{ fontSize: 12, color: refreshState === "error" ? "var(--color-red)" : "var(--color-green)" }}>
            {refreshMsg}
          </span>
        )}
        {hasLinkedAccounts && (
          <button
            onClick={handleRefreshBalances}
            disabled={refreshState === "refreshing"}
            title="Pull the latest balances from your linked Plaid accounts"
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              border: "1px solid var(--color-rule)",
              background: "var(--color-paper-card)",
              color: "var(--color-ink-2)",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              cursor: refreshState === "refreshing" ? "wait" : "pointer",
              opacity: refreshState === "refreshing" ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ display: "inline-block", transform: refreshState === "refreshing" ? "rotate(360deg)" : "none", transition: "transform 0.6s" }}>↻</span>
            {refreshState === "refreshing" ? "Refreshing…" : "Refresh balances"}
          </button>
        )}
        <button
          onClick={() => handleSave()}
          disabled={saveState === "saving"}
          style={{
            padding: "9px 22px",
            borderRadius: 10,
            border: "1px solid var(--color-bronze-dark)",
            background: "var(--color-bronze)",
            color: "#FBF8F1",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: saveState === "saving" ? "wait" : "pointer",
            opacity: saveState === "saving" ? 0.6 : 1,
          }}
        >
          {saveState === "saving" ? "Saving…" : "Save plan"}
        </button>
      </div>

      {/* Tab bar */}
      <div
        style={{
          background: "var(--color-paper-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 10,
          padding: 4,
          display: "flex",
          flexDirection: "row",
          gap: 2,
          marginBottom: 24,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: "8px 4px",
              borderRadius: 7,
              border: "none",
              background: activeTab === tab ? "var(--color-bronze)" : "transparent",
              color: activeTab === tab ? "#FBF8F1" : "var(--color-ink-2)",
              fontSize: 13,
              fontWeight: activeTab === tab ? 600 : 400,
              fontFamily: "inherit",
              cursor: "pointer",
              textAlign: "center",
              transition: "background 120ms, color 120ms",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === "Accounts" && (
        <AccountsTab
          accounts={accounts}
          setAccounts={setAccounts}
          onAccountsChange={handleAccountsChange}
          plaidAccounts={plaidAccounts}
          savedAccounts={savedAccounts}
          sharedAccounts={sharedAccounts}
          profile={profile}
        />
      )}
      {activeTab === "Income" && (
        <IncomeTab incomes={incomes} setIncomes={setIncomes} profile={profile} />
      )}
      {activeTab === "Outflows" && (
        <DebtsTab debts={debts} setDebts={setDebts} expenses={expenses} setExpenses={setExpenses} />
      )}
      {activeTab === "Scenarios" && (
        <ScenariosTab
          profile={profile}
          setProfile={setProfile}
          scenario={scenario}
          setScenario={setScenario}
        />
      )}
      {activeTab === "Projection" && (
        <ProjectionTab
          profile={profile}
          accounts={accounts}
          incomes={incomes}
          scenario={scenario}
        />
      )}
      {activeTab === "Advisor" && (
        <AdvisorTab planSnapshot={planSnapshot} />
      )}
    </div>
  );
}
