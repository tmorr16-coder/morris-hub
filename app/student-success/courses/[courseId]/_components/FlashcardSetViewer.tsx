"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  context: string | null;
}

interface FlashcardSetViewerProps {
  setId: string;
  setName: string;
  courseId: string;
  colorTag: string;
  onBack: () => void;
  onSetDeleted: () => void;
}

type CardStyle = "definition" | "qa" | "concept" | "fillinblank";
type Difficulty = "beginner" | "intermediate" | "advanced";

const CARD_STYLE_LABELS: Record<CardStyle, string> = {
  definition: "Definition",
  qa: "Q&A",
  concept: "Concept",
  fillinblank: "Fill-in-blank",
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const COUNT_OPTIONS = [5, 10, 15, 20];

export default function FlashcardSetViewer({
  setId,
  setName,
  courseId,
  colorTag,
  onBack,
  onSetDeleted,
}: FlashcardSetViewerProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [displayOrder, setDisplayOrder] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);

  // Add card form
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ question: "", answer: "", context: "" });
  const [addLoading, setAddLoading] = useState(false);

  // All cards list
  const [showAllCards, setShowAllCards] = useState(false);

  // AI Generation
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genTopic, setGenTopic] = useState("");
  const [genStyle, setGenStyle] = useState<CardStyle>("qa");
  const [genDifficulty, setGenDifficulty] = useState<Difficulty>("intermediate");
  const [genCount, setGenCount] = useState(10);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFlashcards();
  }, [setId]);

  const fetchFlashcards = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/student-support/flashcards?setId=${setId}`);
      if (response.ok) {
        const data: Flashcard[] = await response.json();
        setFlashcards(data);
        setDisplayOrder(data.map((_, i) => i));
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsShuffled(false);
      }
    } catch (err) {
      console.error("Error fetching flashcards:", err);
    } finally {
      setLoading(false);
    }
  };

  // Navigate using displayOrder indices
  const orderedCards = displayOrder.map((i) => flashcards[i]).filter(Boolean);
  const currentCard = orderedCards[currentIndex] ?? null;

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(orderedCards.length - 1, index)));
      setIsFlipped(false);
    },
    [orderedCards.length]
  );

  const handleShuffle = () => {
    const shuffled = [...displayOrder];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setDisplayOrder(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsShuffled(true);
  };

  const handleReset = () => {
    setDisplayOrder(flashcards.map((_, i) => i));
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsShuffled(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only handle if not typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowLeft") goTo(currentIndex - 1);
      else if (e.key === "ArrowRight") goTo(currentIndex + 1);
      else if (e.key === " ") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIndex, goTo]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const response = await fetch("/api/student-support/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, ...formData }),
      });
      if (response.ok) {
        const newCard: Flashcard = await response.json();
        const updated = [...flashcards, newCard];
        setFlashcards(updated);
        setDisplayOrder(updated.map((_, i) => i));
        setIsShuffled(false);
        setFormData({ question: "", answer: "", context: "" });
        setShowAddForm(false);
      }
    } catch (err) {
      console.error("Error adding flashcard:", err);
    } finally {
      setAddLoading(false);
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
        setDisplayOrder(newCards.map((_, i) => i));
        setIsShuffled(false);
        const newMax = newCards.length - 1;
        if (currentIndex > newMax) setCurrentIndex(Math.max(0, newMax));
        setIsFlipped(false);
      }
    } catch (err) {
      console.error("Error deleting flashcard:", err);
    }
  };

  const handleGenerate = async () => {
    setGenLoading(true);
    setGenError(null);
    try {
      const response = await fetch("/api/student-support/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          courseId,
          topic: genTopic,
          cardStyle: genStyle,
          difficulty: genDifficulty,
          count: genCount,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? "Generation failed");
      }
      const newCards: Flashcard[] = await response.json();
      const updated = [...flashcards, ...newCards];
      setFlashcards(updated);
      setDisplayOrder(updated.map((_, i) => i));
      setIsShuffled(false);
      setShowGenPanel(false);
      setGenTopic("");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ color: "var(--color-ink-3)", padding: "40px 0", textAlign: "center" }}>
        Loading flashcards…
      </div>
    );
  }

  const progressPercent =
    orderedCards.length > 0 ? ((currentIndex + 1) / orderedCards.length) * 100 : 0;

  // ── Shared input style ──────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid var(--color-rule)",
    borderRadius: 6,
    fontSize: 13,
    boxSizing: "border-box",
    background: "var(--color-paper)",
    color: "var(--color-ink)",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "none" as const,
    paddingRight: 28,
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680 }}>
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          color: colorTag,
          background: "transparent",
          border: "none",
          fontSize: 13,
          cursor: "pointer",
          marginBottom: 20,
          fontWeight: 500,
          padding: 0,
        }}
      >
        ← Back to Sets
      </button>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-ink)" }}>
          {setName}
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setShowGenPanel((v) => !v);
              setShowAddForm(false);
            }}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              background: colorTag,
              color: "white",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ✨ Generate Cards
          </button>
          <button
            onClick={() => {
              setShowAddForm((v) => !v);
              setShowGenPanel(false);
            }}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: `1.5px solid ${colorTag}`,
              background: "transparent",
              color: colorTag,
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + Add Card
          </button>
        </div>
      </div>

      {/* ── AI Generation Panel ── */}
      {showGenPanel && (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: `1.5px solid ${colorTag}40`,
            borderRadius: 10,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 16,
              color: colorTag,
              letterSpacing: "0.02em",
            }}
          >
            ✨ AI Card Generator
          </div>

          {/* Topic */}
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                marginBottom: 5,
                color: "var(--color-ink-2)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Focus Topic
            </label>
            <input
              type="text"
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              placeholder="Leave blank to use all course content"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
            {/* Card Style */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 5,
                  color: "var(--color-ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Card Style
              </label>
              <div style={{ position: "relative" }}>
                <select
                  value={genStyle}
                  onChange={(e) => setGenStyle(e.target.value as CardStyle)}
                  style={selectStyle}
                >
                  {(Object.keys(CARD_STYLE_LABELS) as CardStyle[]).map((k) => (
                    <option key={k} value={k}>
                      {CARD_STYLE_LABELS[k]}
                    </option>
                  ))}
                </select>
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    fontSize: 10,
                    color: "var(--color-ink-3)",
                  }}
                >
                  ▾
                </span>
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 5,
                  color: "var(--color-ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Difficulty
              </label>
              <div style={{ position: "relative" }}>
                <select
                  value={genDifficulty}
                  onChange={(e) => setGenDifficulty(e.target.value as Difficulty)}
                  style={selectStyle}
                >
                  {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((k) => (
                    <option key={k} value={k}>
                      {DIFFICULTY_LABELS[k]}
                    </option>
                  ))}
                </select>
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    fontSize: 10,
                    color: "var(--color-ink-3)",
                  }}
                >
                  ▾
                </span>
              </div>
            </div>

            {/* Count */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 5,
                  color: "var(--color-ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                # of Cards
              </label>
              <div style={{ position: "relative" }}>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  style={selectStyle}
                >
                  {COUNT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} cards
                    </option>
                  ))}
                </select>
                <span
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    fontSize: 10,
                    color: "var(--color-ink-3)",
                  }}
                >
                  ▾
                </span>
              </div>
            </div>
          </div>

          {genError && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: "#fee2e2",
                color: "#991b1b",
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              {genError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setShowGenPanel(false);
                setGenError(null);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid var(--color-rule)",
                background: "transparent",
                cursor: "pointer",
                fontSize: 12,
                color: "var(--color-ink-2)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={genLoading}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                background: genLoading ? "var(--color-paper-deep)" : colorTag,
                color: "white",
                cursor: genLoading ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                opacity: genLoading ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {genLoading ? `Generating ${genCount} cards…` : `Generate ${genCount} Cards`}
            </button>
          </div>
        </div>
      )}

      {/* ── Add Card Form ── */}
      {showAddForm && (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 10,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 16,
              color: "var(--color-ink)",
            }}
          >
            New Flashcard
          </div>
          <form onSubmit={handleAddCard}>
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 5,
                  color: "var(--color-ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Question *
              </label>
              <textarea
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                required
                placeholder="Front of card — the question or term"
                style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 5,
                  color: "var(--color-ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Answer *
              </label>
              <textarea
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                required
                placeholder="Back of card — the answer or definition"
                style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  marginBottom: 5,
                  color: "var(--color-ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Context / Note{" "}
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <textarea
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                placeholder="Additional explanation or reference"
                style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid var(--color-rule)",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--color-ink-2)",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addLoading || !formData.question || !formData.answer}
                style={{
                  flex: 1,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background:
                    addLoading || !formData.question || !formData.answer
                      ? "var(--color-paper-deep)"
                      : colorTag,
                  color: "white",
                  cursor:
                    addLoading || !formData.question || !formData.answer ? "default" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: addLoading || !formData.question || !formData.answer ? 0.6 : 1,
                }}
              >
                {addLoading ? "Adding…" : "Add Card"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Empty state ── */}
      {flashcards.length === 0 ? (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 10,
            padding: "48px 24px",
            textAlign: "center",
            color: "var(--color-ink-3)",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🃏</div>
          <p style={{ margin: "0 0 6px 0", fontWeight: 500, color: "var(--color-ink-2)" }}>
            No flashcards yet.
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Generate some with AI or add one manually to start studying!
          </p>
        </div>
      ) : (
        <>
          {/* ── Card Viewer ── */}

          {/* Progress bar */}
          <div style={{ marginBottom: 6 }}>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                background: "var(--color-paper-deep)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: colorTag,
                  transition: "width 0.2s ease",
                  borderRadius: 2,
                }}
              />
            </div>
          </div>

          {/* Card counter + controls row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: colorTag,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {currentIndex + 1}{" "}
              <span style={{ fontWeight: 400, color: "var(--color-ink-3)", fontSize: 13 }}>
                / {orderedCards.length}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={handleShuffle}
                title="Shuffle deck"
                style={{
                  padding: "4px 10px",
                  borderRadius: 5,
                  border: "1px solid var(--color-rule)",
                  background: isShuffled ? colorTag + "18" : "transparent",
                  color: isShuffled ? colorTag : "var(--color-ink-3)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                ⇄ Shuffle
              </button>
              {isShuffled && (
                <button
                  onClick={handleReset}
                  title="Reset order"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 5,
                    border: "1px solid var(--color-rule)",
                    background: "transparent",
                    color: "var(--color-ink-3)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ↺ Reset
                </button>
              )}
            </div>
          </div>

          {/* Flip card */}
          {currentCard && (
            <div
              onClick={() => setIsFlipped((f) => !f)}
              ref={cardRef}
              style={{
                position: "relative",
                minHeight: 220,
                marginBottom: 16,
                cursor: "pointer",
                perspective: 800,
              }}
            >
              {/* Wrapper that rotates */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  minHeight: 220,
                  transformStyle: "preserve-3d",
                  transition: "transform 0.4s cubic-bezier(0.4,0,0.2,1)",
                  transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
              >
                {/* Front — question */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    background: "white",
                    border: `2px solid ${colorTag}`,
                    borderRadius: 12,
                    padding: "36px 32px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.09)",
                    minHeight: 220,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: colorTag,
                      marginBottom: 18,
                      opacity: 0.8,
                    }}
                  >
                    Question
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      lineHeight: 1.5,
                      color: "#1a1a2e",
                      maxWidth: 520,
                    }}
                  >
                    {currentCard.question}
                  </div>
                  <div
                    style={{
                      marginTop: 24,
                      fontSize: 11,
                      color: "#a0a0b0",
                    }}
                  >
                    Space or click to flip
                  </div>
                </div>

                {/* Back — answer */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    background: colorTag,
                    borderRadius: 12,
                    padding: "36px 32px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    minHeight: 220,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.75)",
                      marginBottom: 18,
                    }}
                  >
                    Answer
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      lineHeight: 1.5,
                      color: "white",
                      maxWidth: 520,
                    }}
                  >
                    {currentCard.answer}
                  </div>
                  {currentCard.context && (
                    <div
                      style={{
                        marginTop: 20,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.7)",
                        lineHeight: 1.5,
                        maxWidth: 460,
                        borderTop: "1px solid rgba(255,255,255,0.25)",
                        paddingTop: 16,
                      }}
                    >
                      {currentCard.context}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <button
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 7,
                border: "1px solid var(--color-rule)",
                background: currentIndex === 0 ? "var(--color-paper-deep)" : "transparent",
                cursor: currentIndex === 0 ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                color: currentIndex === 0 ? "var(--color-ink-3)" : "var(--color-ink)",
                opacity: currentIndex === 0 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>
            <button
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === orderedCards.length - 1}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 7,
                border: "1px solid var(--color-rule)",
                background:
                  currentIndex === orderedCards.length - 1
                    ? "var(--color-paper-deep)"
                    : "transparent",
                cursor:
                  currentIndex === orderedCards.length - 1 ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                color:
                  currentIndex === orderedCards.length - 1
                    ? "var(--color-ink-3)"
                    : "var(--color-ink)",
                opacity: currentIndex === orderedCards.length - 1 ? 0.5 : 1,
              }}
            >
              Next →
            </button>
          </div>

          {/* Keyboard hint */}
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "var(--color-ink-3)",
              marginBottom: 24,
            }}
          >
            ← → to navigate · Space to flip
          </div>

          {/* ── All Cards List ── */}
          <div>
            <button
              onClick={() => setShowAllCards((v) => !v)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-ink-2)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: colorTag }}>
                {showAllCards ? "▾" : "▸"}
              </span>
              {showAllCards ? "Hide all cards" : `Show all ${flashcards.length} cards`}
            </button>

            {showAllCards && (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {flashcards.map((card, idx) => (
                  <div
                    key={card.id}
                    style={{
                      background: "var(--color-bg-card)",
                      border: "1px solid var(--color-rule)",
                      borderLeft: `3px solid ${colorTag}`,
                      borderRadius: 8,
                      padding: "12px 14px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr auto",
                      gap: 12,
                      alignItems: "start",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: colorTag,
                          marginBottom: 4,
                        }}
                      >
                        #{idx + 1} · Q
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-ink)" }}>
                        {card.question}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--color-ink-3)",
                          marginBottom: 4,
                        }}
                      >
                        A
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--color-ink-2)" }}>
                        {card.answer}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      title="Delete card"
                      style={{
                        padding: "3px 7px",
                        borderRadius: 4,
                        border: "1px solid #fecaca",
                        background: "#fee2e2",
                        color: "#991b1b",
                        fontSize: 13,
                        lineHeight: 1,
                        cursor: "pointer",
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 14,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
