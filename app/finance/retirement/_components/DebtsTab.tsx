"use client";

import { useState } from "react";
import type { RetirementDebt, RetirementExpense } from "../types";

interface Props {
  debts: RetirementDebt[];
  setDebts: (d: RetirementDebt[]) => void;
  expenses: RetirementExpense[];
  setExpenses: (e: RetirementExpense[]) => void;
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
const EMPTY_EXPENSE = { name: "", category: "housing", monthly_amount: "", essential: true };

type FormMode = "none" | "loan" | "lease" | "expense";

export default function DebtsTab({ debts, setDebts, expenses, setExpenses }: Props) {
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
      setExpenseForm({ name: e.name, category: e.category ?? "other", monthly_amount: String(e.monthly_amount), essential: e.essential });
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
      <div style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "20px 24px", boxShadow: "var(--shadow-card)", marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 14 }}>
          Monthly outflows
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
          {[
            { label: "Total", amount: totalMonthly, color: "var(--color-red)" },
            { label: "Expenses", amount: totalExpenseMonthly, color: "var(--color-ink)" },
            { label: "Essential", amount: essentialMonthly, color: "var(--color-ink-2)" },
            { label: "Discretionary", amount: discretionaryMonthly, color: "var(--color-ink-3)" },
            { label: "Debt payments", amount: totalDebtMonthly, color: "var(--color-ink-2)" },
          ].map(({ label, amount, color }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "var(--color-ink-3)", marginBottom: 4 }}>{label}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 500, color }}>{fmtMoney(amount)}</div>
            </div>
          ))}
        </div>
      </div>

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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 16 }}>
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
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--color-ink-2)" }}>
                  <input type="checkbox" checked={expenseForm.essential}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, essential: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: "var(--color-bronze)" }} />
                  Essential expense
                </label>
              </div>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loans.map((d) => (
            <div key={d.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="serif" style={{ fontSize: 16 }}>{d.name}</span>
                  <Badge label={LOAN_TYPE_LABELS[d.type] ?? d.type} />
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--color-ink-3)" }}>
                  {d.balance != null && <span>Balance: {fmtMoney(d.balance)}</span>}
                  {d.rate_pct != null && <span>{d.rate_pct}% APR</span>}
                  {d.balance != null && d.rate_pct != null && d.monthly_payment != null && (
                    <span>Payoff: {payoffMonths(d.balance, d.rate_pct, d.monthly_payment)}</span>
                  )}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 17, fontWeight: 500, color: "var(--color-ink)" }}>
                {fmtMoney(d.monthly_payment)}/mo
              </div>
              <RowActions onEdit={() => openEdit(d, "loan")} onDelete={() => setDebts(debts.filter((x) => x.id !== d.id))} />
            </div>
          ))}
        </div>
        {formMode === "loan" && (
          <form onSubmit={handleSubmitLoan} style={formStyle}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 16 }}>
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
              <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 10 }}>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {leases.map((d) => (
            <div key={d.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span className="serif" style={{ fontSize: 16 }}>{d.name}</span>
                  <Badge label="Lease" />
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--color-ink-3)", flexWrap: "wrap" }}>
                  {d.lease_months_remaining != null && <span>{d.lease_months_remaining}mo remaining</span>}
                  {d.lease_residual != null && <span>Residual: {fmtMoney(d.lease_residual)}</span>}
                  {d.lease_end_decision && <span style={{ textTransform: "capitalize" }}>At term: {d.lease_end_decision}</span>}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 17, fontWeight: 500, color: "var(--color-ink)" }}>
                {fmtMoney(d.lease_monthly_payment)}/mo
              </div>
              <RowActions onEdit={() => openEdit(d, "lease")} onDelete={() => setDebts(debts.filter((x) => x.id !== d.id))} />
            </div>
          ))}
        </div>
        {formMode === "lease" && (
          <form onSubmit={handleSubmitLease} style={formStyle}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)", marginBottom: 16 }}>
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

// ── Small shared components ───────────────────────────────────────────────────

function Section({ title, count, onAdd, addLabel, children }: {
  title: string; count: number; onAdd: () => void; addLabel: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-3)" }}>
          {title} {count > 0 && <span style={{ color: "var(--color-ink-4)", fontWeight: 400 }}>· {count}</span>}
        </div>
        <button onClick={onAdd} style={{ padding: "5px 14px", borderRadius: 8, border: "1px dashed var(--color-rule)", background: "transparent", color: "var(--color-ink-2)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          {addLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function ExpenseRow({ expense, onEdit, onDelete }: { expense: RetirementExpense; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={rowStyle}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="serif" style={{ fontSize: 16 }}>{expense.name}</span>
          {expense.category && (
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: expense.essential ? "var(--color-green)" : "var(--color-ink-3)", background: expense.essential ? "rgba(42,157,143,0.1)" : "var(--color-paper-deep)", padding: "2px 7px", borderRadius: 8 }}>
              {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
            </span>
          )}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 17, fontWeight: 500, color: "var(--color-ink)" }}>
        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(expense.monthly_amount)}/mo
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-bronze-dark)", background: "rgba(139,106,71,0.1)", padding: "2px 7px", borderRadius: 8 }}>
      {label}
    </span>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={onEdit} style={editBtnStyle}>Edit</button>
      <button onClick={onDelete} style={deleteBtnStyle}>Remove</button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: "var(--color-ink-4)", paddingLeft: 4, paddingBottom: 8 }}>{text}</div>;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const groupLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
  color: "var(--color-ink-4)", marginBottom: 8,
};

const rowStyle: React.CSSProperties = {
  background: "var(--color-paper-card)", border: "1px solid var(--color-rule)",
  borderRadius: 10, padding: "14px 18px", boxShadow: "var(--shadow-card)",
  display: "flex", alignItems: "center", gap: 14,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--color-ink-3)", display: "block", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid var(--color-rule)",
  borderRadius: 8, background: "var(--color-paper)", color: "var(--color-ink)",
  fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid var(--color-rule)",
  borderRadius: 8, background: "var(--color-paper)", color: "var(--color-ink)",
  fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

const formStyle: React.CSSProperties = {
  background: "var(--color-paper-card)", border: "1px solid var(--color-rule)",
  borderRadius: 12, padding: "20px 24px", boxShadow: "var(--shadow-card)", marginTop: 12,
};

const editBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 7, border: "1px solid var(--color-rule)",
  background: "var(--color-paper)", color: "var(--color-ink-2)", fontSize: 12,
  cursor: "pointer", fontFamily: "inherit",
};

const deleteBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 7, border: "1px solid rgba(154,59,42,0.3)",
  background: "rgba(154,59,42,0.05)", color: "var(--color-red)", fontSize: 12,
  cursor: "pointer", fontFamily: "inherit",
};

const submitBtnStyle: React.CSSProperties = {
  padding: "9px 22px", borderRadius: 9, border: "1px solid var(--color-bronze-dark)",
  background: "var(--color-bronze)", color: "#FBF8F1", fontSize: 13, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "9px 18px", borderRadius: 9, border: "1px solid var(--color-rule)",
  background: "transparent", color: "var(--color-ink-2)", fontSize: 13,
  cursor: "pointer", fontFamily: "inherit",
};
