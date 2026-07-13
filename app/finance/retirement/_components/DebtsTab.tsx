"use client";

import { useState } from "react";
import type { RetirementDebt, RetirementExpense, RetirementProfile, RetirementAccount, RetirementIncome, RetirementScenario } from "../types";
import CashflowInspector from "./CashflowInspector";
import { autoTaxRate, titheGrossBaseAt } from "../_lib/cashflow";

interface Props {
  debts: RetirementDebt[];
  setDebts: (d: RetirementDebt[]) => void;
  expenses: RetirementExpense[];
  setExpenses: (e: RetirementExpense[]) => void;
  profile: RetirementProfile;
  accounts: RetirementAccount[];
  incomes: RetirementIncome[];
  scenario: RetirementScenario;
  setScenario: (s: RetirementScenario) => void;
}

const LOAN_TYPES = ["mortgage", "auto", "student", "credit_card", "personal", "other"];
const LOAN_TYPE_LABELS: Record<string, string> = {
  mortgage: "Mortgage", auto: "Auto", student: "Student",
  credit_card: "Credit Card", personal: "Personal", other: "Other",
};

const EXPENSE_CATEGORIES = ["housing", "food", "transport", "healthcare", "childcare", "entertainment", "giving", "other"];
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  housing: "Housing", food: "Food & Dining", transport: "Transport",
  healthcare: "Healthcare", childcare: "Childcare", entertainment: "Entertainment",
  giving: "Giving / Church", other: "Other",
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

// "2027-09-01" -> "Sep 2027"; TZ-safe (parses the string parts, not Date()).
function fmtMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mi = parseInt(m, 10) - 1;
  return months[mi] ? `${months[mi]} ${y}` : y;
}

function payoffMonths(balance: number, rate_pct: number, monthly_payment: number): string {
  if (monthly_payment <= 0 || balance <= 0) return "—";
  const r = rate_pct / 100 / 12;
  if (r === 0) {
    const months = Math.ceil(balance / monthly_payment);
    return `${Math.floor(months / 12)}y ${months % 12}m`;
  }
  const months = Math.ceil(-Math.log(1 - (r * balance) / monthly_payment) / Math.log(1 + r));
  if (!isFinite(months) || months < 0) return "—";
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

const EMPTY_LOAN = { name: "", type: "mortgage", balance: "", rate_pct: "", monthly_payment: "" };
const EMPTY_LEASE = {
  name: "", lease_monthly_payment: "", lease_term_months: "", lease_months_remaining: "",
  lease_residual: "", lease_mileage_allowance: "", lease_overage_cpm: "", lease_disposition_fee: "", lease_end_decision: "return",
};
const EMPTY_EXPENSE = { name: "", category: "housing", monthly_amount: "", essential: true, start_date: "", end_date: "", annual_growth_pct: "" };

type FormMode = "none" | "loan" | "lease" | "expense";

export default function DebtsTab({ debts, setDebts, expenses, setExpenses, profile, accounts, incomes, scenario, setScenario }: Props) {
  const [formMode, setFormMode] = useState<FormMode>("none");
  const [editId, setEditId] = useState<string | null>(null);
  const [loanForm, setLoanForm] = useState({ ...EMPTY_LOAN });
  const [leaseForm, setLeaseForm] = useState({ ...EMPTY_LEASE });
  const [expenseForm, setExpenseForm] = useState({ ...EMPTY_EXPENSE });

  const loans = debts.filter((d) => d.subtype === "loan");
  const leases = debts.filter((d) => d.subtype === "lease");

  const totalDebtMonthly = debts.reduce((s, d) =>
    s + (d.subtype === "lease" ? (d.lease_monthly_payment ?? 0) : (d.monthly_payment ?? 0)), 0);
  const totalExpenseMonthly = expenses.reduce((s, e) => s + (e.monthly_amount ?? 0), 0);
  const totalMonthly = totalDebtMonthly + totalExpenseMonthly;
  const essentialMonthly = expenses.filter((e) => e.essential).reduce((s, e) => s + e.monthly_amount, 0);
  const discretionaryMonthly = expenses.filter((e) => !e.essential).reduce((s, e) => s + e.monthly_amount, 0);

  function openAdd(mode: FormMode) {
    setEditId(null);
    setLoanForm({ ...EMPTY_LOAN });
    setLeaseForm({ ...EMPTY_LEASE });
    setExpenseForm({ ...EMPTY_EXPENSE });
    setFormMode(mode);
  }

  function openEdit(item: RetirementDebt | RetirementExpense, mode: FormMode) {
    setEditId(item.id);
    if (mode === "loan") {
      const d = item as RetirementDebt;
      setLoanForm({ name: d.name, type: d.type, balance: d.balance != null ? String(d.balance) : "", rate_pct: d.rate_pct != null ? String(d.rate_pct) : "", monthly_payment: d.monthly_payment != null ? String(d.monthly_payment) : "" });
    } else if (mode === "lease") {
      const d = item as RetirementDebt;
      setLeaseForm({
        name: d.name, lease_monthly_payment: d.lease_monthly_payment != null ? String(d.lease_monthly_payment) : "",
        lease_term_months: d.lease_term_months != null ? String(d.lease_term_months) : "",
        lease_months_remaining: d.lease_months_remaining != null ? String(d.lease_months_remaining) : "",
        lease_residual: d.lease_residual != null ? String(d.lease_residual) : "",
        lease_mileage_allowance: d.lease_mileage_allowance != null ? String(d.lease_mileage_allowance) : "",
        lease_overage_cpm: d.lease_overage_cpm != null ? String(d.lease_overage_cpm) : "",
        lease_disposition_fee: d.lease_disposition_fee != null ? String(d.lease_disposition_fee) : "",
        lease_end_decision: d.lease_end_decision ?? "return",
      });
    } else if (mode === "expense") {
      const e = item as RetirementExpense;
      setExpenseForm({
        name: e.name, category: e.category ?? "other", monthly_amount: String(e.monthly_amount), essential: e.essential,
        start_date: e.start_date ?? "",
        end_date: e.end_date ?? "",
        annual_growth_pct: e.annual_growth_pct != null ? String(e.annual_growth_pct) : "",
      });
    }
    setFormMode(mode);
  }

  function handleSubmitLoan(ev: React.FormEvent) {
    ev.preventDefault();
    const fields = {
      name: loanForm.name, subtype: "loan" as const, type: loanForm.type,
      balance: loanForm.balance !== "" ? parseFloat(loanForm.balance) : null,
      rate_pct: loanForm.rate_pct !== "" ? parseFloat(loanForm.rate_pct) : null,
      monthly_payment: loanForm.monthly_payment !== "" ? parseFloat(loanForm.monthly_payment) : null,
      lease_monthly_payment: null, lease_term_months: null, lease_months_remaining: null,
      lease_residual: null, lease_mileage_allowance: null, lease_overage_cpm: null,
      lease_disposition_fee: null, lease_end_decision: null,
    };
    if (editId) {
      setDebts(debts.map((d) => d.id === editId ? { ...d, ...fields } : d));
    } else {
      setDebts([...debts, { id: crypto.randomUUID(), profile_id: "", sort_order: debts.length, created_at: new Date().toISOString(), ...fields }]);
    }
    setFormMode("none"); setEditId(null);
  }

  function handleSubmitLease(ev: React.FormEvent) {
    ev.preventDefault();
    const fields = {
      name: leaseForm.name, subtype: "lease" as const, type: "auto",
      balance: null, rate_pct: null, monthly_payment: null,
      lease_monthly_payment: leaseForm.lease_monthly_payment !== "" ? parseFloat(leaseForm.lease_monthly_payment) : null,
      lease_term_months: leaseForm.lease_term_months !== "" ? parseInt(leaseForm.lease_term_months) : null,
      lease_months_remaining: leaseForm.lease_months_remaining !== "" ? parseInt(leaseForm.lease_months_remaining) : null,
      lease_residual: leaseForm.lease_residual !== "" ? parseFloat(leaseForm.lease_residual) : null,
      lease_mileage_allowance: leaseForm.lease_mileage_allowance !== "" ? parseInt(leaseForm.lease_mileage_allowance) : null,
      lease_overage_cpm: leaseForm.lease_overage_cpm !== "" ? parseFloat(leaseForm.lease_overage_cpm) : null,
      lease_disposition_fee: leaseForm.lease_disposition_fee !== "" ? parseFloat(leaseForm.lease_disposition_fee) : null,
      lease_end_decision: leaseForm.lease_end_decision || null,
    };
    if (editId) {
      setDebts(debts.map((d) => d.id === editId ? { ...d, ...fields } : d));
    } else {
      setDebts([...debts, { id: crypto.randomUUID(), profile_id: "", sort_order: debts.length, created_at: new Date().toISOString(), ...fields }]);
    }
    setFormMode("none"); setEditId(null);
  }

  function handleSubmitExpense(ev: React.FormEvent) {
    ev.preventDefault();
    const fields = {
      name: expenseForm.name,
      category: expenseForm.category,
      monthly_amount: parseFloat(expenseForm.monthly_amount) || 0,
      essential: expenseForm.essential,
      start_date: expenseForm.start_date !== "" ? expenseForm.start_date : null,
      end_date: expenseForm.end_date !== "" ? expenseForm.end_date : null,
      annual_growth_pct: expenseForm.annual_growth_pct !== "" ? parseFloat(expenseForm.annual_growth_pct) : null,
    };
    if (editId) {
      setExpenses(expenses.map((e) => e.id === editId ? { ...e, ...fields } : e));
    } else {
      setExpenses([...expenses, { id: crypto.randomUUID(), profile_id: "", sort_order: expenses.length, created_at: new Date().toISOString(), ...fields }]);
    }
    setFormMode("none"); setEditId(null);
  }

  function closeForm() { setFormMode("none"); setEditId(null); }

  // Group expenses by essential/discretionary
  const essentialExpenses = expenses.filter((e) => e.essential);
  const discretionaryExpenses = expenses.filter((e) => !e.essential);

  return (
    <div>
      {/* Summary card */}
      <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Outflows
          </div>
          <div className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
            ≈ <span style={{ color: "var(--ios-red)", fontWeight: 600 }}>{fmtMoney(totalMonthly * 12)}</span> / year
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
          {[
            { label: "Total / mo", amount: totalMonthly, color: "var(--ios-red)" },
            { label: "Expenses / mo", amount: totalExpenseMonthly, color: "var(--ios-label)" },
            { label: "Essential / mo", amount: essentialMonthly, color: "var(--ios-label)" },
            { label: "Discretionary / mo", amount: discretionaryMonthly, color: "var(--ios-label-2)" },
            { label: "Debt / mo", amount: totalDebtMonthly, color: "var(--ios-label)" },
          ].map(({ label, amount, color }) => (
            <div key={label}>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 4 }}>{label}</div>
              <div className="ios-num" style={{ fontSize: 22, fontWeight: 700, color }}>{fmtMoney(amount)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Giving — automatic tithe & offerings */}
      <GivingCard scenario={scenario} setScenario={setScenario} profile={profile} incomes={incomes} />

      {/* Year-by-year cash-flow inspector — audit every inflow & outflow */}
      <CashflowInspector
        profile={profile}
        accounts={accounts}
        incomes={incomes}
        expenses={expenses}
        debts={debts}
        scenario={scenario}
      />

      {/* ── Expenses ──────────────────────────────────────────────────── */}
      <Section
        title="Expenses"
        count={expenses.length}
        onAdd={() => openAdd("expense")}
        addLabel="+ Add expense"
      >
        {expenses.length === 0 && formMode !== "expense" && (
          <Empty text="No expenses yet. Add your housing, food, and other monthly costs." />
        )}

        {essentialExpenses.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={groupLabel}>Essential</div>
            <div className="ios-list" style={{ margin: 0 }}>
              {essentialExpenses.map((e) => (
                <ExpenseRow key={e.id} expense={e}
                  onEdit={() => openEdit(e, "expense")}
                  onDelete={() => setExpenses(expenses.filter((x) => x.id !== e.id))}
                />
              ))}
            </div>
          </div>
        )}

        {discretionaryExpenses.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={groupLabel}>Discretionary</div>
            <div className="ios-list" style={{ margin: 0 }}>
              {discretionaryExpenses.map((e) => (
                <ExpenseRow key={e.id} expense={e}
                  onEdit={() => openEdit(e, "expense")}
                  onDelete={() => setExpenses(expenses.filter((x) => x.id !== e.id))}
                />
              ))}
            </div>
          </div>
        )}

        {formMode === "expense" && (
          <form onSubmit={handleSubmitExpense} style={formStyle}>
            <div className="ios-title-3" style={{ marginBottom: 16 }}>
              {editId ? "Edit expense" : "Add expense"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input required value={expenseForm.name}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Mortgage payment" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={expenseForm.category}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
                  style={selectStyle}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Monthly amount ($)</label>
                <input required type="number" min="0" step="0.01"
                  value={expenseForm.monthly_amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, monthly_amount: e.target.value }))}
                  placeholder="0" style={inputStyle} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 22 }}>
                <label className="ios-subhead" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "var(--ios-label)" }}>
                  <input type="checkbox" checked={expenseForm.essential}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, essential: e.target.checked }))}
                    style={{ width: 18, height: 18, accentColor: "var(--ios-tint)" }} />
                  Essential expense
                </label>
              </div>
              <div>
                <label style={labelStyle}>Start date</label>
                <input type="date" value={expenseForm.start_date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, start_date: e.target.value }))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Stop date</label>
                <input type="date" value={expenseForm.end_date}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, end_date: e.target.value }))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Annual growth (%)</label>
                <input type="number" step="0.1" value={expenseForm.annual_growth_pct}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, annual_growth_pct: e.target.value }))}
                  placeholder="inflation" style={inputStyle} />
              </div>
            </div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 10, lineHeight: 1.4 }}>
              Leave <em>Start date</em> blank to begin now. Leave <em>Stop date</em> blank for an ongoing cost — it runs
              through your working years, then the retirement scenario governs spending. Set a stop date for temporary
              outflows like college tuition or a car loan.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="submit" style={submitBtnStyle}>{editId ? "Save" : "Add expense"}</button>
              <button type="button" onClick={closeForm} style={cancelBtnStyle}>Cancel</button>
            </div>
          </form>
        )}
      </Section>

      {/* ── Loans ─────────────────────────────────────────────────────── */}
      <Section title="Loans" count={loans.length} onAdd={() => openAdd("loan")} addLabel="+ Add loan">
        {loans.length === 0 && formMode !== "loan" && <Empty text="No loans added." />}
        {loans.length > 0 && (
        <div className="ios-list" style={{ margin: 0 }}>
          {loans.map((d) => (
            <div key={d.id} className="ios-cell" style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span className="ios-headline">{d.name}</span>
                  <Badge label={LOAN_TYPE_LABELS[d.type] ?? d.type} />
                </div>
                <div className="ios-footnote ios-num" style={{ display: "flex", gap: 14, color: "var(--ios-label-2)", flexWrap: "wrap" }}>
                  {d.balance != null && <span>Balance: {fmtMoney(d.balance)}</span>}
                  {d.rate_pct != null && <span>{d.rate_pct}% APR</span>}
                  {d.balance != null && d.rate_pct != null && d.monthly_payment != null && (
                    <span>Payoff: {payoffMonths(d.balance, d.rate_pct, d.monthly_payment)}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <div className="ios-num" style={{ fontSize: 17, fontWeight: 600, color: "var(--ios-label)" }}>
                  {fmtMoney(d.monthly_payment)}/mo
                </div>
                <RowActions onEdit={() => openEdit(d, "loan")} onDelete={() => setDebts(debts.filter((x) => x.id !== d.id))} />
              </div>
            </div>
          ))}
        </div>
        )}
        {formMode === "loan" && (
          <form onSubmit={handleSubmitLoan} style={formStyle}>
            <div className="ios-title-3" style={{ marginBottom: 16 }}>
              {editId ? "Edit loan" : "Add loan"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input required value={loanForm.name}
                  onChange={(e) => setLoanForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Home mortgage" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={loanForm.type}
                  onChange={(e) => setLoanForm((f) => ({ ...f, type: e.target.value }))}
                  style={selectStyle}>
                  {LOAN_TYPES.map((t) => <option key={t} value={t}>{LOAN_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Balance ($)</label>
                <input type="number" min="0" step="0.01" value={loanForm.balance}
                  onChange={(e) => setLoanForm((f) => ({ ...f, balance: e.target.value }))}
                  placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Interest rate (% APR)</label>
                <input type="number" min="0" max="50" step="0.001" value={loanForm.rate_pct}
                  onChange={(e) => setLoanForm((f) => ({ ...f, rate_pct: e.target.value }))}
                  placeholder="6.5" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Monthly payment ($)</label>
                <input type="number" min="0" step="0.01" value={loanForm.monthly_payment}
                  onChange={(e) => setLoanForm((f) => ({ ...f, monthly_payment: e.target.value }))}
                  placeholder="0" style={inputStyle} />
              </div>
            </div>
            {loanForm.balance && loanForm.rate_pct && loanForm.monthly_payment && (
              <div className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)", marginTop: 10 }}>
                Estimated payoff: {payoffMonths(parseFloat(loanForm.balance), parseFloat(loanForm.rate_pct), parseFloat(loanForm.monthly_payment))}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="submit" style={submitBtnStyle}>{editId ? "Save" : "Add loan"}</button>
              <button type="button" onClick={closeForm} style={cancelBtnStyle}>Cancel</button>
            </div>
          </form>
        )}
      </Section>

      {/* ── Leases ────────────────────────────────────────────────────── */}
      <Section title="Leases" count={leases.length} onAdd={() => openAdd("lease")} addLabel="+ Add lease">
        {leases.length === 0 && formMode !== "lease" && <Empty text="No leases added." />}
        {leases.length > 0 && (
        <div className="ios-list" style={{ margin: 0 }}>
          {leases.map((d) => (
            <div key={d.id} className="ios-cell" style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span className="ios-headline">{d.name}</span>
                  <Badge label="Lease" />
                </div>
                <div className="ios-footnote ios-num" style={{ display: "flex", gap: 14, color: "var(--ios-label-2)", flexWrap: "wrap" }}>
                  {d.lease_months_remaining != null && <span>{d.lease_months_remaining}mo remaining</span>}
                  {d.lease_residual != null && <span>Residual: {fmtMoney(d.lease_residual)}</span>}
                  {d.lease_end_decision && <span style={{ textTransform: "capitalize" }}>At term: {d.lease_end_decision}</span>}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <div className="ios-num" style={{ fontSize: 17, fontWeight: 600, color: "var(--ios-label)" }}>
                  {fmtMoney(d.lease_monthly_payment)}/mo
                </div>
                <RowActions onEdit={() => openEdit(d, "lease")} onDelete={() => setDebts(debts.filter((x) => x.id !== d.id))} />
              </div>
            </div>
          ))}
        </div>
        )}
        {formMode === "lease" && (
          <form onSubmit={handleSubmitLease} style={formStyle}>
            <div className="ios-title-3" style={{ marginBottom: 16 }}>
              {editId ? "Edit lease" : "Add lease"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Name</label>
                <input required value={leaseForm.name}
                  onChange={(e) => setLeaseForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Honda Accord lease" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Monthly payment ($)</label>
                <input type="number" min="0" step="0.01" value={leaseForm.lease_monthly_payment}
                  onChange={(e) => setLeaseForm((f) => ({ ...f, lease_monthly_payment: e.target.value }))}
                  placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Term (months)</label>
                <input type="number" min="0" value={leaseForm.lease_term_months}
                  onChange={(e) => setLeaseForm((f) => ({ ...f, lease_term_months: e.target.value }))}
                  placeholder="36" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Months remaining</label>
                <input type="number" min="0" value={leaseForm.lease_months_remaining}
                  onChange={(e) => setLeaseForm((f) => ({ ...f, lease_months_remaining: e.target.value }))}
                  placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Residual value ($)</label>
                <input type="number" min="0" step="0.01" value={leaseForm.lease_residual}
                  onChange={(e) => setLeaseForm((f) => ({ ...f, lease_residual: e.target.value }))}
                  placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Annual mileage allowance</label>
                <input type="number" min="0" value={leaseForm.lease_mileage_allowance}
                  onChange={(e) => setLeaseForm((f) => ({ ...f, lease_mileage_allowance: e.target.value }))}
                  placeholder="12000" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Overage cost/mile ($)</label>
                <input type="number" min="0" step="0.0001" value={leaseForm.lease_overage_cpm}
                  onChange={(e) => setLeaseForm((f) => ({ ...f, lease_overage_cpm: e.target.value }))}
                  placeholder="0.25" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Disposition fee ($)</label>
                <input type="number" min="0" step="0.01" value={leaseForm.lease_disposition_fee}
                  onChange={(e) => setLeaseForm((f) => ({ ...f, lease_disposition_fee: e.target.value }))}
                  placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>At term end</label>
                <select value={leaseForm.lease_end_decision}
                  onChange={(e) => setLeaseForm((f) => ({ ...f, lease_end_decision: e.target.value }))}
                  style={selectStyle}>
                  <option value="return">Return</option>
                  <option value="renew">Renew</option>
                  <option value="buy">Buy</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button type="submit" style={submitBtnStyle}>{editId ? "Save" : "Add lease"}</button>
              <button type="button" onClick={closeForm} style={cancelBtnStyle}>Cancel</button>
            </div>
          </form>
        )}
      </Section>
    </div>
  );
}

// ── Giving (tithe & offerings) ────────────────────────────────────────────────

function GivingCard({ scenario, setScenario, profile, incomes }: {
  scenario: RetirementScenario; setScenario: (s: RetirementScenario) => void;
  profile: RetirementProfile; incomes: RetirementIncome[];
}) {
  const enabled = !!scenario.tithe_enabled;
  const pct = scenario.tithe_pct ?? 10;
  const basis = scenario.tithe_basis ?? "gross";
  const auto = !!scenario.tithe_tax_auto;
  const [pctStr, setPctStr] = useState(String(pct));
  const [offStr, setOffStr] = useState(String(scenario.offering_monthly ?? 0));
  const [taxStr, setTaxStr] = useState(String(scenario.tithe_tax_rate ?? 25));
  const [stateStr, setStateStr] = useState(String(scenario.state_tax_rate ?? 5));
  const offering = scenario.offering_monthly ?? 0;
  const taxRate = scenario.tithe_tax_rate ?? 25;
  // Effective auto rate on today's income (federal brackets + state), for display.
  const currentAutoRate = autoTaxRate(titheGrossBaseAt(incomes, profile.current_age, profile), profile.current_age, profile, scenario);
  const filingLabel = profile.spouse_enabled ? "married filing jointly" : "single";

  return (
    <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}>
        <div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Giving</div>
          <div className="ios-subhead" style={{ color: "var(--ios-label)", marginTop: 2, fontWeight: 600 }}>Automatic tithe &amp; offerings</div>
        </div>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setScenario({ ...scenario, tithe_enabled: e.target.checked })}
          style={{ width: 22, height: 22, accentColor: "var(--ios-tint)" }}
        />
      </label>

      {enabled && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginTop: 16 }}>
            <div>
              <label style={labelStyle}>Tithe (%)</label>
              <input type="number" min="0" max="100" step="0.5" value={pctStr}
                onChange={(e) => { setPctStr(e.target.value); setScenario({ ...scenario, tithe_pct: e.target.value === "" ? 0 : (parseFloat(e.target.value) || 0) }); }}
                placeholder="10" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Basis</label>
              <select value={basis} onChange={(e) => setScenario({ ...scenario, tithe_basis: e.target.value })} style={selectStyle}>
                <option value="gross">Gross · before taxes</option>
                <option value="net">Net · after taxes</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Offering ($/mo)</label>
              <input type="number" min="0" step="10" value={offStr}
                onChange={(e) => { setOffStr(e.target.value); setScenario({ ...scenario, offering_monthly: e.target.value === "" ? 0 : (parseFloat(e.target.value) || 0) }); }}
                placeholder="0" style={inputStyle} />
            </div>
          </div>

          {/* Net basis: automatic (brackets) or manual tax rate */}
          {basis === "net" && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--ios-separator)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={auto}
                  onChange={(e) => setScenario({ ...scenario, tithe_tax_auto: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "var(--ios-tint)" }} />
                <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>Calculate taxes automatically</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginTop: 12 }}>
                {auto ? (
                  <div>
                    <label style={labelStyle}>State / local tax (%)</label>
                    <input type="number" min="0" max="20" step="0.1" value={stateStr}
                      onChange={(e) => { setStateStr(e.target.value); setScenario({ ...scenario, state_tax_rate: e.target.value === "" ? 0 : (parseFloat(e.target.value) || 0) }); }}
                      placeholder="5" style={inputStyle} />
                  </div>
                ) : (
                  <div>
                    <label style={labelStyle}>Tax rate now (%)</label>
                    <input type="number" min="0" max="100" step="1" value={taxStr}
                      onChange={(e) => { setTaxStr(e.target.value); setScenario({ ...scenario, tithe_tax_rate: e.target.value === "" ? 0 : (parseFloat(e.target.value) || 0) }); }}
                      placeholder="25" style={inputStyle} />
                  </div>
                )}
              </div>
              {auto && (
                <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 10, lineHeight: 1.5 }}>
                  Federal brackets ({filingLabel}) + standard deduction, plus your state rate — ≈{" "}
                  <strong style={{ color: "var(--ios-label)" }}>{(currentAutoRate * 100).toFixed(1)}%</strong> effective on today&apos;s
                  income, recalculated each year as income changes.
                </div>
              )}
            </div>
          )}

          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 12, lineHeight: 1.5 }}>
            {pct}% of {basis === "net"
              ? (auto
                  ? "after-tax income (taxes computed automatically from brackets each year)"
                  : `after-tax income — ${taxRate}% effective today, rising with income as your salary grows (everything else is fair game)`)
              : "all income as you receive it — salary now, and Social Security, pension & withdrawals in retirement"}
            {offering > 0 ? `, plus ${fmtMoney(offering)}/mo in offerings` : ""}. Appears as an outflow in the cash-flow
            inspector below and in the projection.
          </div>
        </>
      )}
    </div>
  );
}

// ── Small shared components ───────────────────────────────────────────────────

function Section({ title, count, onAdd, addLabel, children }: {
  title: string; count: number; onAdd: () => void; addLabel: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px", marginBottom: 8 }}>
        <div className="ios-group-header" style={{ padding: 0 }}>
          {title} {count > 0 && <span style={{ color: "var(--ios-label-3)" }}>· {count}</span>}
        </div>
        <button onClick={onAdd} style={{ padding: 0, color: "var(--ios-tint)", fontSize: 15, fontWeight: 400 }}>
          {addLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function ExpenseRow({ expense, onEdit, onDelete }: { expense: RetirementExpense; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="ios-cell" style={rowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="ios-headline">{expense.name}</span>
          {expense.category && (
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: expense.essential ? "var(--ios-green)" : "var(--ios-label-2)", background: "var(--ios-fill)", padding: "2px 7px", borderRadius: 6 }}>
              {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
            </span>
          )}
        </div>
        {(expense.start_date != null || expense.end_date != null) && (
          <div className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)", marginTop: 3 }}>
            {fmtMonthYear(expense.start_date) ?? "Now"} → {fmtMonthYear(expense.end_date) ?? "ongoing"}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <div className="ios-num" style={{ fontSize: 17, fontWeight: 600, color: "var(--ios-label)" }}>
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(expense.monthly_amount)}/mo
        </div>
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--ios-finance)", background: "var(--ios-fill)", padding: "2px 7px", borderRadius: 6 }}>
      {label}
    </span>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <button onClick={onEdit} style={editBtnStyle}>Edit</button>
      <button onClick={onDelete} style={deleteBtnStyle}>Remove</button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="ios-footnote" style={{ color: "var(--ios-label-2)", paddingLeft: 4, paddingBottom: 8 }}>{text}</div>;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const groupLabel: React.CSSProperties = {
  fontSize: 13, fontWeight: 400, letterSpacing: "0.02em", textTransform: "uppercase",
  color: "var(--ios-label-2)", marginBottom: 8, paddingLeft: 4,
};

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap", rowGap: 8,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 400, letterSpacing: "0.02em", textTransform: "uppercase",
  color: "var(--ios-label-2)", display: "block", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", border: "1px solid var(--ios-separator)",
  borderRadius: 8, background: "var(--ios-bg)", color: "var(--ios-label)",
  fontSize: 15, outline: "none", boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle };

const formStyle: React.CSSProperties = {
  background: "var(--ios-cell)", borderRadius: 10, padding: 18, marginTop: 12,
  boxShadow: "inset 0 0 0 1px var(--ios-separator)",
};

const editBtnStyle: React.CSSProperties = {
  padding: 0, color: "var(--ios-tint)", fontSize: 14, cursor: "pointer",
};

const deleteBtnStyle: React.CSSProperties = {
  padding: 0, color: "var(--ios-red)", fontSize: 14, cursor: "pointer",
};

const submitBtnStyle: React.CSSProperties = {
  padding: "12px 22px", borderRadius: 12, background: "var(--ios-tint)",
  color: "var(--ios-on-tint)", fontSize: 17, fontWeight: 600, cursor: "pointer",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "0 8px", color: "var(--ios-tint)", fontSize: 17, cursor: "pointer",
};
