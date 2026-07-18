"use client";

import type { RetirementProfile, RetirementScenario } from "../types";

interface Props {
  profile: RetirementProfile;
  setProfile: (p: RetirementProfile) => void;
  scenario: RetirementScenario;
  setScenario: (s: RetirementScenario) => void;
}

interface ScenarioCard {
  key: "lean" | "balanced" | "abundant" | "custom";
  label: string;
  description: string;
}

const SCENARIO_CARDS: ScenarioCard[] = [
  { key: "lean", label: "Lean & Purposeful", description: "Essentials + modest discretionary. Maximizes runway." },
  { key: "balanced", label: "Balanced Living", description: "Comfortable lifestyle with travel and hobbies." },
  { key: "abundant", label: "Abundant & Active", description: "Premium experiences, generous gifting, luxury travel." },
  { key: "custom", label: "Custom", description: "Define your own monthly spending target." },
];

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ScenariosTab({ profile, setProfile, scenario, setScenario }: Props) {
  function updateProfile(field: keyof RetirementProfile, value: unknown) {
    setProfile({ ...profile, [field]: value });
  }

  function updateScenario(field: keyof RetirementScenario, value: unknown) {
    setScenario({ ...scenario, [field]: value });
  }

  function spendKey(key: string): keyof RetirementScenario {
    return `${key}_monthly_spend` as keyof RetirementScenario;
  }

  return (
    <div>
      {/* Profile settings card */}
      <div className="ios-list" style={{ margin: "0 0 8px", padding: 18 }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 16 }}>
          Profile settings
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
          <div>
            <label style={labelStyle}>Current age</label>
            <input
              type="number"
              min="18"
              max="100"
              value={profile.current_age}
              onChange={(e) => updateProfile("current_age", parseInt(e.target.value) || 40)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Retirement age</label>
            <input
              type="number"
              min="40"
              max="100"
              value={profile.retirement_age}
              onChange={(e) => updateProfile("retirement_age", parseInt(e.target.value) || 65)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Life expectancy</label>
            <input
              type="number"
              min="60"
              max="120"
              value={profile.life_expectancy}
              onChange={(e) => updateProfile("life_expectancy", parseInt(e.target.value) || 90)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Expected return (%/yr)</label>
            <input
              type="number"
              min="0"
              max="30"
              step="0.1"
              value={(profile.base_return * 100).toFixed(1)}
              onChange={(e) => updateProfile("base_return", (parseFloat(e.target.value) || 7) / 100)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Retirement return (%/yr)</label>
            <input
              type="number"
              min="0"
              max="30"
              step="0.1"
              value={profile.retirement_return != null ? (profile.retirement_return * 100).toFixed(1) : ""}
              onChange={(e) => updateProfile("retirement_return", e.target.value === "" ? null : (parseFloat(e.target.value) || 0) / 100)}
              placeholder={`same (${(profile.base_return * 100).toFixed(1)}%)`}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Inflation rate (%/yr)</label>
            <input
              type="number"
              min="0"
              max="20"
              step="0.1"
              value={(profile.inflation_rate * 100).toFixed(1)}
              onChange={(e) => updateProfile("inflation_rate", (parseFloat(e.target.value) || 3) / 100)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Home value ($)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={scenario.home_value ?? 0}
              onChange={(e) => updateScenario("home_value", parseFloat(e.target.value) || 0)}
              placeholder="Zillow Zestimate"
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Home address (optional)</label>
            <input
              type="text"
              value={scenario.home_address ?? ""}
              onChange={(e) => updateScenario("home_address", e.target.value)}
              placeholder="123 Main St — look up your estimate on zillow.com"
              style={inputStyle}
            />
            <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 4 }}>
              Added to net worth (home value − mortgage). Not counted as spendable retirement portfolio.{" "}
              <a href="https://www.zillow.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ios-tint)" }}>Get your Zestimate ↗</a>
            </div>
          </div>
        </div>

        {/* Spouse toggle */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--ios-separator)" }}>
          <label
            className="ios-subhead"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              color: "var(--ios-label)",
            }}
          >
            <input
              type="checkbox"
              checked={profile.spouse_enabled}
              onChange={(e) => updateProfile("spouse_enabled", e.target.checked)}
              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--ios-tint)" }}
            />
            <span style={{ fontWeight: 500 }}>Include spouse in plan</span>
          </label>

          {profile.spouse_enabled && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 14,
                marginTop: 14,
              }}
            >
              <div>
                <label style={labelStyle}>Spouse name</label>
                <input
                  value={profile.spouse_name ?? ""}
                  onChange={(e) => updateProfile("spouse_name", e.target.value || null)}
                  placeholder="Name"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Spouse age</label>
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={profile.spouse_age ?? ""}
                  onChange={(e) =>
                    updateProfile("spouse_age", e.target.value ? parseInt(e.target.value) : null)
                  }
                  placeholder="Age"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Spouse retirement age</label>
                <input
                  type="number"
                  min="40"
                  max="100"
                  value={profile.spouse_retirement_age ?? ""}
                  onChange={(e) =>
                    updateProfile(
                      "spouse_retirement_age",
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  placeholder="65"
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scenario picker */}
      <div className="ios-group-header" style={{ padding: "16px 0 7px" }}>
        Lifestyle scenario
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 8,
        }}
      >
        {SCENARIO_CARDS.map((card) => {
          const active = scenario.selected_scenario === card.key;
          const monthlySpend = scenario[spendKey(card.key)] as number;
          return (
            <div
              key={card.key}
              onClick={() => updateScenario("selected_scenario", card.key)}
              className="ios-list"
              style={{
                margin: 0,
                padding: "16px 18px",
                cursor: "pointer",
                boxShadow: active ? "inset 0 0 0 2px var(--ios-tint)" : "inset 0 0 0 1px var(--ios-separator)",
              }}
            >
              <div
                className="ios-subhead"
                style={{
                  fontWeight: 600,
                  color: active ? "var(--ios-tint)" : "var(--ios-label)",
                  marginBottom: 6,
                }}
              >
                {card.label}
              </div>
              <div className="ios-num" style={{ fontSize: 22, fontWeight: 700, color: "var(--ios-label)", marginBottom: 6 }}>
                {fmtMoney(monthlySpend)}/mo
              </div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
                {card.description}
              </div>
              {card.key === "custom" && active && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ ...labelStyle, display: "block", marginBottom: 4 }}>
                    Monthly spend ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={scenario.custom_monthly_spend}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateScenario("custom_monthly_spend", parseFloat(e.target.value) || 0)
                    }
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Additional scenario parameters */}
      <div className="ios-list" style={{ margin: "8px 0 0", padding: 18 }}>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 16 }}>
          Additional parameters
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          <div>
            <label style={labelStyle}>Annual travel ($)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={scenario.annual_travel}
              onChange={(e) => updateScenario("annual_travel", parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Health premium · pre-65 ($/mo)</label>
            <input
              type="number" min="0" step="10"
              value={scenario.monthly_health_premium}
              onChange={(e) => updateScenario("monthly_health_premium", parseFloat(e.target.value) || 0)}
              placeholder="ACA / COBRA"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Health premium · 65+ ($/mo)</label>
            <input
              type="number" min="0" step="10"
              value={scenario.health_premium_medicare ?? ""}
              onChange={(e) => updateScenario("health_premium_medicare", e.target.value === "" ? null : (parseFloat(e.target.value) || 0))}
              placeholder="Medicare + supplement"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Healthcare inflation (%/yr)</label>
            <input
              type="number" min="0" max="15" step="0.1"
              value={scenario.healthcare_inflation ?? ""}
              onChange={(e) => updateScenario("healthcare_inflation", e.target.value === "" ? null : (parseFloat(e.target.value) || 0))}
              placeholder={`${(profile.inflation_rate * 100).toFixed(1)} (try 5)`}
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: "1 / -1", paddingTop: 4 }}>
            <label className="ios-subhead" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "var(--ios-label)" }}>
              <input type="checkbox" checked={!!scenario.ltc_enabled}
                onChange={(e) => updateScenario("ltc_enabled", e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--ios-tint)" }} />
              Model long-term care (late-life)
            </label>
            {scenario.ltc_enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginTop: 10 }}>
                <div>
                  <label style={labelStyle}>LTC cost ($/mo)</label>
                  <input type="number" min="0" step="500" value={scenario.ltc_monthly_cost ?? ""}
                    onChange={(e) => updateScenario("ltc_monthly_cost", e.target.value === "" ? null : (parseFloat(e.target.value) || 0))}
                    placeholder="8000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Starts at age</label>
                  <input type="number" min="60" max="110" value={scenario.ltc_start_age ?? ""}
                    onChange={(e) => updateScenario("ltc_start_age", e.target.value === "" ? null : (parseInt(e.target.value) || 0))}
                    placeholder={String(Math.max(profile.retirement_age, profile.life_expectancy - (scenario.ltc_years ?? 3)))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>For (years)</label>
                  <input type="number" min="1" max="20" value={scenario.ltc_years ?? ""}
                    onChange={(e) => updateScenario("ltc_years", e.target.value === "" ? null : (parseInt(e.target.value) || 0))}
                    placeholder="3" style={inputStyle} />
                </div>
              </div>
            )}
            <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>
              Healthcare is age-banded (pre-65 ACA/COBRA → Medicare at 65), inflates at its own rate, and IRMAA surcharges
              are added automatically for high incomes.
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1", paddingTop: 4 }}>
            <label className="ios-subhead" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "var(--ios-label)" }}>
              <input type="checkbox" checked={!!scenario.roth_convert_enabled}
                onChange={(e) => updateScenario("roth_convert_enabled", e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--ios-tint)" }} />
              Roth conversions (pre-tax → Roth)
            </label>
            {scenario.roth_convert_enabled && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginTop: 10 }}>
                <div>
                  <label style={labelStyle}>Convert / year ($)</label>
                  <input type="number" min="0" step="5000" value={scenario.roth_convert_annual ?? ""}
                    onChange={(e) => updateScenario("roth_convert_annual", e.target.value === "" ? null : (parseFloat(e.target.value) || 0))}
                    placeholder="100000" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>From age</label>
                  <input type="number" min="50" max="75" value={scenario.roth_convert_start_age ?? ""}
                    onChange={(e) => updateScenario("roth_convert_start_age", e.target.value === "" ? null : (parseInt(e.target.value) || 0))}
                    placeholder={String(profile.retirement_age)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>To age</label>
                  <input type="number" min="50" max="75" value={scenario.roth_convert_end_age ?? ""}
                    onChange={(e) => updateScenario("roth_convert_end_age", e.target.value === "" ? null : (parseInt(e.target.value) || 0))}
                    placeholder="72" style={inputStyle} />
                </div>
              </div>
            )}
            <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>
              Converts pre-tax to Roth in your low-income years (retirement → before RMDs at 73), taxed as ordinary income
              now to cut future RMDs, IRMAA and heirs&apos; taxes. The impact vs. no conversions shows on the Projection tab.
            </div>
          </div>
          <div>
            <label style={labelStyle}>Housing windfall ($)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={scenario.housing_windfall}
              onChange={(e) => updateScenario("housing_windfall", parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Legacy goal ($)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={scenario.legacy_goal}
              onChange={(e) => updateScenario("legacy_goal", parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
          {profile.spouse_enabled && (
            <div>
              <label style={labelStyle}>Survivor spend (% of joint)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={scenario.survivor_spend_pct}
                onChange={(e) => updateScenario("survivor_spend_pct", parseFloat(e.target.value) || 75)}
                style={inputStyle}
              />
            </div>
          )}
        </div>

        {/* Scenario spend overrides */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--ios-separator)" }}>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
            Adjust scenario spend levels
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {(["lean", "balanced", "abundant"] as const).map((key) => (
              <div key={key}>
                <label style={labelStyle}>{key.charAt(0).toUpperCase() + key.slice(1)} ($)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={scenario[spendKey(key)] as number}
                  onChange={(e) => updateScenario(spendKey(key), parseFloat(e.target.value) || 0)}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
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
