"use client";

import { useState } from "react";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";
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

const TYPE_LABEL: Record<string, string> = { url: "URL", file: "File", text: "Text" };

const SOURCE_TYPE_LABEL: Record<RecommendedSource["type"], string> = {
  official: "Official",
  practice: "Practice",
  video: "Video",
  community: "Community",
  book: "Book",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-cell)",
  color: "var(--ios-label)",
  fontSize: 16,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  colorScheme: "light dark",
};

function TagPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="ios-caption"
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 6,
        background: "var(--ios-fill)",
        color: "var(--ios-label-2)",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill={filled ? "var(--ios-yellow)" : "none"} stroke={filled ? "var(--ios-yellow)" : "var(--ios-label-3)"} strokeWidth={1.6} strokeLinejoin="round" aria-hidden>
      <path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}

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

  const smallFilled: React.CSSProperties = {
    padding: "8px 16px", borderRadius: 10, border: "none",
    background: "var(--ios-tint)", color: "var(--ios-on-tint)",
    fontSize: 15, fontWeight: 600, cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>Source materials</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="ios-btn--plain" onClick={handleGetRecommendations} disabled={recLoading} style={{ opacity: recLoading ? 0.6 : 1 }}>
            {recLoading ? "Loading…" : "Get recommendations"}
          </button>
          <button type="button" onClick={() => setShowAddForm((v) => !v)} style={smallFilled}>
            Add source
          </button>
        </div>
      </div>

      {/* Recommendations panel */}
      {recError && (
        <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: 0 }}>{recError}</p>
      )}
      {recommendations.length > 0 && (
        <Group header="Recommended by Claude — tap to add" footer="Verify links before relying on them — URLs may change over time.">
          {recommendations.map((rec) => {
            const isAdding = addingRec === rec.url;
            return (
              <div key={rec.url} className="ios-cell" style={{ alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                    <TagPill>{SOURCE_TYPE_LABEL[rec.type] ?? "Community"}</TagPill>
                    {rec.free && <TagPill>Free</TagPill>}
                    {rec.fits_testing && <TagPill>Testable</TagPill>}
                    <span className="ios-subhead" style={{ fontWeight: 600, color: "var(--ios-label)" }}>{rec.title}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ display: "inline-flex", gap: 2 }}>
                      {Array.from({ length: 5 }, (_, i) => <StarIcon key={i} filled={i < rec.rating} />)}
                    </span>
                    <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{rec.rating}/5</span>
                  </div>
                  <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: "0 0 6px 0", lineHeight: 1.5 }}>{rec.description}</p>
                  <a href={rec.url} target="_blank" rel="noopener noreferrer" className="ios-footnote" style={{ color: "var(--ios-tint)", textDecoration: "none", wordBreak: "break-all" }}>
                    {rec.url}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddRecommendation(rec)}
                  disabled={isAdding}
                  className="ios-chip ios-chip--sm"
                  style={{ color: "var(--ios-tint)", flexShrink: 0, cursor: isAdding ? "wait" : "pointer" }}
                >
                  {isAdding ? "Adding…" : "Add"}
                </button>
              </div>
            );
          })}
        </Group>
      )}

      {/* Add material form */}
      {showAddForm && (
        <Group header="Add source material" footer="For PDF exam guides, paste the direct PDF URL. The AI uses this when generating questions.">
          <div style={{ padding: 16 }}>
            <form onSubmit={handleAddMaterial}>
              <div className="ios-group-header" style={{ padding: "0 0 8px" }}>URL *</div>
              <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} required placeholder="https://example.com/exam-guide.pdf" style={inputStyle} />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Title (optional)</div>
              <input type="text" value={titleInput} onChange={(e) => setTitleInput(e.target.value)} placeholder="e.g. Official Exam Guide v3" style={inputStyle} />

              {addError && <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: "12px 0 0" }}>{addError}</p>}

              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button type="button" onClick={() => { setShowAddForm(false); setAddError(null); }} className="ios-btn--plain">
                  Cancel
                </button>
                <button type="submit" disabled={addLoading || !urlInput.trim()} className="ios-btn ios-btn--primary" style={{ flex: 1, opacity: addLoading || !urlInput.trim() ? 0.5 : 1 }}>
                  {addLoading ? "Adding…" : "Add material"}
                </button>
              </div>
            </form>
          </div>
        </Group>
      )}

      {/* Generate from materials */}
      {materials.length > 0 && (
        <Group footer="AI reads your uploaded materials and creates practice questions.">
          <Cell
            lead={<IconBadge color={colorTag}><Icons.SparkleIcon /></IconBadge>}
            title="Generate from materials"
            subtitle={generateResult ?? generateError ?? undefined}
            trailing={
              <button type="button" onClick={handleGenerate} disabled={generating} style={{ ...smallFilled, opacity: generating ? 0.6 : 1 }}>
                {generating ? "Generating…" : "Generate"}
              </button>
            }
            chevron={false}
          />
        </Group>
      )}

      {/* Materials list */}
      {materials.length === 0 ? (
        <div className="ios-list" style={{ margin: 0, padding: "36px 24px", textAlign: "center" }}>
          <div className="ios-headline" style={{ color: "var(--ios-label)", marginBottom: 6 }}>No materials added yet</div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0 }}>
            Use &ldquo;Get recommendations&rdquo; to find official study guides, or add your own URL.
          </p>
        </div>
      ) : (
        <Group header="Materials">
          {materials.map((material) => (
            <div key={material.id} className="ios-cell" style={{ alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <TagPill>{TYPE_LABEL[material.type] ?? material.type.toUpperCase()}</TagPill>
                  <span className="ios-cell-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>{material.title}</span>
                </div>
                <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginBottom: material.url ? 4 : 0 }}>
                  Added {formatDate(material.created_at)}{material.extracted_text ? " · Text indexed" : ""}
                </div>
                {material.url && (
                  <a href={material.url} target="_blank" rel="noopener noreferrer" className="ios-footnote" style={{ color: "var(--ios-tint)", textDecoration: "none", display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>
                    {material.url}
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(material.id)}
                disabled={deleteLoading === material.id}
                aria-label="Delete material"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "none", background: "var(--ios-fill)", color: "var(--ios-red)", cursor: deleteLoading === material.id ? "default" : "pointer", flexShrink: 0, opacity: deleteLoading === material.id ? 0.5 : 1 }}
              >
                {deleteLoading === material.id ? "…" : (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </Group>
      )}
    </div>
  );
}
