"use client";

import { useState } from "react";
import type { RetirementProfile, RetirementIncome } from "../types";
// The claim-age factor now lives in the cashflow library, where the projection
// engine can reach it too. This screen used to own a correct copy that the
// projection never called, so the optimiser and the plan disagreed silently.
import { ssBenefitFactor as benefitFactor } from "../_lib/cashflow";

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
      match_eligible: false,
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
      match_eligible: false,
      sort_order: 0,
      created_at: new Date().toISOString(),
    };
    onAddIncome(inc);
    setSelectedSpouseAge(null);
  }

  const showSurvivorNote = selfFRANum > 0 && spouseFRANum > 0;
  const survivorBenefit = Math.max(selfFRANum, spouseFRANum);

  return (
    <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <h3 className="ios-title-3">Social Security Optimizer</h3>
        <span className="ios-footnote" style={{ color: "var(--ios-label-2)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
          timing analysis
        </span>
      </div>
      <p className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5, marginBottom: 18 }}>
        Enter your estimated benefit at full retirement age (67) from{" "}
        <span style={{ color: "var(--ios-tint)", fontWeight: 500 }}>ssa.gov/myaccount</span>.
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
          className="ios-footnote"
          style={{
            background: "var(--ios-fill-2)",
            borderRadius: 8,
            padding: "10px 14px",
            color: "var(--ios-label)",
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          <strong>Survivor benefit:</strong> When one spouse dies, the survivor receives the higher of the two
          benefits — estimated <span className="ios-num">{fmtMoney(survivorBenefit)}</span>/mo. Shown here for planning; the
          projection currently runs a single combined household and does not yet model the first-death income drop.
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
        <div className="ios-footnote" style={{ textAlign: "center", padding: "20px 0", color: "var(--ios-label-2)" }}>
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
      <div className="ios-footnote" style={{ letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--ios-label-2)", marginBottom: 10 }}>
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
                background: "var(--ios-fill-2)",
                boxShadow: isSelected ? "inset 0 0 0 2px var(--ios-tint)" : "inset 0 0 0 1px var(--ios-separator)",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div className="ios-caption" style={{ fontWeight: 600, color: isSelected ? "var(--ios-tint)" : "var(--ios-label-2)", letterSpacing: "0.02em", marginBottom: 4 }}>
                Age {opt.label}
              </div>
              <div className="ios-num" style={{ fontSize: 18, fontWeight: 700, color: "var(--ios-label)", marginBottom: 4 }}>
                {fmtMoney(opt.selfMonthly)}
              </div>
              <div className="ios-caption" style={{ color: "var(--ios-label-2)" }}>per month</div>
              {opt.breakEvenVs62 && (
                <div className="ios-caption ios-num" style={{ color: "var(--ios-label-3)", marginTop: 6, borderTop: "1px solid var(--ios-separator)", paddingTop: 6 }}>
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
            background: "var(--ios-fill-2)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div className="ios-footnote" style={{ color: "var(--ios-label)" }}>
            Claiming at <strong>{selected.label}</strong>: <span className="ios-num">{fmtMoney(selected.selfMonthly)}</span>/mo
            {selected.breakEvenVs62 && (
              <span style={{ color: "var(--ios-label-2)" }}>
                {" "}· pays off vs age 62 at age {selected.breakEvenVs62}
              </span>
            )}
          </div>
          <button
            onClick={onAdd}
            style={{
              padding: "9px 18px",
              borderRadius: 999,
              background: "var(--ios-tint)",
              color: "var(--ios-on-tint)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
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
  fontSize: 13,
  fontWeight: 400,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
  color: "var(--ios-label-2)",
  display: "block",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid var(--ios-separator)",
  borderRadius: 8,
  background: "var(--ios-bg)",
  color: "var(--ios-label)",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};
