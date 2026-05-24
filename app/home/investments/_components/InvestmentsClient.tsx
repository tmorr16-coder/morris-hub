"use client";

import { useState, useEffect, useRef } from "react";
import type { InvestmentIdea } from "@/lib/investment-ideas-constants";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/investment-ideas-constants";
import IdeaCard from "./IdeaCard";
import IdeaForm from "./IdeaForm";

interface InvestmentsClientProps {
  savedIdeas: InvestmentIdea[];
  aiIdeas: InvestmentIdea[];
  enabledCategories: string[];
}

type CategoryFilter = string | "all";
type StatusFilter = "all" | "new" | "researching" | "pursuing" | "passed";

export default function InvestmentsClient({
  savedIdeas,
  aiIdeas,
  enabledCategories,
}: InvestmentsClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<"all" | "saved" | "ai">("all");
  const isInitialMount = useRef(true);

  // Load filters from localStorage on first mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const saved = localStorage.getItem("investmentFilters");
      if (saved) {
        try {
          const filters = JSON.parse(saved);
          if (filters.category) setSelectedCategory(filters.category);
          if (filters.status) setSelectedStatus(filters.status);
          setShowFavoritesOnly(filters.showFavoritesOnly === true); // Explicitly check for true
          if (filters.viewMode) setViewMode(filters.viewMode);
        } catch (e) {
          console.error("Failed to load investment filters:", e);
        }
      }
    }
  }, []);

  // Save filters to localStorage whenever they change (after initial mount)
  useEffect(() => {
    if (!isInitialMount.current) {
      localStorage.setItem(
        "investmentFilters",
        JSON.stringify({
          category: selectedCategory,
          status: selectedStatus,
          showFavoritesOnly: showFavoritesOnly,
          viewMode: viewMode,
        })
      );
    }
  }, [selectedCategory, selectedStatus, showFavoritesOnly, viewMode]);

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
      return true;
    });
  };

  const allIdeas = [...aiIdeas, ...savedIdeas];

  const displayedIdeas =
    viewMode === "saved"
      ? filterIdeas(savedIdeas)
      : viewMode === "ai"
        ? filterIdeas(aiIdeas)
        : filterIdeas(allIdeas);

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

        {/* View Mode Toggle */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["all", "saved", "ai"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: `1px solid ${viewMode === mode ? "var(--color-accent)" : "var(--color-rule)"}`,
                background: viewMode === mode ? "var(--color-accent)" : "transparent",
                color: viewMode === mode ? "#FFFDF8" : "var(--color-ink-2)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {mode === "all" ? "All" : mode === "saved" ? "Saved" : "AI Ideas"}
            </button>
          ))}
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

        {/* Spacer */}
        <div style={{ flex: 1 }} />

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
            {viewMode === "saved"
              ? "Add a new idea to get started."
              : viewMode === "ai"
                ? "AI ideas will appear here when generated."
                : "Browse both AI suggestions and your saved ideas."}
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
            <IdeaCard key={idea.id} idea={idea} isAiGenerated={idea.isAiGenerated} />
          ))}
        </div>
      )}

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
