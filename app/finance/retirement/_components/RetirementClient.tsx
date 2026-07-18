"use client";

import { useState, useEffect, useRef } from "react";
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
import { Segmented } from "@/components/ios";
import AccountsTab from "./AccountsTab";
import IncomeTab from "./IncomeTab";
import DebtsTab from "./DebtsTab";
import ScenariosTab from "./ScenariosTab";
import ProjectionTab from "./ProjectionTab";
import AdvisorTab from "./AdvisorTab";
import { project } from "../_lib/projection";

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
  retirement_return: null,
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
  tithe_enabled: false,
  tithe_pct: 10,
  tithe_basis: "gross",
  offering_monthly: 0,
  tithe_tax_rate: 25,
  tithe_tax_auto: false,
  state_tax_rate: 5,
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

  async function handleSave(overrides?: {
    accounts?: RetirementAccount[];
    incomes?: RetirementIncome[];
  }) {
    setSaveState("saving");
    setSaveError(null);
    const result = await savePlan({
      profile,
      accounts: overrides?.accounts ?? accounts,
      incomes: overrides?.incomes ?? incomes,
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

  function handleAccountsChange(updatedAccounts: RetirementAccount[]) {
    setAccounts(updatedAccounts);
  }
  function handleIncomesChange(updatedIncomes: RetirementIncome[]) {
    setIncomes(updatedIncomes);
  }

  // Debounced autosave — EVERY plan change (accounts, income, outflows, scenario,
  // giving/tax settings, profile) persists automatically ~1.2s after you stop
  // editing, so nothing is lost when you switch tabs or navigate away. Continuous
  // inputs (spend, tithe %) coalesce into one write instead of one per keystroke.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const t = setTimeout(() => { handleSave(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, accounts, incomes, expenses, debts, scenario]);

  // Use the SAME engine as the Projection tab so the Advisor's nest egg /
  // depletion / runway match what the user sees on the chart.
  const proj = project(profile, accounts, incomes, expenses, debts, scenario);

  const planSnapshot: PlanSnapshot = {
    profile,
    accounts,
    incomes,
    expenses,
    debts,
    scenario,
    nestEgg: proj.nestEgg,
    safeMonthlyWithdrawal: proj.safeMonthlyWithdrawal,
    depletionAge: proj.depletionAge,
    runway: proj.runway,
  };

  return (
    <div>
      {/* Save bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
          minHeight: 34,
        }}
      >
        {saveError && (
          <span className="ios-footnote" style={{ color: "var(--ios-red)" }}>{saveError}</span>
        )}
        {saveState === "saved" && (
          <span className="ios-footnote" style={{ color: "var(--ios-green)" }}>Saved</span>
        )}
        {refreshMsg && (
          <span className="ios-footnote" style={{ color: refreshState === "error" ? "var(--ios-red)" : "var(--ios-green)" }}>
            {refreshMsg}
          </span>
        )}
        {hasLinkedAccounts && (
          <button
            onClick={handleRefreshBalances}
            disabled={refreshState === "refreshing"}
            title="Pull the latest balances from your linked accounts"
            style={{
              padding: "7px 14px",
              borderRadius: 999,
              background: "var(--ios-fill)",
              color: "var(--ios-tint)",
              fontSize: 14,
              fontWeight: 500,
              cursor: refreshState === "refreshing" ? "wait" : "pointer",
              opacity: refreshState === "refreshing" ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={15}
              height={15}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              style={{ display: "inline-block", transform: refreshState === "refreshing" ? "rotate(360deg)" : "none", transition: "transform 0.6s" }}
            >
              <path d="M20 11a8 8 0 1 0-1.6 5" />
              <path d="M20 4v6h-6" />
            </svg>
            {refreshState === "refreshing" ? "Refreshing…" : "Refresh balances"}
          </button>
        )}
        <button
          onClick={() => handleSave()}
          disabled={saveState === "saving"}
          style={{
            padding: "7px 18px",
            borderRadius: 999,
            background: "var(--ios-tint)",
            color: "var(--ios-on-tint)",
            fontSize: 14,
            fontWeight: 600,
            cursor: saveState === "saving" ? "wait" : "pointer",
            opacity: saveState === "saving" ? 0.6 : 1,
          }}
        >
          {saveState === "saving" ? "Saving…" : "Save plan"}
        </button>
      </div>

      {/* Tab bar */}
      <Segmented<Tab>
        ariaLabel="Retirement sections"
        options={TABS.map((tab) => ({ value: tab, label: tab }))}
        value={activeTab}
        onChange={setActiveTab}
        style={{ margin: "12px 0 20px" }}
      />

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
        <IncomeTab incomes={incomes} setIncomes={handleIncomesChange} profile={profile} />
      )}
      {activeTab === "Outflows" && (
        <DebtsTab debts={debts} setDebts={setDebts} expenses={expenses} setExpenses={setExpenses}
          profile={profile} accounts={accounts} incomes={incomes} scenario={scenario} setScenario={setScenario} />
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
          expenses={expenses}
          debts={debts}
        />
      )}
      {activeTab === "Advisor" && (
        <AdvisorTab planSnapshot={planSnapshot} />
      )}
    </div>
  );
}
