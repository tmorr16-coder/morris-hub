"use client";

import { useState } from "react";
import type { RetirementProfile, RetirementIncome } from "../types";

interface Props {
  profile: RetirementProfile;
  onAddIncome: (income: RetirementIncome) => void;
}

interface SSOption {
  claimAge: number;
  label: string;
  selfMonthly: number;
  spouseMonthly: number | null;
  breakEvenVs62: number | null;
  breakEvenVsFRA: number | null;
}

// Returns monthly benefit as a fraction of FRA benefit based on claim age.
// FRA = 67 for those born 1960+.
function benefitFactor(claimAge: number, fraAge = 67): number {
  if (claimAge >= fraAge) {
    const delayYears = Math.min(claimAge - fraAge, 3);
    return 1 + delayYears * 0.08;
  }
  const monthsEarly = (fraAge - claimAge) * 12;
  // First 36 months early: 5/9 of 1% per month = 0.005556/mo
  // Beyond 36 months early: 5/12 of 1% per month = 0.004167/mo
  const first36 = Math.min(monthsEarly, 36) * (5 / 9 / 100);
  const beyond36 = Math.max(monthsEarly - 36, 0) * (5 / 12 / 100);
  return 1 - first36 - beyond36;
}

// Break-even age (in whole years) vs a lower claim age.
// Returns null if delay never pays off.
function breakEvenAge(
  earlyClaimAge: number,
  lateClaimAge: number,
  fraMonthly: number,
  fraAge = 67
): number | null {
  const earlyMonthly = fraMonthly * benefitFactor(earlyClaimAge, fraAge);
  const lateMonthly = fraMonthly * benefitFactor(lateClaimAge, fraAge);
  if (lateMonthly <= earlyMonthly) return null;

  // Cumulative benefit from earlyClaimAge — lateClaimAge: earlyMonthly × months
  const monthsGapOfLost = (lateClaimAge - earlyClaimAge) * 12;
  const lostByWaiting = earlyMonthly * monthsGapOfLost;
  const monthlyGain = lateMonthly - earlyMonthly;
  const monthsToRecoup = lostByWaiting / monthlyGain;
  const breakEvenYears = lateClaimAge + monthsToRecoup / 12;
  if (breakEvenYears > 100) return null;
  return Math.round(breakEvenYears);
}

const CLAIM_AGES = [62, 63, 64, 65, 66, 67, 68, 69, 70];

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function SSOptimizer({ profile, onAddIncome }: Props) {
  const [selfFRA, setSelfFRA] = useState("");
  const [spouseFRA, setSpouseFRA] = useState("");
  const [selectedSelfAge, setSelectedSelfAge] = useState<number | null>(null);
  const [selectedSpouseAge, setSelectedSpouseAge] = useState<number | null>(null);

  const selfFRANum = parseFloat(selfFRA) || 0;
  const spouseFRANum = parseFloat(spouseFRA) || 0;

  function buildOptions(fraMonthly: number, spouseMonthly: number | null): SSOption[] {
    return CLAIM_AGES.map((age) => {
      const selfAmt = fraMonthly * benefitFactor(age);
      // Spousal benefit: max(own benefit, 50% of spouse FRA) — applies only at own FRA+ for spouse portion
      // Simplified: if spouse FRA > 0, show the higher of own or 50% of spouse's FRA
      const spouseOwnAmt = spouseMonthly !== null ? spouseMonthly * benefitFactor(age) : null;
      const spousalBenefit = spouseMonthly !== null ? spouseMonthly * 0.5 : null;

      return {
        claimAge: age,
        label: age === 67 ? "67 (FRA)" : age === 62 ? "62 (earliest)" : age === 70 ? "70 (max)" : String(age),
        selfMonthly: selfAmt,
        spouseMonthly: spouseOwnAmt !== null && spousalBenefit !== null
          ? Math.max(spouseOwnAmt, spousalBenefit)
          : null,
        breakEvenVs62: age > 62 ? breakEvenAge(62, age, fraMonthly) : null,
        breakEvenVsFRA: age > 67 ? breakEvenAge(67, age, fraMonthly) : null,
      };
    });
  }

  const selfOptions = selfFRANum > 0 ? buildOptions(selfFRANum, spouseFRANum > 0 ? spouseFRANum : null) : [];
  const spouseOptions = spouseFRANum > 0 ? buildOptions(spouseFRANum, selfFRANum > 0 ? selfFRANum : null) : [];

  function handleAddSelf() {
    if (!selectedSelfAge || selfFRANum <= 0) return;
    const opt = selfOptions.find((o) => o.claimAge === selectedSelfAge);
    if (!opt) return;
    const inc: RetirementIncome = {
      id: crypto.randomUUID(),
      profile_id: "",
      name: "Social Security — Self",
      type: "social_security",
      owner: "self",
      monthly_amount: Math.round(opt.selfMonthly),
      frequency: "monthly",
      annual_growth_pct: null,
      vest_years: null,
      start_age: null,
      end_age: null,
      ss_claim_age: selectedSelfAge,
      sort_order: 0,
      created_at: new Date().toISOString(),
    };
    onAddIncome(inc);
    setSelectedSelfAge(null);
  }

  function handleAddSpouse() {
    if (!selectedSpouseAge || spouseFRANum <= 0) return;
    const opt = spouseOptions.find((o) => o.claimAge === selectedSpouseAge);
    if (!opt) return;
    const inc: RetirementIncome = {
      id: crypto.randomUUID(),
      profile_id: "",
      name: `Social Security — ${profile.spouse_name ?? "Spouse"}`,
      type: "social_security",
      owner: "spouse",
      monthly_amount: Math.round(opt.selfMonthly),
      frequency: "monthly",
      annual_growth_pct: null,
      vest_years: null,
      start_age: null,
      end_age: null,
      ss_claim_age: selectedSpouseAge,
      sort_order: 0,
      created_at: new Date().toISOString(),
    };
    onAddIncome(inc);
    setSelectedSpouseAge(null);
  }

  const showSurvivorNote = selfFRANum > 0 && spouseFRANum > 0;
  const survivorBenefit = Math.max(selfFRANum, spouseFRANum);

  return (
    <div
      style={{
        background: "var(--color-paper-card)",
        border: "1px solid var(--color-rule)",
        borderRadius: 12,
        padding: "20px 24px",
        boxShadow: "var(--shadow-card)",
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <h3 className="serif" style={{ fontSize: 20 }}>Social Security Optimizer</h3>
        <span style={{ fontSize: 11, color: "var(--color-ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          timing analysis
        </span>
      </div>
      <p style={{ fontSize: 13, color: "var(--color-ink-3)", lineHeight: 1.5, marginBottom: 18 }}>
        Enter your estimated benefit at full retirement age (67) from{" "}
        <span style={{ color: "var(--color-bronze-dark)", fontWeight: 500 }}>ssa.gov/myaccount</span>.
        See how timing affects your lifetime income.
      </p>

      {/* FRA inputs */}
      <div style={{ display: "grid", gridTemplateColumns: profile.spouse_enabled ? "1fr 1fr" : "1fr", gap: 14, marginBottom: 20 }}>
        <div>
          <label style={labelStyle}>Your FRA benefit (at age 67) / month</label>
          <input
            type="number"
            min="0"
            step="1"
            value={selfFRA}
            onChange={(e) => setSelfFRA(e.target.value)}
            placeholder="e.g. 2800"
            style={inputStyle}
          />
        </div>
        {profile.spouse_enabled && (
          <div>
            <label style={labelStyle}>{profile.spouse_name ?? "Spouse"} FRA benefit / month</label>
            <input
              type="number"
              min="0"
              step="1"
              value={spouseFRA}
              onChange={(e) => setSpouseFRA(e.target.value)}
              placeholder="e.g. 1800"
              style={inputStyle}
            />
          </div>
        )}
      </div>

      {/* Survivor note */}
      {showSurvivorNote && (
        <div
          style={{
            background: "rgba(139,106,71,0.07)",
            border: "1px solid rgba(139,106,71,0.2)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--color-ink-2)",
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          <strong>Survivor benefit:</strong> When one spouse dies, the survivor receives the higher of the two
          benefits — estimated {fmtMoney(survivorBenefit)}/mo. This is automatically modeled in your projection.
        </div>
      )}

      {selfFRANum > 0 && (
        <SSOptionTable
          label="Your options"
          options={selfOptions}
          selectedAge={selectedSelfAge}
          onSelect={setSelectedSelfAge}
          showSpousal={spouseFRANum > 0}
          spouseName={profile.spouse_name}
          onAdd={handleAddSelf}
        />
      )}

      {profile.spouse_enabled && spouseFRANum > 0 && (
        <SSOptionTable
          label={`${profile.spouse_name ?? "Spouse"}'s options`}
          options={spouseOptions}
          selectedAge={selectedSpouseAge}
          onSelect={setSelectedSpouseAge}
          showSpousal={selfFRANum > 0}
          spouseName="Self"
          onAdd={handleAddSpouse}
        />
      )}

      {selfFRANum <= 0 && (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--color-ink-3)", fontSize: 13 }}>
          Enter your FRA benefit above to see your options.
        </div>
      )}
    </div>
  );
}

interface TableProps {
  label: string;
  options: SSOption[];
  selectedAge: number | null;
  onSelect: (age: number) => void;
  showSpousal: boolean;
  spouseName: string | null;
  onAdd: () => void;
}

function SSOptionTable({ label, options, selectedAge, onSelect, onAdd }: TableProps) {
  const selected = options.find((o) => o.claimAge === selectedAge);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10 }}>
        {label}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
        {options.map((opt) => {
          const isSelected = opt.claimAge === selectedAge;
          return (
            <button
              key={opt.claimAge}
              onClick={() => onSelect(opt.claimAge)}
              style={{
                padding: "12px 10px",
                borderRadius: 10,
                border: `2px solid ${isSelected ? "var(--color-bronze)" : "var(--color-rule)"}`,
                background: isSelected ? "rgba(139,106,71,0.08)" : "var(--color-paper)",
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "center",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: isSelected ? "var(--color-bronze-dark)" : "var(--color-ink-3)", letterSpacing: "0.04em", marginBottom: 4 }}>
                Age {opt.label}
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--color-ink)", marginBottom: 4 }}>
                {fmtMoney(opt.selfMonthly)}
              </div>
              <div style={{ fontSize: 10, color: "var(--color-ink-3)" }}>per month</div>
              {opt.breakEvenVs62 && (
                <div style={{ fontSize: 10, color: "var(--color-ink-4)", marginTop: 6, borderTop: "1px solid var(--color-rule)", paddingTop: 6 }}>
                  Beats age-62 at {opt.breakEvenVs62}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 16px",
            background: "var(--color-paper-deep)",
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
            Claiming at <strong>{selected.label}</strong>: {fmtMoney(selected.selfMonthly)}/mo
            {selected.breakEvenVs62 && (
              <span style={{ color: "var(--color-ink-3)" }}>
                {" "}· pays off vs age 62 at age {selected.breakEvenVs62}
              </span>
            )}
          </div>
          <button
            onClick={onAdd}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid var(--color-bronze-dark)",
              background: "var(--color-bronze)",
              color: "#FBF8F1",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            Add to plan
          </button>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-ink-3)",
  display: "block",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--color-rule)",
  borderRadius: 8,
  background: "var(--color-paper)",
  color: "var(--color-ink)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
