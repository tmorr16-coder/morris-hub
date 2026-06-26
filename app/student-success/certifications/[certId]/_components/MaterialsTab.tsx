"use client";

import { useState } from "react";
import type { RecommendedSource } from "@/app/api/student-support/certifications/[id]/recommended-sources/route";

interface Material {
  id: string;
  type: string;
  title: string;
  url: string | null;
  extracted_text: string | null;
  created_at: string;
}

interface MaterialsTabProps {
  examId: string;
  initialMaterials: Material[];
  colorTag: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  url:      { label: "URL",      bg: "#dbeafe", color: "#1d4ed8" },
  file:     { label: "File",     bg: "#d1fae5", color: "#065f46" },
  text:     { label: "Text",     bg: "#f3e8ff", color: "#6b21a8" },
};

const SOURCE_TYPE_STYLES: Record<RecommendedSource["type"], { label: string; bg: string; color: string }> = {
  official:  { label: "Official",  bg: "#dbeafe", color: "#1d4ed8" },
  practice:  { label: "Practice",  bg: "#dcfce7", color: "#166534" },
  video:     { label: "Video",     bg: "#fce7f3", color: "#9d174d" },
  community: { label: "Community", bg: "#fef3c7", color: "#92400e" },
  book:      { label: "Book",      bg: "#f3e8ff", color: "#6b21a8" },
};

export default function MaterialsTab({ examId, initialMaterials, colorTag }: MaterialsTabProps) {
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [urlInput, setUrlInput]   = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError]   = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Recommended sources state
  const [recommendations, setRecommendations] = useState<RecommendedSource[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError]     = useState<string | null>(null);
  const [addingRec, setAddingRec]   = useState<string | null>(null); // url being added

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px",
    border: "1px solid var(--color-rule)", borderRadius: 7,
    fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
    background: "var(--color-paper)", color: "var(--color-ink)",
  };

  async function addMaterial(type: string, title: string, url: string) {
    const res = await fetch(`/api/student-support/certifications/${examId}/materials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, title, url }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? "Failed to add material");
    }
    return res.json() as Promise<Material>;
  }

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!urlInput.trim()) return;
    setAddLoading(true);
    try {
      const newMat = await addMaterial("url", titleInput.trim() || urlInput.trim(), urlInput.trim());
      setMaterials((prev) => [newMat, ...prev]);
      setUrlInput(""); setTitleInput(""); setShowAddForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add material");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleAddRecommendation(rec: RecommendedSource) {
    setAddingRec(rec.url);
    try {
      const newMat = await addMaterial("url", rec.title, rec.url);
      setMaterials((prev) => [newMat, ...prev]);
      setRecommendations((prev) => prev.filter((r) => r.url !== rec.url));
    } catch {
      // keep the recommendation visible if add fails
    } finally {
      setAddingRec(null);
    }
  }

  async function handleDelete(materialId: string) {
    setDeleteLoading(materialId);
    try {
      await fetch(`/api/student-support/certifications/${examId}/materials?materialId=${materialId}`, { method: "DELETE" });
      setMaterials((prev) => prev.filter((m) => m.id !== materialId));
    } finally {
      setDeleteLoading(null);
    }
  }

  async function handleGenerate() {
    setGenerating(true); setGenerateError(null); setGenerateResult(null);
    try {
      const res = await fetch(`/api/student-support/certifications/${examId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "questions", count: 10 }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Generation failed");
      const data = await res.json();
      setGenerateResult(`Generated ${data.generated} question${data.generated !== 1 ? "s" : ""} successfully.`);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGetRecommendations() {
    setRecLoading(true); setRecError(null);
    try {
      const res = await fetch(`/api/student-support/certifications/${examId}/recommended-sources`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Failed to load recommendations");
      const { sources } = await res.json();
      // Filter out any already-added URLs
      const existing = new Set(materials.map((m) => m.url));
      setRecommendations(sources.filter((s: RecommendedSource) => !existing.has(s.url)));
    } catch (err) {
      setRecError(err instanceof Error ? err.message : "Could not load recommendations");
    } finally {
      setRecLoading(false);
    }
  }

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Source Materials</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleGetRecommendations}
            disabled={recLoading}
            style={{
              padding: "8px 16px", borderRadius: 7,
              border: `1.5px solid ${colorTag}`,
              background: "transparent", color: colorTag,
              fontSize: 13, fontWeight: 600,
              cursor: recLoading ? "wait" : "pointer",
              opacity: recLoading ? 0.7 : 1,
            }}
          >
            {recLoading ? "Loading…" : "✦ Get recommendations"}
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            style={{
              padding: "8px 16px", borderRadius: 7, border: "none",
              background: colorTag, color: "white",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            + Add source
          </button>
        </div>
      </div>

      {/* Recommendations panel */}
      {recError && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991b1b", marginBottom: 16 }}>
          {recError}
        </div>
      )}
      {recommendations.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 12 }}>
            Recommended by Claude — click to add
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {recommendations.map((rec) => {
              const style = SOURCE_TYPE_STYLES[rec.type] ?? SOURCE_TYPE_STYLES.community;
              const isAdding = addingRec === rec.url;
              return (
                <div
                  key={rec.url}
                  style={{
                    background: "var(--color-bg-raised)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, background: style.bg, color: style.color, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>
                        {style.label}
                      </span>
                      {rec.free && (
                        <span style={{ padding: "2px 8px", borderRadius: 4, background: "#dcfce7", color: "#166534", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>
                          Free
                        </span>
                      )}
                      {rec.fits_testing && (
                        <span style={{ padding: "2px 8px", borderRadius: 4, background: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }} title="Can be used to generate practice questions">
                          ✦ Testable
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>{rec.title}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, letterSpacing: 1 }}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <span key={i} style={{ color: i < rec.rating ? "#f59e0b" : "#d1d5db" }}>★</span>
                        ))}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--color-ink-4)" }}>{rec.rating}/5</span>
                    </div>
                    <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.5 }}>{rec.description}</p>
                    <a href={rec.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: colorTag, textDecoration: "none", wordBreak: "break-all" }}>
                      {rec.url}
                    </a>
                  </div>
                  <button
                    onClick={() => handleAddRecommendation(rec)}
                    disabled={isAdding}
                    style={{
                      padding: "7px 14px", borderRadius: 7, border: "none",
                      background: isAdding ? "var(--color-bg-sunk)" : colorTag,
                      color: "white", fontSize: 12, fontWeight: 600,
                      cursor: isAdding ? "wait" : "pointer",
                      flexShrink: 0, opacity: isAdding ? 0.7 : 1,
                    }}
                  >
                    {isAdding ? "Adding…" : "+ Add"}
                  </button>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 10 }}>
            Verify links before relying on them — Claude recommends based on known sources but URLs may change.
          </p>
        </div>
      )}

      {/* Add material form */}
      {showAddForm && (
        <div style={{ background: "var(--color-bg-raised)", border: `1.5px solid ${colorTag}40`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: colorTag }}>Add Source Material</div>
          <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: "0 0 16px 0", lineHeight: 1.6, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px" }}>
            For PDF exam guides, paste the direct PDF URL. The AI will use this when generating questions.
          </p>
          <form onSubmit={handleAddMaterial}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 5, color: "var(--color-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>URL *</label>
              <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} required placeholder="https://example.com/exam-guide.pdf" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 5, color: "var(--color-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Title <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
              </label>
              <input type="text" value={titleInput} onChange={(e) => setTitleInput(e.target.value)} placeholder="e.g. Official Exam Guide v3" style={inputStyle} />
            </div>
            {addError && <div style={{ padding: "8px 12px", borderRadius: 6, background: "#fee2e2", color: "#991b1b", fontSize: 12, marginBottom: 12 }}>{addError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { setShowAddForm(false); setAddError(null); }} style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid var(--color-rule)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-ink-2)" }}>
                Cancel
              </button>
              <button type="submit" disabled={addLoading || !urlInput.trim()} style={{ flex: 1, padding: "8px 16px", borderRadius: 7, border: "none", background: addLoading || !urlInput.trim() ? "var(--color-bg-sunk)" : colorTag, color: "white", cursor: addLoading || !urlInput.trim() ? "default" : "pointer", fontSize: 13, fontWeight: 600, opacity: addLoading || !urlInput.trim() ? 0.6 : 1 }}>
                {addLoading ? "Adding…" : "Add Material"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Generate from materials */}
      {materials.length > 0 && (
        <div style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 10, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)" }}>Generate from materials</div>
            <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 2 }}>AI reads your uploaded materials and creates practice questions.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <button onClick={handleGenerate} disabled={generating} style={{ padding: "9px 20px", borderRadius: 7, border: "none", background: generating ? "var(--color-bg-sunk)" : colorTag, color: "white", fontSize: 13, fontWeight: 600, cursor: generating ? "default" : "pointer", opacity: generating ? 0.7 : 1, whiteSpace: "nowrap" }}>
              {generating ? "Generating…" : "Generate Questions"}
            </button>
            {generateResult && <div style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>{generateResult}</div>}
            {generateError && <div style={{ fontSize: 12, color: "#dc2626" }}>{generateError}</div>}
          </div>
        </div>
      )}

      {/* Materials list */}
      {materials.length === 0 ? (
        <div style={{ background: "var(--color-bg-raised)", border: "1px dashed var(--color-line)", borderRadius: 10, padding: "40px 24px", textAlign: "center", color: "var(--color-ink-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <p style={{ margin: "0 0 6px 0", fontWeight: 500, color: "var(--color-ink-2)", fontSize: 14 }}>No materials added yet.</p>
          <p style={{ margin: 0, fontSize: 13 }}>Use "Get recommendations" to find official study guides, or add your own URL.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {materials.map((material) => {
            const badge = TYPE_BADGE[material.type] ?? { label: material.type.toUpperCase(), bg: "#f3f4f6", color: "#374151" };
            return (
              <div key={material.id} style={{ background: "var(--color-bg-raised)", border: "1px solid var(--color-line)", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", flexShrink: 0 }}>{badge.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>{material.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginBottom: material.url ? 4 : 0 }}>
                    Added {formatDate(material.created_at)}{material.extracted_text ? " · Text indexed" : ""}
                  </div>
                  {material.url && (
                    <a href={material.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: colorTag, textDecoration: "none", display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>
                      {material.url}
                    </a>
                  )}
                </div>
                <button onClick={() => handleDelete(material.id)} disabled={deleteLoading === material.id} style={{ padding: "4px 9px", borderRadius: 5, border: "1px solid #fecaca", background: "#fee2e2", color: "#991b1b", fontSize: 12, cursor: deleteLoading === material.id ? "default" : "pointer", fontWeight: 700, flexShrink: 0, opacity: deleteLoading === material.id ? 0.5 : 1 }}>
                  {deleteLoading === material.id ? "…" : "×"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
