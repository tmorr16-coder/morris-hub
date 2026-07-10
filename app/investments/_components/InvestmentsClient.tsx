"use client";

import { useState, useEffect, useRef } from "react";
import type { InvestmentIdea } from "@/lib/investment-ideas-constants";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/investment-ideas-constants";
import { Chip, Icons } from "@/components/ios";
import IdeaCard from "./IdeaCard";
import IdeaForm from "./IdeaForm";
import InvestmentChat from "./InvestmentChat";

interface InvestmentsClientProps {
  savedIdeas: InvestmentIdea[];
  enabledCategories: string[];
}

type CategoryFilter = string | "all";
type StatusFilter = "all" | "new" | "researching" | "pursuing" | "passed";

export default function InvestmentsClient({
  savedIdeas,
  enabledCategories,
}: InvestmentsClientProps) {
  // Initialize state with localStorage values on mount
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(() => {
    if (typeof window === "undefined") return "all";
    try {
      const saved = localStorage.getItem("investmentFilters");
      if (saved) {
        const filters = JSON.parse(saved);
        return filters.category || "all";
      }
    } catch (e) {
      console.error("Failed to load investment category filter:", e);
    }
    return "all";
  });

  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>(() => {
    if (typeof window === "undefined") return "all";
    try {
      const saved = localStorage.getItem("investmentFilters");
      if (saved) {
        const filters = JSON.parse(saved);
        return filters.status || "all";
      }
    } catch (e) {
      console.error("Failed to load investment status filter:", e);
    }
    return "all";
  });

  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem("investmentFilters");
      if (saved) {
        const filters = JSON.parse(saved);
        return filters.showFavoritesOnly === true;
      }
    } catch (e) {
      console.error("Failed to load investment favorites filter:", e);
    }
    return false;
  });

  const [capitalRange, setCapitalRange] = useState<[number, number]>(() => {
    if (typeof window === "undefined") return [0, 1000000];
    try {
      const saved = localStorage.getItem("investmentFilters");
      if (saved) {
        const filters = JSON.parse(saved);
        if (filters.capitalRange && Array.isArray(filters.capitalRange)) {
          return filters.capitalRange as [number, number];
        }
      }
    } catch (e) {
      console.error("Failed to load investment capital filter:", e);
    }
    return [0, 1000000];
  });

  const [returnsRange, setReturnsRange] = useState<[number, number]>(() => {
    if (typeof window === "undefined") return [0, 100];
    try {
      const saved = localStorage.getItem("investmentFilters");
      if (saved) {
        const filters = JSON.parse(saved);
        if (filters.returnsRange && Array.isArray(filters.returnsRange)) {
          return filters.returnsRange as [number, number];
        }
      }
    } catch (e) {
      console.error("Failed to load investment returns filter:", e);
    }
    return [0, 100];
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [allIdeas, setAllIdeas] = useState<InvestmentIdea[]>([]);

  const hasAiIdeas = allIdeas.some((i) => i.isAiGenerated);

  const handleGenerateIdeas = async () => {
    setGeneratingIdeas(true);
    setGenerateError(null);
    try {
      const response = await fetch("/api/investments/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: enabledCategories }),
      });
      if (!response.ok) throw new Error("Failed to generate ideas");
      const freshAiIdeas: InvestmentIdea[] = await response.json();
      // Replace AI ideas in-place; keep user-created ones untouched
      setAllIdeas((prev) => [
        ...prev.filter((i) => !i.isAiGenerated),
        ...freshAiIdeas,
      ]);
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Error generating ideas");
    } finally {
      setGeneratingIdeas(false);
    }
  };;


  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(
        "investmentFilters",
        JSON.stringify({
          category: selectedCategory,
          status: selectedStatus,
          showFavoritesOnly: showFavoritesOnly,
          capitalRange,
          returnsRange,
        })
      );
      console.log("Investment filters saved:", { selectedCategory, selectedStatus, showFavoritesOnly, capitalRange, returnsRange });
    } catch (e) {
      console.error("Failed to save investment filters:", e);
    }
  }, [selectedCategory, selectedStatus, showFavoritesOnly, capitalRange, returnsRange]);

  // Helper functions to parse currency and percentage values
  const parseCapital = (str: string | undefined): number => {
    if (!str) return 0;
    return parseFloat(str.replace(/[\$,]/g, '')) || 0;
  };

  const parseReturns = (str: string | undefined): number => {
    if (!str) return 0;
    return parseFloat(str.replace(/%/g, '')) || 0;
  };

  // Filter ideas based on selections
  const filterIdeas = (ideas: InvestmentIdea[]) => {
    return ideas.filter((idea) => {
      if (
        selectedCategory !== "all" &&
        idea.category !== selectedCategory
      )
        return false;
      if (selectedStatus !== "all" && idea.status !== selectedStatus)
        return false;
      if (showFavoritesOnly && !idea.isFavorite) return false;

      // Capital required range filter
      if (idea.capitalRequired) {
        const amount = parseCapital(idea.capitalRequired);
        if (amount < capitalRange[0] || amount > capitalRange[1]) return false;
      }

      // Expected returns range filter
      if (idea.expectedReturns) {
        const percent = parseReturns(idea.expectedReturns);
        if (percent < returnsRange[0] || percent > returnsRange[1]) return false;
      }

      return true;
    });
  };

  // Seed allIdeas from server-loaded ideas on mount
  useEffect(() => {
    setAllIdeas(savedIdeas);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update local ideas when favorites change
  const handleFavoriteToggle = (ideaId: string, newFavoriteStatus: boolean) => {
    setAllIdeas((prev) =>
      prev.map((idea) =>
        idea.id === ideaId ? { ...idea, isFavorite: newFavoriteStatus } : idea
      )
    );
  };

  // Simple filter: show all ideas, optionally filtered by favorites
  const displayedIdeas = filterIdeas(allIdeas);

  const favoriteCount = savedIdeas.filter((i) => i.isFavorite).length;

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    ...Object.entries(STATUS_LABELS).map(([key, label]) => ({
      value: key as StatusFilter,
      label,
    })),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Category Filter */}
        <div>
          <div className="ios-group-header" style={{ padding: "0 0 7px" }}>
            Category
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 2,
              WebkitOverflowScrolling: "touch",
            }}
          >
            <Chip
              small
              selected={selectedCategory === "all"}
              onClick={() => setSelectedCategory("all")}
            >
              All
            </Chip>
            {enabledCategories.map((cat) => (
              <Chip
                key={cat}
                small
                selected={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat as CategoryFilter)}
              >
                {CATEGORY_LABELS[cat] || cat}
              </Chip>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <div className="ios-group-header" style={{ padding: "0 0 7px" }}>
            Status
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 2,
              WebkitOverflowScrolling: "touch",
            }}
          >
            {statusOptions.map((o) => (
              <Chip
                key={o.value}
                small
                selected={selectedStatus === o.value}
                onClick={() => setSelectedStatus(o.value)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Favorites Toggle */}
        <div style={{ display: "flex", gap: 8 }}>
          <Chip
            small
            selected={showFavoritesOnly}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <StarGlyph
              filled={showFavoritesOnly}
              style={{
                width: 14,
                height: 14,
                color: showFavoritesOnly ? "var(--ios-on-tint)" : "var(--ios-orange)",
              }}
            />
            Favorites{favoriteCount > 0 ? ` (${favoriteCount})` : ""}
          </Chip>
        </div>

        {/* Capital Required Range */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 4,
            }}
          >
            <span className="ios-group-header" style={{ padding: 0 }}>
              Capital
            </span>
            <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
              ${(capitalRange[0] / 1000).toFixed(0)}k – ${(capitalRange[1] / 1000).toFixed(0)}k
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              type="range"
              min="0"
              max="1000000"
              step="50000"
              value={capitalRange[0]}
              onChange={(e) => {
                const newMin = parseInt(e.target.value);
                if (newMin <= capitalRange[1]) {
                  setCapitalRange([newMin, capitalRange[1]]);
                }
              }}
              style={{ width: "100%", cursor: "pointer", accentColor: "var(--ios-tint)" }}
              title="Min capital required"
            />
            <input
              type="range"
              min="0"
              max="1000000"
              step="50000"
              value={capitalRange[1]}
              onChange={(e) => {
                const newMax = parseInt(e.target.value);
                if (newMax >= capitalRange[0]) {
                  setCapitalRange([capitalRange[0], newMax]);
                }
              }}
              style={{ width: "100%", cursor: "pointer", accentColor: "var(--ios-tint)" }}
              title="Max capital required"
            />
          </div>
        </div>

        {/* Expected Returns Range */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 4,
            }}
          >
            <span className="ios-group-header" style={{ padding: 0 }}>
              Returns
            </span>
            <span className="ios-footnote ios-num" style={{ color: "var(--ios-label-2)" }}>
              {returnsRange[0]}% – {returnsRange[1]}%
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={returnsRange[0]}
              onChange={(e) => {
                const newMin = parseInt(e.target.value);
                if (newMin <= returnsRange[1]) {
                  setReturnsRange([newMin, returnsRange[1]]);
                }
              }}
              style={{ width: "100%", cursor: "pointer", accentColor: "var(--ios-tint)" }}
              title="Min expected returns"
            />
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={returnsRange[1]}
              onChange={(e) => {
                const newMax = parseInt(e.target.value);
                if (newMax >= returnsRange[0]) {
                  setReturnsRange([returnsRange[0], newMax]);
                }
              }}
              style={{ width: "100%", cursor: "pointer", accentColor: "var(--ios-tint)" }}
              title="Max expected returns"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={() => setShowAddForm(true)}
          className="ios-btn ios-btn--primary"
        >
          <Icons.PlusIcon style={{ width: 18, height: 18 }} />
          Add New Idea
        </button>
        <button
          onClick={handleGenerateIdeas}
          disabled={generatingIdeas}
          title="Generate AI investment ideas (uses API credits)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "13px 20px",
            borderRadius: 12,
            minHeight: 50,
            border: "none",
            background: "var(--ios-fill)",
            color: "var(--ios-tint)",
            fontSize: 17,
            fontWeight: 600,
            cursor: generatingIdeas ? "not-allowed" : "pointer",
            opacity: generatingIdeas ? 0.6 : 1,
          }}
        >
          <Icons.SparkleIcon style={{ width: 18, height: 18 }} />
          {generatingIdeas ? "Generating…" : hasAiIdeas ? "Refresh AI Ideas" : "Generate AI Ideas"}
        </button>
      </div>

      {/* Error Message */}
      {generateError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "color-mix(in srgb, var(--ios-red) 14%, transparent)",
            color: "var(--ios-red)",
            fontSize: 13,
          }}
        >
          Failed to generate ideas: {generateError}
        </div>
      )}

      {/* Ideas List */}
      {displayedIdeas.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--ios-label-3)",
          }}
        >
          <p className="ios-subhead">No ideas match your filters.</p>
          <p className="ios-footnote" style={{ marginTop: 8 }}>
            {showFavoritesOnly
              ? "Mark ideas as favorites to see them here."
              : "Add a new idea or generate AI suggestions to get started."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {displayedIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              isAiGenerated={idea.isAiGenerated}
              onFavoriteToggle={handleFavoriteToggle}
            />
          ))}
        </div>
      )}

      {/* Research Chat Section */}
      <div>
        <div className="ios-list" style={{ margin: 0 }}>
          <button
            type="button"
            className="ios-cell"
            onClick={() => setShowChat(!showChat)}
          >
            <span className="ios-cell-lead">
              <span className="ios-icon" style={{ background: "var(--ios-tint)" }}>
                <Icons.SparkleIcon />
              </span>
            </span>
            <span className="ios-cell-body">
              <span className="ios-cell-title">Research Chat</span>
              <span className="ios-cell-sub">Ask about your displayed ideas</span>
            </span>
            <Icons.ChevronRight
              className="ios-chevron"
              style={{ transform: showChat ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
            />
          </button>
        </div>

        {showChat && (
          <div style={{ marginTop: 12 }}>
            <InvestmentChat
              displayedIdeas={displayedIdeas}
              selectedCategory={selectedCategory}
              selectedStatus={selectedStatus}
              showFavoritesOnly={showFavoritesOnly}
              capitalRange={capitalRange}
              returnsRange={returnsRange}
            />
          </div>
        )}
      </div>

      {/* Add Idea Form Sheet */}
      {showAddForm && (
        <IdeaForm
          onClose={() => setShowAddForm(false)}
          categories={enabledCategories}
        />
      )}
    </div>
  );
}

/** Small star glyph — filled or outline, inherits currentColor. */
function StarGlyph({ filled, style }: { filled?: boolean; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={{ width: 16, height: 16, ...style }}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
    >
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />
    </svg>
  );
}
