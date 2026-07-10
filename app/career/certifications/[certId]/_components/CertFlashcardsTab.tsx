"use client";

import { useState, useCallback, useEffect } from "react";
import { Segmented, Chip } from "@/components/ios";

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

  const smallFilled: React.CSSProperties = {
    padding: "10px 18px", borderRadius: 10, border: "none",
    background: loading ? "var(--ios-fill)" : "var(--ios-tint)",
    color: loading ? "var(--ios-label-2)" : "var(--ios-on-tint)",
    fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer",
    opacity: loading ? 0.7 : 1,
  };

  const navBtn = (disabled: boolean): React.CSSProperties => ({
    flex: 1, padding: "12px", borderRadius: 12,
    border: "var(--ios-hair) solid var(--ios-separator)",
    background: "var(--ios-cell)",
    color: disabled ? "var(--ios-label-3)" : "var(--ios-label)",
    fontSize: 16, fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 className="ios-title-3" style={{ margin: 0 }}>
          Flashcards — {examName}
        </h2>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Count selector */}
          <Segmented
            options={COUNT_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            value={String(countOption)}
            onChange={(v) => setCountOption(Number(v))}
            ariaLabel="Number of flashcards"
          />

          <button type="button" onClick={handleGenerate} disabled={loading} style={smallFilled}>
            {loading
              ? "Generating…"
              : hasDeck
              ? "Regenerate"
              : "Generate flashcards"}
          </button>
        </div>
      </div>

      {error && (
        <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: 0 }}>{error}</p>
      )}

      {!hasDeck && !loading && (
        <div className="ios-list" style={{ margin: 0, padding: "48px 32px", textAlign: "center" }}>
          <div className="ios-headline" style={{ color: "var(--ios-label)", marginBottom: 6 }}>No flashcards yet</div>
          <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: 0, lineHeight: 1.5, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Tap &ldquo;Generate flashcards&rdquo; to create a deck using your uploaded study materials and exam domains.
          </p>
        </div>
      )}

      {loading && (
        <div className="ios-list" style={{ margin: 0, padding: "48px 32px", textAlign: "center" }}>
          <div className="ios-body" style={{ display: "inline-flex", gap: 4, alignItems: "center", color: "var(--ios-label-2)" }}>
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
          <div style={{ marginBottom: 10 }}>
            <div style={{ height: 5, borderRadius: 3, background: "var(--ios-fill)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPercent}%`, background: colorTag, transition: "width 0.2s ease", borderRadius: 3 }} />
            </div>
          </div>

          {/* Card counter row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="ios-num" style={{ fontSize: 15, fontWeight: 700, color: "var(--ios-label)" }}>
              Card {currentIndex + 1}
              <span style={{ fontWeight: 400, color: "var(--ios-label-2)", fontSize: 13 }}>
                {" "}/ {cards.length}
              </span>
            </div>

            {/* Domain badge */}
            {domainMatch && <Chip small>{domainMatch.name}</Chip>}
            {!domainMatch && currentCard?.domain_name && <Chip small>{currentCard.domain_name}</Chip>}
          </div>

          {/* Flip card */}
          {currentCard && (
            <div
              onClick={() => setIsFlipped((f) => !f)}
              style={{ position: "relative", minHeight: 220, marginBottom: 16, cursor: "pointer", perspective: 800 }}
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
                    background: "var(--ios-cell)",
                    border: "var(--ios-hair) solid var(--ios-separator)",
                    borderRadius: 16,
                    padding: "36px 32px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    minHeight: 220,
                  }}
                >
                  <div className="ios-caption" style={{ fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: colorTag, marginBottom: 18 }}>
                    Question
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, color: "var(--ios-label)", maxWidth: 520 }}>
                    {currentCard.question}
                  </div>
                  <div className="ios-caption" style={{ marginTop: 24, color: "var(--ios-label-3)" }}>
                    Tap or press Space to flip
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
                    borderRadius: 16,
                    padding: "36px 32px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    textAlign: "center",
                    minHeight: 220,
                  }}
                >
                  <div className="ios-caption" style={{ fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginBottom: 18 }}>
                    Answer
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.5, color: "#fff", maxWidth: 520 }}>
                    {currentCard.answer}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} style={navBtn(currentIndex === 0)}>
              ← Previous
            </button>
            <button type="button" onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === cards.length - 1} style={navBtn(currentIndex === cards.length - 1)}>
              Next →
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="ios-caption" style={{ textAlign: "center", color: "var(--ios-label-2)", marginBottom: 8 }}>
            ← → to navigate · Space to flip
          </div>

          {/* Note: flashcards are ephemeral — generated in-session */}
          <div className="ios-caption" style={{ textAlign: "center", color: "var(--ios-label-3)" }}>
            These flashcards are generated fresh each session. Tap &ldquo;Regenerate&rdquo; for a new set.
          </div>
        </div>
      )}
    </div>
  );
}
