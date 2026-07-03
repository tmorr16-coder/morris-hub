"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Icons } from "@/components/ios";

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
      <div className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "40px 0", textAlign: "center" }}>
        Loading flashcards…
      </div>
    );
  }

  const progressPercent =
    orderedCards.length > 0 ? ((currentIndex + 1) / orderedCards.length) * 100 : 0;

  // ── Shared input style ──────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "var(--ios-hair) solid var(--ios-separator)",
    borderRadius: 10,
    fontSize: 15,
    boxSizing: "border-box",
    background: "var(--ios-cell)",
    color: "var(--ios-label)",
    fontFamily: "inherit",
    outline: "none",
    colorScheme: "light dark",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "none" as const,
    paddingRight: 28,
  };

  const genLabel: React.CSSProperties = {
    display: "block",
    marginBottom: 5,
    color: "var(--ios-label-2)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  const chevronDown = (
    <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ios-label-3)", display: "flex" }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 680 }}>
      {/* Back */}
      <button
        onClick={onBack}
        className="ios-subhead"
        style={{
          color: colorTag,
          marginBottom: 16,
          fontWeight: 600,
          padding: 0,
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Icons.ChevronLeft style={{ width: 18, height: 18 }} />
        Sets
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
        <h2 className="ios-title-3" style={{ margin: 0 }}>{setName}</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setShowGenPanel((v) => !v);
              setShowAddForm(false);
            }}
            className="ios-footnote"
            style={{
              padding: "7px 14px",
              borderRadius: 10,
              background: colorTag,
              color: "#fff",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icons.SparkleIcon style={{ width: 15, height: 15 }} />
            Generate
          </button>
          <button
            onClick={() => {
              setShowAddForm((v) => !v);
              setShowGenPanel(false);
            }}
            className="ios-footnote"
            style={{
              padding: "7px 14px",
              borderRadius: 10,
              border: `1px solid ${colorTag}`,
              background: "transparent",
              color: colorTag,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Icons.PlusIcon style={{ width: 15, height: 15 }} />
            Add Card
          </button>
        </div>
      </div>

      {/* ── AI Generation Panel ── */}
      {showGenPanel && (
        <div
          style={{
            background: "var(--ios-cell)",
            border: `1px solid ${colorTag}`,
            borderRadius: "var(--ios-radius-card)",
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div className="ios-subhead" style={{ fontWeight: 700, marginBottom: 16, color: colorTag, display: "flex", alignItems: "center", gap: 6 }}>
            <Icons.SparkleIcon style={{ width: 16, height: 16 }} />
            AI Card Generator
          </div>

          {/* Topic */}
          <div style={{ marginBottom: 14 }}>
            <label className="ios-caption" style={{ ...genLabel, fontWeight: 600 }}>Focus Topic</label>
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
              <label className="ios-caption" style={{ ...genLabel, fontWeight: 600 }}>Card Style</label>
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
                {chevronDown}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <label className="ios-caption" style={{ ...genLabel, fontWeight: 600 }}>Difficulty</label>
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
                {chevronDown}
              </div>
            </div>

            {/* Count */}
            <div>
              <label className="ios-caption" style={{ ...genLabel, fontWeight: 600 }}># of Cards</label>
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
                {chevronDown}
              </div>
            </div>
          </div>

          {genError && (
            <div className="ios-footnote" style={{ padding: "8px 12px", borderRadius: 8, background: "var(--ios-fill)", color: "var(--ios-red)", marginBottom: 12 }}>
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
              className="ios-footnote"
              style={{ padding: "9px 16px", borderRadius: 10, background: "var(--ios-fill)", color: "var(--ios-label-2)", fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={genLoading}
              className="ios-subhead"
              style={{
                flex: 1,
                padding: "9px 16px",
                borderRadius: 10,
                background: genLoading ? "var(--ios-fill)" : colorTag,
                color: genLoading ? "var(--ios-label-2)" : "#fff",
                fontWeight: 600,
                opacity: genLoading ? 0.9 : 1,
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
            background: "var(--ios-cell)",
            borderRadius: "var(--ios-radius-card)",
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div className="ios-subhead" style={{ fontWeight: 700, marginBottom: 16 }}>New Flashcard</div>
          <form onSubmit={handleAddCard}>
            <div style={{ marginBottom: 14 }}>
              <label className="ios-caption" style={{ ...genLabel, fontWeight: 600 }}>Question *</label>
              <textarea
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                required
                placeholder="Front of card — the question or term"
                style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="ios-caption" style={{ ...genLabel, fontWeight: 600 }}>Answer *</label>
              <textarea
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                required
                placeholder="Back of card — the answer or definition"
                style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="ios-caption" style={{ ...genLabel, fontWeight: 600 }}>
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
                className="ios-footnote"
                style={{ padding: "9px 16px", borderRadius: 10, background: "var(--ios-fill)", color: "var(--ios-label-2)", fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addLoading || !formData.question || !formData.answer}
                className="ios-subhead"
                style={{
                  flex: 1,
                  padding: "9px 16px",
                  borderRadius: 10,
                  background:
                    addLoading || !formData.question || !formData.answer
                      ? "var(--ios-fill)"
                      : colorTag,
                  color: addLoading || !formData.question || !formData.answer ? "var(--ios-label-2)" : "#fff",
                  fontWeight: 600,
                  opacity: addLoading || !formData.question || !formData.answer ? 0.7 : 1,
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
            background: "var(--ios-cell)",
            borderRadius: "var(--ios-radius-card)",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--ios-label-3)" }}>
            <Icons.BookIcon style={{ width: 34, height: 34 }} />
          </div>
          <p className="ios-headline" style={{ margin: "0 0 6px 0" }}>No flashcards yet</p>
          <p className="ios-footnote" style={{ margin: 0, color: "var(--ios-label-2)" }}>
            Generate some with AI or add one manually to start studying.
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
                background: "var(--ios-fill)",
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
            <div className="ios-num" style={{ fontSize: 15, fontWeight: 700, color: colorTag }}>
              {currentIndex + 1}{" "}
              <span style={{ fontWeight: 400, color: "var(--ios-label-3)", fontSize: 13 }}>
                / {orderedCards.length}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={handleShuffle}
                aria-label="Shuffle deck"
                className="ios-caption"
                style={{
                  padding: "5px 11px",
                  borderRadius: 8,
                  background: isShuffled ? "var(--ios-fill)" : "transparent",
                  border: "1px solid var(--ios-separator)",
                  color: isShuffled ? colorTag : "var(--ios-label-2)",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
                Shuffle
              </button>
              {isShuffled && (
                <button
                  onClick={handleReset}
                  aria-label="Reset order"
                  className="ios-caption"
                  style={{
                    padding: "5px 11px",
                    borderRadius: 8,
                    border: "1px solid var(--ios-separator)",
                    color: "var(--ios-label-2)",
                    fontWeight: 600,
                  }}
                >
                  Reset
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
                    background: "var(--ios-cell)",
                    borderRadius: "var(--ios-radius-tile)",
                    padding: "36px 32px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                    minHeight: 220,
                  }}
                >
                  <div className="ios-caption" style={{ fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: colorTag, marginBottom: 18 }}>
                    Question
                  </div>
                  <div className="ios-title-3" style={{ lineHeight: 1.5, color: "var(--ios-label)", maxWidth: 520 }}>
                    {currentCard.question}
                  </div>
                  <div className="ios-caption" style={{ marginTop: 24, color: "var(--ios-label-3)" }}>
                    Tap to flip
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
                    borderRadius: "var(--ios-radius-tile)",
                    padding: "36px 32px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.16)",
                    minHeight: 220,
                  }}
                >
                  <div className="ios-caption" style={{ fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginBottom: 18 }}>
                    Answer
                  </div>
                  <div className="ios-title-3" style={{ lineHeight: 1.5, color: "#fff", maxWidth: 520 }}>
                    {currentCard.answer}
                  </div>
                  {currentCard.context && (
                    <div className="ios-footnote" style={{ marginTop: 20, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, maxWidth: 460, borderTop: "1px solid rgba(255,255,255,0.25)", paddingTop: 16 }}>
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
              className="ios-subhead"
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 10,
                background: "var(--ios-cell)",
                fontWeight: 500,
                color: currentIndex === 0 ? "var(--ios-label-3)" : "var(--ios-label)",
                opacity: currentIndex === 0 ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Icons.ChevronLeft style={{ width: 16, height: 16 }} />
              Previous
            </button>
            <button
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === orderedCards.length - 1}
              className="ios-subhead"
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 10,
                background: "var(--ios-cell)",
                fontWeight: 500,
                color:
                  currentIndex === orderedCards.length - 1
                    ? "var(--ios-label-3)"
                    : "var(--ios-label)",
                opacity: currentIndex === orderedCards.length - 1 ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              Next
              <Icons.ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="ios-caption" style={{ textAlign: "center", color: "var(--ios-label-3)", marginBottom: 24 }}>
            ← → to navigate · Space to flip
          </div>

          {/* ── All Cards List ── */}
          <div>
            <button
              onClick={() => setShowAllCards((v) => !v)}
              className="ios-footnote"
              style={{
                color: "var(--ios-label-2)",
                fontWeight: 600,
                padding: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icons.ChevronRight style={{ width: 14, height: 14, color: colorTag, transform: showAllCards ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
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
                      background: "var(--ios-cell)",
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
                      <div className="ios-caption ios-num" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: colorTag, marginBottom: 4 }}>
                        #{idx + 1} · Q
                      </div>
                      <div className="ios-footnote" style={{ lineHeight: 1.5, color: "var(--ios-label)" }}>
                        {card.question}
                      </div>
                    </div>
                    <div>
                      <div className="ios-caption" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ios-label-3)", marginBottom: 4 }}>
                        A
                      </div>
                      <div className="ios-footnote" style={{ lineHeight: 1.5, color: "var(--ios-label-2)" }}>
                        {card.answer}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      aria-label="Delete card"
                      style={{ color: "var(--ios-red)", flexShrink: 0, marginTop: 14, display: "inline-flex" }}
                    >
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
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
