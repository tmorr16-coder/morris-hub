// Investment ideas constants and types safe to import from client components

export const CATEGORY_LABELS: Record<string, string> = {
  stocks: "Stocks",
  real_estate: "Real Estate",
  transportation: "Transportation & Logistics",
  tech: "Emerging Technology",
  other: "Other",
};

export const RISK_COLORS: Record<string, string> = {
  low: "#4CAF50",    // green
  medium: "#FFC107", // amber
  high: "#F44336",   // red
};

export const STATUS_LABELS: Record<string, string> = {
  new: "New",
  researching: "Researching",
  pursuing: "Pursuing",
  passed: "Passed",
};

export const TIME_HORIZON_LABELS: Record<string, string> = {
  short: "Short-term (<1yr)",
  medium: "Medium-term (1-5yr)",
  long: "Long-term (5yr+)",
};

export interface InvestmentIdea {
  id: string;
  userId: string;
  category: "stocks" | "real_estate" | "transportation" | "tech" | "other";
  title: string;
  rationale: string | null;
  riskLevel: "low" | "medium" | "high" | null;
  timeHorizon: "short" | "medium" | "long" | null;
  capitalRequired: string | null;
  expectedReturns: string | null;
  relatedAssets: string[] | null;
  actionItems: string[] | null;
  isAiGenerated: boolean;
  source: "user" | "claude";
  rating: number | null;
  status: "new" | "researching" | "pursuing" | "passed";
  isFavorite: boolean;
  userNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentIdeaInput {
  category: "stocks" | "real_estate" | "transportation" | "tech" | "other";
  title: string;
  rationale?: string;
  riskLevel?: "low" | "medium" | "high";
  timeHorizon?: "short" | "medium" | "long";
  capitalRequired?: string;
  expectedReturns?: string;
  relatedAssets?: string[];
  actionItems?: string[];
  userNotes?: string;
}
