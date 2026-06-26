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
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 16,
          }}
        >
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
        </div>

        {/* Spouse toggle */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-rule)" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              fontSize: 13,
              color: "var(--color-ink)",
            }}
          >
            <input
              type="checkbox"
              checked={profile.spouse_enabled}
              onChange={(e) => updateProfile("spouse_enabled", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
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
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 14,
        }}
      >
        Lifestyle scenario
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {SCENARIO_CARDS.map((card) => {
          const active = scenario.selected_scenario === card.key;
          const monthlySpend = scenario[spendKey(card.key)] as number;
          return (
            <div
              key={card.key}
              onClick={() => updateScenario("selected_scenario", card.key)}
              style={{
                background: "var(--color-paper-card)",
                border: `2px solid ${active ? "var(--color-bronze)" : "var(--color-rule)"}`,
                borderRadius: 12,
                padding: "18px 20px",
                cursor: "pointer",
                boxShadow: active ? "var(--shadow-card)" : "none",
                transition: "border-color 120ms",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: active ? "var(--color-bronze-dark)" : "var(--color-ink)",
                  marginBottom: 6,
                }}
              >
                {card.label}
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 500, color: "var(--color-ink)", marginBottom: 6 }}>
                {fmtMoney(monthlySpend)}/mo
              </div>
              <div style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.5 }}>
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
      <div
        style={{
          background: "var(--color-paper-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 16,
          }}
        >
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
            <label style={labelStyle}>Monthly healthcare premium ($)</label>
            <input
              type="number"
              min="0"
              step="10"
              value={scenario.monthly_health_premium}
              onChange={(e) => updateScenario("monthly_health_premium", parseFloat(e.target.value) || 0)}
              style={inputStyle}
            />
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
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-rule)" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              marginBottom: 12,
            }}
          >
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
