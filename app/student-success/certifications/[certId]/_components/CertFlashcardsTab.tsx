"use client";

import { useState, useCallback, useEffect } from "react";

interface Domain {
  id: string;
  name: string;
  weight_pct: number;
  description: string | null;
  sort_order: number;
}

interface GeneratedCard {
  question: string;
  answer: string;
  domain_name: string;
}

interface CertFlashcardsTabProps {
  examId: string;
  examName: string;
  domains: Domain[];
  colorTag: string;
}

export default function CertFlashcardsTab({
  examId,
  examName,
  domains,
  colorTag,
}: CertFlashcardsTabProps) {
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [countOption, setCountOption] = useState(10);

  const hasDeck = cards.length > 0;

  // Keyboard navigation
  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(cards.length - 1, index)));
      setIsFlipped(false);
    },
    [cards.length]
  );

  useEffect(() => {
    if (!hasDeck) return;
    const handler = (e: KeyboardEvent) => {
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
  }, [currentIndex, goTo, hasDeck]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/student-support/certifications/${examId}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "flashcards", count: countOption }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Generation failed");
      }

      const data = await res.json();
      if (!Array.isArray(data.cards) || data.cards.length === 0) {
        throw new Error("No flashcards were returned");
      }
      setCards(data.cards);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const currentCard = cards[currentIndex] ?? null;
  const progressPercent = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  // Find domain badge for current card
  const domainMatch = currentCard
    ? domains.find(
        (d) => d.name.toLowerCase() === currentCard.domain_name?.toLowerCase()
      )
    : null;

  const COUNT_OPTIONS = [5, 10, 15, 20];

  return (
    <div>
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
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
          Flashcards — {examName}
        </h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Count selector */}
          <div style={{ position: "relative" }}>
            <select
              value={countOption}
              onChange={(e) => setCountOption(Number(e.target.value))}
              style={{
                padding: "7px 28px 7px 10px",
                border: "1px solid var(--color-rule)",
                borderRadius: 7,
                fontSize: 12,
                appearance: "none",
                background: "var(--color-paper)",
                color: "var(--color-ink)",
                cursor: "pointer",
              }}
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
                right: 8,
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

          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              border: "none",
              background: loading ? "var(--color-paper-deep)" : colorTag,
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Generating…"
              : hasDeck
              ? "Regenerate"
              : "Generate Flashcards from exam materials"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 7,
            background: "#fee2e2",
            color: "#991b1b",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {!hasDeck && !loading && (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px dashed var(--color-rule)",
            borderRadius: 12,
            padding: "56px 32px",
            textAlign: "center",
            color: "var(--color-ink-3)",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 14 }}>🃏</div>
          <p
            style={{
              margin: "0 0 6px 0",
              fontWeight: 600,
              color: "var(--color-ink-2)",
              fontSize: 15,
            }}
          >
            No flashcards yet
          </p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Click "Generate Flashcards from exam materials" to create a deck
            using your uploaded study materials and exam domains.
          </p>
        </div>
      )}

      {loading && (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "56px 32px",
            textAlign: "center",
            color: "var(--color-ink-3)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              gap: 4,
              alignItems: "center",
              fontSize: 14,
              color: "var(--color-ink-2)",
            }}
          >
            <span>Generating {countOption} flashcards</span>
            <span>
              <span style={{ animation: "blink 0.7s infinite" }}>•</span>
              <span style={{ animation: "blink 0.7s infinite 0.2s" }}>•</span>
              <span style={{ animation: "blink 0.7s infinite 0.4s" }}>•</span>
            </span>
          </div>
          <style>{`
            @keyframes blink {
              0%, 100% { opacity: 0.3; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {hasDeck && !loading && (
        <div style={{ maxWidth: 680 }}>
          {/* Progress bar */}
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                height: 5,
                borderRadius: 3,
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
                  borderRadius: 3,
                }}
              />
            </div>
          </div>

          {/* Card counter row */}
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
              Card {currentIndex + 1}
              <span
                style={{
                  fontWeight: 400,
                  color: "var(--color-ink-3)",
                  fontSize: 13,
                }}
              >
                {" "}/ {cards.length}
              </span>
            </div>

            {/* Domain badge */}
            {domainMatch && (
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: colorTag + "18",
                  color: colorTag,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                {domainMatch.name}
              </span>
            )}
            {!domainMatch && currentCard?.domain_name && (
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: "var(--color-paper-deep)",
                  color: "var(--color-ink-3)",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {currentCard.domain_name}
              </span>
            )}
          </div>

          {/* Flip card */}
          {currentCard && (
            <div
              onClick={() => setIsFlipped((f) => !f)}
              style={{
                position: "relative",
                minHeight: 220,
                marginBottom: 16,
                cursor: "pointer",
                perspective: 800,
              }}
            >
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
                    borderRadius: 14,
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
                      fontSize: 18,
                      fontWeight: 600,
                      lineHeight: 1.5,
                      color: "#1a1a2e",
                      maxWidth: 520,
                    }}
                  >
                    {currentCard.question}
                  </div>
                  <div style={{ marginTop: 24, fontSize: 11, color: "#a0a0b0" }}>
                    Click or press Space to flip
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
                    borderRadius: 14,
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
                      fontSize: 18,
                      fontWeight: 600,
                      lineHeight: 1.5,
                      color: "white",
                      maxWidth: 520,
                    }}
                  >
                    {currentCard.answer}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => goTo(currentIndex - 1)}
              disabled={currentIndex === 0}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 7,
                border: "1px solid var(--color-rule)",
                background:
                  currentIndex === 0 ? "var(--color-paper-deep)" : "transparent",
                cursor: currentIndex === 0 ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                color:
                  currentIndex === 0
                    ? "var(--color-ink-3)"
                    : "var(--color-ink)",
                opacity: currentIndex === 0 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>
            <button
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === cards.length - 1}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 7,
                border: "1px solid var(--color-rule)",
                background:
                  currentIndex === cards.length - 1
                    ? "var(--color-paper-deep)"
                    : "transparent",
                cursor:
                  currentIndex === cards.length - 1 ? "default" : "pointer",
                fontSize: 13,
                fontWeight: 500,
                color:
                  currentIndex === cards.length - 1
                    ? "var(--color-ink-3)"
                    : "var(--color-ink)",
                opacity: currentIndex === cards.length - 1 ? 0.5 : 1,
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
              marginBottom: 8,
            }}
          >
            ← → to navigate · Space to flip
          </div>

          {/* Note: flashcards are ephemeral — generated in-session */}
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "var(--color-ink-4)",
            }}
          >
            These flashcards are generated fresh each session. Click "Regenerate" for a new set.
          </div>
        </div>
      )}
    </div>
  );
}
