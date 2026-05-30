"use client";

import { useState } from "react";
import type { InvestmentIdea } from "@/lib/investment-ideas-constants";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  TIME_HORIZON_LABELS,
  RISK_COLORS,
} from "@/lib/investment-ideas-constants";
import {
  updateIdeaStatus,
  rateIdea,
  toggleFavorite,
  updateIdeaNotes,
  deleteInvestmentIdea,
  addReminder,
} from "@/app/home/actions";

interface IdeaCardProps {
  idea: InvestmentIdea;
  isAiGenerated: boolean;
  onFavoriteToggle?: (ideaId: string, newStatus: boolean) => void;
}

export default function IdeaCard({ idea, isAiGenerated, onFavoriteToggle }: IdeaCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localStatus, setLocalStatus] = useState(idea.status);
  const [localRating, setLocalRating] = useState(idea.rating ?? 0);
  const [localFavorite, setLocalFavorite] = useState(idea.isFavorite);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState(idea.userNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  // Per-action-item reminder state so each button is independent
  const [reminderStates, setReminderStates] = useState<Record<number, "idle" | "saving" | "done">>({});

  const setReminderState = (index: number, state: "idle" | "saving" | "done") =>
    setReminderStates((prev) => ({ ...prev, [index]: state }));

  const handleStatusChange = async (newStatus: string) => {
    setLocalStatus(newStatus as any);
    setIsSaving(true);
    await updateIdeaStatus(idea.id, newStatus);
    setIsSaving(false);
  };

  const handleRating = async (rating: number) => {
    setLocalRating(rating);
    setIsSaving(true);
    await rateIdea(idea.id, rating);
    setIsSaving(false);
  };

  const handleToggleFavorite = async () => {
    const newStatus = !localFavorite;
    setLocalFavorite(newStatus);
    setIsSaving(true);
    await toggleFavorite(idea.id);
    setIsSaving(false);
    // Notify parent component of favorite status change
    onFavoriteToggle?.(idea.id, newStatus);
  };

  const handleSaveNotes = async () => {
    setIsSaving(true);
    await updateIdeaNotes(idea.id, localNotes);
    setIsEditingNotes(false);
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (confirm("Delete this idea?")) {
      await deleteInvestmentIdea(idea.id);
    }
  };

  const handleCreateReminderFromAction = async (actionItem: string, index: number) => {
    setReminderState(index, "saving");
    const reminderTitle = `Research: ${idea.title} - ${actionItem}`;
    const tomorrow = new Date(Date.now() + 86_400_000);
    await addReminder({
      title: reminderTitle,
      notes: `Investment idea: ${idea.title}\n\nAction: ${actionItem}\n\nCategory: ${idea.category}`,
      due_at: tomorrow.toISOString(),
      recurrence: "once",
      category: "general",
      source_app: "hub",
    });
    setReminderState(index, "done");
    // Reset back to idle after a moment so the button can be clicked again
    setTimeout(() => setReminderState(index, "idle"), 2000);
  };

  const card: React.CSSProperties = {
    background: "var(--color-bg-card)",
    border: "1px solid var(--color-rule)",
    borderRadius: 12,
    padding: "20px 24px",
    boxShadow: "var(--shadow-card)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minHeight: 280,
    height: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              color: "var(--color-ink-3)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            {CATEGORY_LABELS[idea.category] || idea.category}
            {isAiGenerated && (
              <span
                style={{
                  marginLeft: 8,
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: "var(--color-accent)",
                  color: "#FFFDF8",
                  fontSize: 8,
                }}
              >
                AI
              </span>
            )}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{idea.title}</h3>
        </div>
        <button
          onClick={handleToggleFavorite}
          disabled={isSaving}
          style={{
            background: "transparent",
            border: "none",
            fontSize: 18,
            cursor: "pointer",
            opacity: isSaving ? 0.5 : 1,
            padding: 0,
          }}
          title={localFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {localFavorite ? "⭐" : "☆"}
        </button>
      </div>

      {/* Risk & Time Horizon */}
      {(idea.riskLevel || idea.timeHorizon) && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11 }}>
          {idea.riskLevel && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                background: RISK_COLORS[idea.riskLevel] + "20",
                color: RISK_COLORS[idea.riskLevel],
                fontWeight: 500,
              }}
            >
              Risk: {idea.riskLevel.charAt(0).toUpperCase() + idea.riskLevel.slice(1)}
            </span>
          )}
          {idea.timeHorizon && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: 4,
                background: "var(--color-accent)" + "20",
                color: "var(--color-accent)",
                fontWeight: 500,
              }}
            >
              {TIME_HORIZON_LABELS[idea.timeHorizon]}
            </span>
          )}
        </div>
      )}

      {/* Rationale */}
      {idea.rationale && (
        <p
          style={{
            fontSize: 12,
            color: "var(--color-ink-2)",
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {idea.rationale}
        </p>
      )}

      {/* Details */}
      {(idea.capitalRequired || idea.expectedReturns) && (
        <div style={{ fontSize: 11, color: "var(--color-ink-3)", display: "flex", gap: 16 }}>
          {idea.capitalRequired && (
            <div>
              <span style={{ fontWeight: 600 }}>Capital:</span> {idea.capitalRequired}
            </div>
          )}
          {idea.expectedReturns && (
            <div>
              <span style={{ fontWeight: 600 }}>Returns:</span> {idea.expectedReturns}
            </div>
          )}
        </div>
      )}

      {/* Expand button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--color-accent)",
          fontSize: 11,
          cursor: "pointer",
          fontWeight: 500,
          padding: 0,
          textAlign: "left",
        }}
      >
        {isExpanded ? "▼ Hide details" : "▶ Show details"}
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--color-rule)", paddingTop: 8 }}>
          {/* Related Assets */}
          {idea.relatedAssets && idea.relatedAssets.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-3)", marginBottom: 4 }}>
                RELATED ASSETS
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {idea.relatedAssets.map((asset) => (
                  <span
                    key={asset}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-rule)",
                      fontSize: 10,
                      fontWeight: 500,
                      color: "var(--color-ink-2)",
                    }}
                  >
                    {asset}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {idea.actionItems && idea.actionItems.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-ink-3)", marginBottom: 4 }}>
                ACTION ITEMS
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 0,
                  fontSize: 11,
                  color: "var(--color-ink-2)",
                  listStyle: "none",
                }}
              >
                {idea.actionItems.map((item, i) => {
                  const rs = reminderStates[i] ?? "idle";
                  return (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 6,
                        marginBottom: 6,
                        paddingLeft: 16,
                        position: "relative",
                      }}
                    >
                      <span style={{ position: "absolute", left: 0 }}>•</span>
                      <span style={{ flex: 1 }}>{item}</span>
                      <button
                        onClick={() => handleCreateReminderFromAction(item, i)}
                        disabled={rs === "saving"}
                        title="Create research reminder"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: rs === "done" ? "var(--color-green, #4D6B3A)" : "var(--color-accent)",
                          fontSize: 10,
                          cursor: rs === "saving" ? "not-allowed" : "pointer",
                          padding: "2px 4px",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                          opacity: rs === "saving" ? 0.5 : 1,
                          transition: "color 150ms",
                        }}
                      >
                        {rs === "saving" ? "Adding…" : rs === "done" ? "✓ Added" : "📋 Remind"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* User Controls - Only for saved ideas */}
      {!isAiGenerated && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--color-rule)", paddingTop: 8 }}>
          {/* Status */}
          <div>
            <label style={{ fontSize: 9, color: "var(--color-ink-3)", fontWeight: 600, textTransform: "uppercase" }}>
              Status
            </label>
            <select
              value={localStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isSaving}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid var(--color-rule)",
                background: "var(--color-bg)",
                color: "var(--color-ink)",
                fontSize: 11,
                fontFamily: "inherit",
                cursor: "pointer",
                marginTop: 2,
              }}
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Rating */}
          <div>
            <label style={{ fontSize: 9, color: "var(--color-ink-3)", fontWeight: 600, textTransform: "uppercase" }}>
              Rating
            </label>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRating(star === localRating ? 0 : star)}
                  disabled={isSaving}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: 16,
                    cursor: "pointer",
                    opacity: isSaving ? 0.5 : 1,
                    padding: 0,
                  }}
                  title={`Rate ${star}`}
                >
                  {star <= (localRating ?? 0) ? "★" : "☆"}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          {isEditingNotes ? (
            <div>
              <textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Add personal notes..."
                style={{
                  width: "100%",
                  minHeight: 60,
                  padding: "8px",
                  borderRadius: 6,
                  border: "1px solid var(--color-rule)",
                  background: "var(--color-bg)",
                  color: "var(--color-ink)",
                  fontSize: 11,
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  onClick={handleSaveNotes}
                  disabled={isSaving}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 4,
                    border: "none",
                    background: "var(--color-accent)",
                    color: "#FFFDF8",
                    fontSize: 10,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingNotes(false)}
                  style={{
                    flex: 1,
                    padding: "6px 8px",
                    borderRadius: 4,
                    border: "1px solid var(--color-rule)",
                    background: "transparent",
                    color: "var(--color-ink-2)",
                    fontSize: 10,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingNotes(true)}
              style={{
                textAlign: "left",
                padding: "8px",
                borderRadius: 6,
                border: "1px dashed var(--color-rule)",
                background: localNotes ? "var(--color-bg)" : "transparent",
                color: localNotes ? "var(--color-ink)" : "var(--color-ink-3)",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "inherit",
                minHeight: 40,
                display: "flex",
                alignItems: "center",
              }}
            >
              {localNotes || "✎ Add notes..."}
            </button>
          )}

          {/* Delete */}
          <button
            onClick={handleDelete}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid var(--color-red)",
              background: "transparent",
              color: "var(--color-red)",
              fontSize: 10,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
