"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { addInvestmentIdea } from "@/app/home/actions";
import { CATEGORY_LABELS } from "@/lib/investment-ideas-constants";
import { Icons } from "@/components/ios";

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

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--ios-label-2)",
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 10,
    border: "var(--ios-hair) solid var(--ios-separator)",
    background: "var(--ios-fill-2)",
    color: "var(--ios-label)",
    fontSize: 16,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const addBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    background: "transparent",
    border: "none",
    color: "var(--ios-tint)",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 600,
    padding: 0,
  };

  const removeBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--ios-fill)",
    border: "none",
    borderRadius: 10,
    padding: "0 12px",
    color: "var(--ios-label-3)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 18,
    lineHeight: 1,
  };

  return (
    <div className="ios-sheet-backdrop" onClick={onClose}>
      <div className="ios-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ios-grabber" />
        <h2 className="ios-title-2" style={{ margin: "0 0 16px" }}>Add Investment Idea</h2>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "color-mix(in srgb, var(--ios-red) 14%, transparent)",
                color: "var(--ios-red)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* Category */}
          <div>
            <label style={labelStyle}>Category *</label>
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
            <label style={labelStyle}>Title *</label>
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
            <label style={labelStyle}>Rationale</label>
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
              <label style={labelStyle}>Risk Level</label>
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
              <label style={labelStyle}>Time Horizon</label>
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
              <label style={labelStyle}>Capital Required</label>
              <input
                type="text"
                value={formData.capitalRequired}
                onChange={(e) => setFormData({ ...formData, capitalRequired: e.target.value })}
                placeholder="e.g., $10k-50k"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Expected Returns</label>
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
              <label style={{ ...labelStyle, marginBottom: 0 }}>Related Assets</label>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    relatedAssets: [...formData.relatedAssets, ""],
                  })
                }
                style={addBtnStyle}
              >
                <Icons.PlusIcon style={{ width: 13, height: 13 }} />
                Add
              </button>
            </div>
            {formData.relatedAssets.map((asset, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={asset}
                  onChange={(e) => {
                    const newAssets = [...formData.relatedAssets];
                    newAssets[i] = e.target.value;
                    setFormData({ ...formData, relatedAssets: newAssets });
                  }}
                  placeholder="e.g., AAPL, VNQ"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      relatedAssets: formData.relatedAssets.filter((_, idx) => idx !== i),
                    });
                  }}
                  aria-label="Remove asset"
                  style={removeBtnStyle}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Action Items */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Action Items</label>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    actionItems: [...formData.actionItems, ""],
                  })
                }
                style={addBtnStyle}
              >
                <Icons.PlusIcon style={{ width: 13, height: 13 }} />
                Add
              </button>
            </div>
            {formData.actionItems.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...formData.actionItems];
                    newItems[i] = e.target.value;
                    setFormData({ ...formData, actionItems: newItems });
                  }}
                  placeholder="e.g., Research company fundamentals"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      actionItems: formData.actionItems.filter((_, idx) => idx !== i),
                    });
                  }}
                  aria-label="Remove action item"
                  style={removeBtnStyle}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="ios-btn ios-btn--primary"
              style={{ opacity: isSubmitting ? 0.5 : 1, cursor: isSubmitting ? "not-allowed" : "pointer" }}
            >
              {isSubmitting ? "Creating…" : "Create Idea"}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "13px 20px",
                borderRadius: 12,
                minHeight: 50,
                border: "none",
                background: "var(--ios-fill)",
                color: "var(--ios-label)",
                fontSize: 17,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
