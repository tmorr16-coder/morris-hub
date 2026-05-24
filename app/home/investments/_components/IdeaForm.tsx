"use client";

import { useState } from "react";
import { addInvestmentIdea } from "@/app/home/actions";
import { CATEGORY_LABELS } from "@/lib/investment-ideas-constants";

interface IdeaFormProps {
  onClose: () => void;
  categories: string[];
}

export default function IdeaForm({ onClose, categories }: IdeaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: categories[0] || "stocks",
    title: "",
    rationale: "",
    riskLevel: "medium" as const,
    timeHorizon: "medium" as const,
    capitalRequired: "",
    expectedReturns: "",
    actionItems: [""],
    relatedAssets: [""],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);

    const result = await addInvestmentIdea({
      category: formData.category,
      title: formData.title.trim(),
      rationale: formData.rationale || null,
      risk_level: formData.riskLevel || null,
      time_horizon: formData.timeHorizon || null,
      capital_required: formData.capitalRequired || null,
      expected_returns: formData.expectedReturns || null,
      action_items: formData.actionItems.filter((a) => a.trim()) || null,
      related_assets: formData.relatedAssets.filter((a) => a.trim()) || null,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      onClose();
    }
  };

  const modal: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };

  const card: React.CSSProperties = {
    background: "var(--color-bg-card)",
    borderRadius: 12,
    padding: "32px",
    maxWidth: 500,
    width: "calc(100% - 40px)",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "var(--shadow-card), 0 20px 25px rgba(0,0,0,0.15)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--color-rule)",
    background: "var(--color-bg)",
    color: "var(--color-ink)",
    fontSize: 13,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div style={modal} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 24, marginBottom: 20 }}>Add Investment Idea</h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--color-red)" + "20",
                color: "var(--color-red)",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {/* Category */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
              CATEGORY *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              style={inputStyle}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
              TITLE *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Invest in Tech ETFs"
              style={inputStyle}
            />
          </div>

          {/* Rationale */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
              RATIONALE
            </label>
            <textarea
              value={formData.rationale}
              onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
              placeholder="Why is this a good investment idea?"
              style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
            />
          </div>

          {/* Risk Level & Time Horizon */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                RISK LEVEL
              </label>
              <select
                value={formData.riskLevel}
                onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value as any })}
                style={inputStyle}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                TIME HORIZON
              </label>
              <select
                value={formData.timeHorizon}
                onChange={(e) => setFormData({ ...formData, timeHorizon: e.target.value as any })}
                style={inputStyle}
              >
                <option value="short">Short-term (&lt;1yr)</option>
                <option value="medium">Medium-term (1-5yr)</option>
                <option value="long">Long-term (5yr+)</option>
              </select>
            </div>
          </div>

          {/* Capital & Returns */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                CAPITAL REQUIRED
              </label>
              <input
                type="text"
                value={formData.capitalRequired}
                onChange={(e) => setFormData({ ...formData, capitalRequired: e.target.value })}
                placeholder="e.g., $10k-50k"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                EXPECTED RETURNS
              </label>
              <input
                type="text"
                value={formData.expectedReturns}
                onChange={(e) => setFormData({ ...formData, expectedReturns: e.target.value })}
                placeholder="e.g., 15-20% annually"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Related Assets */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600 }}>RELATED ASSETS</label>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    relatedAssets: [...formData.relatedAssets, ""],
                  })
                }
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-accent)",
                  fontSize: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                + Add
              </button>
            </div>
            {formData.relatedAssets.map((asset, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  type="text"
                  value={asset}
                  onChange={(e) => {
                    const newAssets = [...formData.relatedAssets];
                    newAssets[i] = e.target.value;
                    setFormData({ ...formData, relatedAssets: newAssets });
                  }}
                  placeholder="e.g., AAPL, VNQ"
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      relatedAssets: formData.relatedAssets.filter((_, idx) => idx !== i),
                    });
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--color-rule)",
                    borderRadius: 6,
                    padding: "10px 8px",
                    color: "var(--color-ink-3)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Action Items */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600 }}>ACTION ITEMS</label>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    actionItems: [...formData.actionItems, ""],
                  })
                }
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-accent)",
                  fontSize: 10,
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                + Add
              </button>
            </div>
            {formData.actionItems.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...formData.actionItems];
                    newItems[i] = e.target.value;
                    setFormData({ ...formData, actionItems: newItems });
                  }}
                  placeholder="e.g., Research company fundamentals"
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      actionItems: formData.actionItems.filter((_, idx) => idx !== i),
                    });
                  }}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--color-rule)",
                    borderRadius: 6,
                    padding: "10px 8px",
                    color: "var(--color-ink-3)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid var(--color-rule)",
                background: "transparent",
                color: "var(--color-ink-2)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "var(--color-accent)",
                color: "#FFFDF8",
                fontSize: 13,
                fontWeight: 500,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? "Creating..." : "Create Idea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
