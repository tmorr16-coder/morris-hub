"use client";

import { useState, useEffect, useRef } from "react";
import type { InvestmentIdea } from "@/lib/investment-ideas-constants";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/investment-ideas-constants";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          paddingBottom: 12,
          borderBottom: "1px solid var(--color-rule)",
        }}
      >
        {/* Category Filter */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--color-ink-3)", fontWeight: 600 }}>
            CATEGORY
          </span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as CategoryFilter)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-rule)",
              background: "var(--color-bg)",
              color: "var(--color-ink)",
              fontSize: 12,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <option value="all">All Categories</option>
            {enabledCategories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--color-ink-3)", fontWeight: 600 }}>
            STATUS
          </span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as StatusFilter)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--color-rule)",
              background: "var(--color-bg)",
              color: "var(--color-ink)",
              fontSize: 12,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Favorites Toggle */}
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid var(--color-rule)",
            background: showFavoritesOnly ? "var(--color-accent)" : "transparent",
            color: showFavoritesOnly ? "#FFFDF8" : "var(--color-ink-2)",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ⭐ Favorites {favoriteCount > 0 && `(${favoriteCount})`}
        </button>

        {/* Capital Required Range Slider */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--color-ink-3)", fontWeight: 600 }}>
            CAPITAL
          </span>
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
            style={{
              width: "100px",
              cursor: "pointer",
            }}
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
            style={{
              width: "100px",
              cursor: "pointer",
            }}
            title="Max capital required"
          />
          <span style={{ fontSize: 10, color: "var(--color-ink-2)", minWidth: "80px" }}>
            ${(capitalRange[0] / 1000).toFixed(0)}k - ${(capitalRange[1] / 1000).toFixed(0)}k
          </span>
        </div>

        {/* Expected Returns Range Slider */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--color-ink-3)", fontWeight: 600 }}>
            RETURNS
          </span>
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
            style={{
              width: "80px",
              cursor: "pointer",
            }}
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
            style={{
              width: "80px",
              cursor: "pointer",
            }}
            title="Max expected returns"
          />
          <span style={{ fontSize: 10, color: "var(--color-ink-2)", minWidth: "60px" }}>
            {returnsRange[0]}% - {returnsRange[1]}%
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Generate AI Ideas Button */}
        <button
          onClick={handleGenerateIdeas}
          disabled={generatingIdeas}
          title="Generate AI investment ideas (uses API credits)"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--color-rule)",
            background: generatingIdeas ? "var(--color-bg)" : "transparent",
            color: generatingIdeas ? "var(--color-ink-3)" : "var(--color-ink-2)",
            fontSize: 12,
            fontWeight: 500,
            cursor: generatingIdeas ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            opacity: generatingIdeas ? 0.6 : 1,
          }}
        >
          {generatingIdeas ? "Generating..." : hasAiIdeas ? "↺ Refresh AI Ideas" : "✨ Generate AI Ideas"}
        </button>

        {/* Add New Idea Button */}
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--color-accent-dark)",
            background: "var(--color-accent)",
            color: "#FFFDF8",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          + Add New Idea
        </button>
      </div>

      {/* Error Message */}
      {generateError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            background: "rgba(220, 38, 38, 0.1)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            color: "var(--color-red)",
            fontSize: 12,
          }}
        >
          Failed to generate ideas: {generateError}
        </div>
      )}

      {/* Ideas Grid */}
      {displayedIdeas.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "var(--color-ink-3)",
          }}
        >
          <p style={{ fontSize: 14 }}>No ideas match your filters.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            {showFavoritesOnly
              ? "Mark ideas as favorites to see them here."
              : "Add a new idea or generate AI suggestions to get started."}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
            alignItems: "stretch",
          }}
        >
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
      <div style={{ borderTop: "1px solid var(--color-rule)", paddingTop: 12 }}>
        <button
          onClick={() => setShowChat(!showChat)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            padding: "8px 0",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-ink)",
            fontFamily: "inherit",
          }}
        >
          <span>{showChat ? "▼" : "▶"}</span>
          <span>💬 Research Chat</span>
        </button>

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

      {/* Add Idea Form Modal */}
      {showAddForm && (
        <IdeaForm
          onClose={() => setShowAddForm(false)}
          categories={enabledCategories}
        />
      )}
    </div>
  );
}
