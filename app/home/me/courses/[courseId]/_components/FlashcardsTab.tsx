"use client";

import { useState } from "react";
import FlashcardSetViewer from "./FlashcardSetViewer";

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Study Flashcards</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-accent-dark)",
            color: "white",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          + New Set
        </button>
      </div>

      {showAddForm && (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <form onSubmit={handleAddSet}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Set Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Chapter 3 Vocabulary"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What topics does this cover?"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                  minHeight: 60,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--color-rule)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.name}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: loading || !formData.name ? "var(--color-paper-deep)" : "var(--color-accent-dark)",
                  color: "white",
                  cursor: loading || !formData.name ? "default" : "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  opacity: loading || !formData.name ? 0.6 : 1,
                }}
              >
                {loading ? "Creating..." : "Create Set"}
              </button>
            </div>
          </form>
        </div>
      )}

      {flashcardSets.length === 0 ? (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 8,
            padding: "32px 24px",
            textAlign: "center",
            color: "var(--color-ink-3)",
          }}
        >
          <p>No flashcard sets yet. Create one to start studying!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {flashcardSets.map((set) => (
            <div
              key={set.id}
              style={{
                background: "var(--color-bg-card)",
                border: "1px solid var(--color-rule)",
                borderRadius: 8,
                padding: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                gap: 12,
              }}
            >
              <button
                onClick={() => setSelectedSetId(set.id)}
                style={{
                  flex: 1,
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--color-accent-dark)" }}>
                  🎯 {set.name}
                </h3>
                {set.description && (
                  <p style={{ fontSize: 12, color: "var(--color-ink-3)", margin: "6px 0 0 0" }}>
                    {set.description}
                  </p>
                )}
              </button>
              <button
                onClick={() => handleDeleteSet(set.id)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid #fecaca",
                  background: "#fee2e2",
                  color: "#991b1b",
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
