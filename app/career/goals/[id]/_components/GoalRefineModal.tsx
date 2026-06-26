"use client";

import { useEffect, useState } from "react";

interface Milestone {
  title: string;
  due_date?: string | null;
  description?: string | null;
}

interface Refinements {
  refined_title?: string;
  refined_description?: string;
  success_criteria?: string[];
  suggested_milestones?: Milestone[];
}

interface Goal {
  id: string;
  title: string;
  description?: string | null;
}

interface Props {
  goal: Goal;
  onClose: () => void;
  onAccept: (refinements: Refinements) => void;
}

export default function GoalRefineModal({ goal, onClose, onAccept }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refinements, setRefinements] = useState<Refinements | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRefinements() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/career/goals/${goal.id}/refine`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) setRefinements(data);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRefinements();
    return () => { cancelled = true; };
  }, [goal.id]);

  return (
    /* Overlay */
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26, 24, 20, 0.45)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFDF8",
          borderRadius: 14,
          boxShadow: "0 8px 32px rgba(26,24,20,0.18), 0 0 0 1px rgba(26,24,20,0.06)",
          maxWidth: 600,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: "22px 24px 16px",
            borderBottom: "1px solid #E0D9C7",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8A8278", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              AI Refinement
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1A1814" }}>
              Refine: {goal.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#8A8278",
              fontSize: 20,
              lineHeight: 1,
              padding: "2px 4px",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 24px", flex: 1 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#8A8278", fontSize: 14 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid #E0D9C7",
                  borderTopColor: "#3B5C7F",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 12px",
                }}
              />
              Analyzing your goal with AI…
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 8,
                padding: "12px 16px",
                color: "#9A3B2A",
                fontSize: 14,
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          {refinements && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Refined title */}
              {refinements.refined_title && (
                <div>
                  <div style={sectionLabelStyle}>Refined Title</div>
                  <div
                    style={{
                      background: "#DDE5EE",
                      borderRadius: 8,
                      padding: "12px 14px",
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#29415A",
                    }}
                  >
                    {refinements.refined_title}
                  </div>
                </div>
              )}

              {/* Refined description */}
              {refinements.refined_description && (
                <div>
                  <div style={sectionLabelStyle}>Refined Description</div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: "#423E37",
                      lineHeight: 1.6,
                      background: "#F7F4EE",
                      borderRadius: 8,
                      padding: "12px 14px",
                      border: "1px solid #E0D9C7",
                    }}
                  >
                    {refinements.refined_description}
                  </p>
                </div>
              )}

              {/* Success criteria */}
              {(refinements.success_criteria ?? []).length > 0 && (
                <div>
                  <div style={sectionLabelStyle}>Success Criteria</div>
                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {(refinements.success_criteria ?? []).map((criterion, i) => (
                      <li
                        key={i}
                        style={{
                          display: "flex",
                          gap: 10,
                          fontSize: 14,
                          color: "#423E37",
                          alignItems: "flex-start",
                          padding: "8px 12px",
                          background: "#F7F4EE",
                          borderRadius: 6,
                          border: "1px solid #E0D9C7",
                        }}
                      >
                        <span style={{ color: "#4A6B3A", fontWeight: 700, flexShrink: 0 }}>✓</span>
                        {criterion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested milestones */}
              {(refinements.suggested_milestones ?? []).length > 0 && (
                <div>
                  <div style={sectionLabelStyle}>Suggested Milestones</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {(refinements.suggested_milestones ?? []).map((milestone, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#F7F4EE",
                          border: "1px solid #E0D9C7",
                          borderRadius: 8,
                          padding: "10px 14px",
                          borderLeft: "3px solid #3B5C7F",
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1814", marginBottom: 2 }}>
                          {milestone.title}
                        </div>
                        {milestone.due_date && (
                          <div style={{ fontSize: 12, color: "#8A8278", marginBottom: milestone.description ? 4 : 0 }}>
                            Target: {milestone.due_date}
                          </div>
                        )}
                        {milestone.description && (
                          <div style={{ fontSize: 13, color: "#423E37", lineHeight: 1.5 }}>
                            {milestone.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div
            style={{
              display: "flex",
              gap: 10,
              padding: "16px 24px 22px",
              borderTop: "1px solid #E0D9C7",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #E0D9C7",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 14,
                color: "#423E37",
                cursor: "pointer",
              }}
            >
              Keep original
            </button>
            {refinements && !error && (
              <button
                onClick={() => { onAccept(refinements); onClose(); }}
                style={{
                  background: "#3B5C7F",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Accept refinements
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#8A8278",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 8,
};
