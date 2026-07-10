"use client";

import { useState } from "react";
import { Icons } from "@/components/ios";
import FlashcardSetViewer from "./FlashcardSetViewer";

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

interface FlashcardSet {
  id: string;
  name: string;
  description: string | null;
}

interface FlashcardsTabProps {
  courseId: string;
  colorTag: string;
  flashcardSets: FlashcardSet[];
  onSetAdded: (set: FlashcardSet) => void;
  onSetDeleted: (id: string) => void;
}

export default function FlashcardsTab({
  courseId,
  colorTag,
  flashcardSets,
  onSetAdded,
  onSetDeleted,
}: FlashcardsTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  const handleAddSet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/student-support/flashcard-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          ...formData,
        }),
      });

      if (!response.ok) throw new Error("Failed to create set");

      const newSet = await response.json();
      onSetAdded(newSet);
      setFormData({ name: "", description: "" });
      setShowAddForm(false);
    } catch (err) {
      console.error("Error creating set:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    try {
      const response = await fetch(`/api/student-support/flashcard-sets/${setId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        onSetDeleted(setId);
        if (selectedSetId === setId) {
          setSelectedSetId(null);
        }
      }
    } catch (err) {
      console.error("Error deleting set:", err);
    }
  };

  if (selectedSetId) {
    const set = flashcardSets.find((s) => s.id === selectedSetId);
    if (set) {
      return (
        <FlashcardSetViewer
          setId={selectedSetId}
          setName={set.name}
          courseId={courseId}
          colorTag={colorTag}
          onBack={() => setSelectedSetId(null)}
          onSetDeleted={() => {
            handleDeleteSet(selectedSetId);
            setSelectedSetId(null);
          }}
        />
      );
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>Study Flashcards</h2>
        <button type="button" className="ios-btn--plain" onClick={() => setShowAddForm(true)} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icons.PlusIcon style={{ width: 17, height: 17 }} />
          New Set
        </button>
      </div>

      {flashcardSets.length === 0 ? (
        <div style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: "32px 24px",
          textAlign: "center",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: "var(--ios-label-3)" }}>
            <Icons.BookIcon style={{ width: 30, height: 30 }} />
          </div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>
            No flashcard sets yet. Create one to start studying.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {flashcardSets.map((set) => (
            <div
              key={set.id}
              style={{
                background: "var(--ios-cell)",
                borderRadius: "var(--ios-radius-card)",
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <button
                onClick={() => setSelectedSetId(set.id)}
                style={{ flex: 1, textAlign: "left", padding: 0, minWidth: 0 }}
              >
                <h3 className="ios-headline" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icons.BookIcon style={{ width: 18, height: 18, color: colorTag }} />
                  {set.name}
                </h3>
                {set.description && (
                  <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: "4px 0 0 0" }}>
                    {set.description}
                  </p>
                )}
              </button>
              <button
                onClick={() => handleDeleteSet(set.id)}
                className="ios-footnote"
                style={{ color: "var(--ios-red)", fontWeight: 600, flexShrink: 0 }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setShowAddForm(false)} aria-hidden="true" />
          <div className="ios-sheet" role="dialog" aria-modal="true" aria-label="New flashcard set">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setShowAddForm(false)}>Cancel</button>
              <span className="ios-headline">New Set</span>
              <span style={{ width: 52 }} />
            </div>

            <form onSubmit={handleAddSet}>
              <div className="ios-group-header" style={{ padding: "0 0 8px" }}>
                Set Name <span style={{ color: "var(--ios-red)" }}>*</span>
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. Chapter 3 Vocabulary"
                style={inputStyle}
              />

              <div className="ios-group-header" style={{ padding: "18px 0 8px" }}>Description</div>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What topics does this cover?"
                rows={2}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />

              <button
                type="submit"
                disabled={loading || !formData.name}
                className="ios-btn ios-btn--primary"
                style={{ marginTop: 22, opacity: loading || !formData.name ? 0.5 : 1 }}
              >
                {loading ? "Creating…" : "Create Set"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
