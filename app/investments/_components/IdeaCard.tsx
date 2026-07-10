"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import type { InvestmentIdea } from "@/lib/investment-ideas-constants";
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  TIME_HORIZON_LABELS,
  RISK_COLORS,
} from "@/lib/investment-ideas-constants";
import { Icons } from "@/components/ios";
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

/** Small star glyph — filled or outline, inherits currentColor. */
function StarGlyph({ filled, style }: { filled?: boolean; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={{ width: 18, height: 18, ...style }}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
    </svg>
  );
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
    const tomorrow = new Date(new Date().getTime() + 86_400_000);
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

  const riskColor = idea.riskLevel ? RISK_COLORS[idea.riskLevel] : "var(--ios-label-2)";

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "var(--ios-fill)",
    color: "var(--ios-label)",
    fontSize: 15,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        background: "var(--ios-cell)",
        borderRadius: "var(--ios-radius-card)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="ios-footnote"
            style={{
              color: "var(--ios-label-3)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>{CATEGORY_LABELS[idea.category] || idea.category}</span>
            {isAiGenerated && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "color-mix(in srgb, var(--ios-tint) 14%, transparent)",
                  color: "var(--ios-tint)",
                  fontSize: 10,
                  letterSpacing: 0,
                }}
              >
                <Icons.SparkleIcon style={{ width: 11, height: 11 }} />
                AI
              </span>
            )}
          </div>
          <h3 className="ios-headline" style={{ margin: 0 }}>{idea.title}</h3>
        </div>
        <button
          onClick={handleToggleFavorite}
          disabled={isSaving}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            opacity: isSaving ? 0.5 : 1,
            padding: 0,
            color: localFavorite ? "var(--ios-orange)" : "var(--ios-label-3)",
            flexShrink: 0,
          }}
          title={localFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <StarGlyph filled={localFavorite} />
        </button>
      </div>

      {/* Risk & Time Horizon */}
      {(idea.riskLevel || idea.timeHorizon) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {idea.riskLevel && (
            <span
              className="ios-chip ios-chip--sm"
              style={{
                background: `color-mix(in srgb, ${riskColor} 16%, transparent)`,
                color: riskColor,
              }}
            >
              Risk: {idea.riskLevel.charAt(0).toUpperCase() + idea.riskLevel.slice(1)}
            </span>
          )}
          {idea.timeHorizon && (
            <span
              className="ios-chip ios-chip--sm"
              style={{
                background: "color-mix(in srgb, var(--ios-tint) 14%, transparent)",
                color: "var(--ios-tint)",
              }}
            >
              {TIME_HORIZON_LABELS[idea.timeHorizon]}
            </span>
          )}
        </div>
      )}

      {/* Rationale */}
      {idea.rationale && (
        <p className="ios-subhead" style={{ color: "var(--ios-label-2)", margin: 0 }}>
          {idea.rationale}
        </p>
      )}

      {/* Details */}
      {(idea.capitalRequired || idea.expectedReturns) && (
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", display: "flex", gap: 20, flexWrap: "wrap" }}>
          {idea.capitalRequired && (
            <div>
              <span style={{ color: "var(--ios-label-3)" }}>Capital </span>
              {idea.capitalRequired}
            </div>
          )}
          {idea.expectedReturns && (
            <div>
              <span style={{ color: "var(--ios-label-3)" }}>Returns </span>
              {idea.expectedReturns}
            </div>
          )}
        </div>
      )}

      {/* Expand button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="ios-footnote"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--ios-tint)",
          cursor: "pointer",
          fontWeight: 600,
          padding: 0,
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Icons.ChevronRight
          style={{ width: 14, height: 14, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
        />
        {isExpanded ? "Hide details" : "Show details"}
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            borderTop: "var(--ios-hair) solid var(--ios-separator)",
            paddingTop: 12,
          }}
        >
          {/* Related Assets */}
          {idea.relatedAssets && idea.relatedAssets.length > 0 && (
            <div>
              <div className="ios-caption" style={{ fontWeight: 600, color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Related Assets
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {idea.relatedAssets.map((asset) => (
                  <span key={asset} className="ios-chip ios-chip--sm">
                    {asset}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {idea.actionItems && idea.actionItems.length > 0 && (
            <div>
              <div className="ios-caption" style={{ fontWeight: 600, color: "var(--ios-label-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Action Items
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {idea.actionItems.map((item, i) => {
                  const rs = reminderStates[i] ?? "idle";
                  return (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        paddingLeft: 14,
                        position: "relative",
                      }}
                    >
                      <span style={{ position: "absolute", left: 0, color: "var(--ios-label-3)" }}>•</span>
                      <span className="ios-footnote" style={{ flex: 1, color: "var(--ios-label-2)" }}>{item}</span>
                      <button
                        onClick={() => handleCreateReminderFromAction(item, i)}
                        disabled={rs === "saving"}
                        title="Create research reminder"
                        className="ios-caption"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          background: "transparent",
                          border: "none",
                          color: rs === "done" ? "var(--ios-green)" : "var(--ios-tint)",
                          cursor: rs === "saving" ? "not-allowed" : "pointer",
                          padding: "2px 4px",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                          opacity: rs === "saving" ? 0.5 : 1,
                        }}
                      >
                        {rs === "saving" ? "Adding…" : rs === "done" ? "Added" : (
                          <>
                            <Icons.BellIcon style={{ width: 12, height: 12 }} />
                            Remind
                          </>
                        )}
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            borderTop: "var(--ios-hair) solid var(--ios-separator)",
            paddingTop: 12,
          }}
        >
          {/* Status */}
          <div>
            <label className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Status
            </label>
            <select
              value={localStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isSaving}
              style={{ ...fieldStyle, cursor: "pointer", marginTop: 4 }}
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
            <label className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Rating
            </label>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= (localRating ?? 0);
                return (
                  <button
                    key={star}
                    onClick={() => handleRating(star === localRating ? 0 : star)}
                    disabled={isSaving}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      opacity: isSaving ? 0.5 : 1,
                      padding: 0,
                      color: active ? "var(--ios-orange)" : "var(--ios-label-3)",
                    }}
                    title={`Rate ${star}`}
                  >
                    <StarGlyph filled={active} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {isEditingNotes ? (
            <div>
              <textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Add personal notes..."
                style={{ ...fieldStyle, minHeight: 60, resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleSaveNotes}
                  disabled={isSaving}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--ios-tint)",
                    color: "var(--ios-on-tint)",
                    fontSize: 14,
                    fontWeight: 600,
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
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "var(--ios-fill)",
                    color: "var(--ios-label)",
                    fontSize: 14,
                    fontWeight: 600,
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
              className="ios-footnote"
              style={{
                textAlign: "left",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: "var(--ios-fill)",
                color: localNotes ? "var(--ios-label)" : "var(--ios-label-3)",
                cursor: "pointer",
                fontFamily: "inherit",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {localNotes ? (
                localNotes
              ) : (
                <>
                  <Icons.ComposeIcon style={{ width: 14, height: 14 }} />
                  Add notes…
                </>
              )}
            </button>
          )}

          {/* Delete */}
          <button
            onClick={handleDelete}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              background: "color-mix(in srgb, var(--ios-red) 12%, transparent)",
              color: "var(--ios-red)",
              fontSize: 14,
              fontWeight: 600,
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
