"use client";

import { useState, useEffect } from "react";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  context: string | null;
}

interface FlashcardSetViewerProps {
  setId: string;
  setName: string;
  onBack: () => void;
  onSetDeleted: () => void;
}

export default function FlashcardSetViewer({ setId, setName, onBack, onSetDeleted }: FlashcardSetViewerProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    context: "",
  });

  useEffect(() => {
    fetchFlashcards();
  }, [setId]);

  const fetchFlashcards = async () => {
    try {
      const response = await fetch(`/api/student-support/flashcards?setId=${setId}`);
      if (response.ok) {
        const data = await response.json();
        setFlashcards(data);
        setCurrentIndex(0);
        setIsFlipped(false);
      }
    } catch (err) {
      console.error("Error fetching flashcards:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/student-support/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          ...formData,
        }),
      });

      if (response.ok) {
        const newCard = await response.json();
        setFlashcards([...flashcards, newCard]);
        setFormData({ question: "", answer: "", context: "" });
        setShowAddForm(false);
      }
    } catch (err) {
      console.error("Error adding flashcard:", err);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const response = await fetch(`/api/student-support/flashcards/${cardId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const newCards = flashcards.filter((c) => c.id !== cardId);
        setFlashcards(newCards);
        if (currentIndex >= newCards.length) {
          setCurrentIndex(Math.max(0, newCards.length - 1));
        }
      }
    } catch (err) {
      console.error("Error deleting flashcard:", err);
    }
  };

  if (loading) {
    return <div style={{ color: "var(--color-ink-3)" }}>Loading flashcards...</div>;
  }

  const currentCard = flashcards[currentIndex];

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          color: "var(--color-accent-dark)",
          background: "transparent",
          border: "none",
          fontSize: 13,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        ← Back to Sets
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{setName}</h2>
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
          + Add Card
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
          <form onSubmit={handleAddCard}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Question *
              </label>
              <input
                type="text"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                required
                placeholder="Front of card..."
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
                Answer *
              </label>
              <textarea
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                required
                placeholder="Back of card..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-rule)",
                  borderRadius: 6,
                  fontSize: 13,
                  boxSizing: "border-box",
                  minHeight: 80,
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6 }}>
                Context (optional)
              </label>
              <textarea
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                placeholder="Additional explanation or reference..."
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
                disabled={!formData.question || !formData.answer}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: !formData.question || !formData.answer ? "var(--color-paper-deep)" : "var(--color-accent-dark)",
                  color: "white",
                  cursor: !formData.question || !formData.answer ? "default" : "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  opacity: !formData.question || !formData.answer ? 0.6 : 1,
                }}
              >
                Add Card
              </button>
            </div>
          </form>
        </div>
      )}

      {flashcards.length === 0 ? (
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
          <p>No flashcards yet. Add one to start studying!</p>
        </div>
      ) : (
        <div>
          {/* Flashcard Viewer */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            style={{
              background: isFlipped ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
              color: "white",
              borderRadius: 12,
              padding: "40px",
              minHeight: 300,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
              textAlign: "center",
              marginBottom: 20,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 20 }}>
              {isFlipped ? "Answer" : "Question"}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                lineHeight: 1.4,
                marginBottom: 20,
              }}
            >
              {isFlipped ? currentCard.answer : currentCard.question}
            </div>
            {currentCard.context && !isFlipped && (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 20, maxWidth: 500 }}>
                Context: {currentCard.context}
              </div>
            )}
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 20 }}>Click to flip</div>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button
              onClick={() => {
                setCurrentIndex(Math.max(0, currentIndex - 1));
                setIsFlipped(false);
              }}
              disabled={currentIndex === 0}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid var(--color-rule)",
                background: currentIndex === 0 ? "var(--color-paper-deep)" : "transparent",
                cursor: currentIndex === 0 ? "default" : "pointer",
                fontSize: 12,
                opacity: currentIndex === 0 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>

            <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
              {currentIndex + 1} / {flashcards.length}
            </div>

            <button
              onClick={() => {
                setCurrentIndex(Math.min(flashcards.length - 1, currentIndex + 1));
                setIsFlipped(false);
              }}
              disabled={currentIndex === flashcards.length - 1}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid var(--color-rule)",
                background: currentIndex === flashcards.length - 1 ? "var(--color-paper-deep)" : "transparent",
                cursor: currentIndex === flashcards.length - 1 ? "default" : "pointer",
                fontSize: 12,
                opacity: currentIndex === flashcards.length - 1 ? 0.5 : 1,
              }}
            >
              Next →
            </button>
          </div>

          {/* Delete button */}
          <button
            onClick={() => handleDeleteCard(currentCard.id)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 6,
              border: "1px solid #fecaca",
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Delete This Card
          </button>
        </div>
      )}
    </div>
  );
}
