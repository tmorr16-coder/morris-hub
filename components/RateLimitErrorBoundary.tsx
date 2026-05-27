"use client";

import React, { ReactNode, useState, useEffect } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isRateLimited: boolean;
  retryCount: number;
}

/**
 * Error boundary that catches Supabase auth rate limit errors (429)
 * and displays graceful UI with automatic retry capability
 */
export class RateLimitErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isRateLimited: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error) {
    const isRateLimited =
      error.message.includes("request_rate_limit") ||
      error.message.includes("429") ||
      error.message.includes("Request rate limit");

    return {
      hasError: true,
      error,
      isRateLimited,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    if (typeof process !== "undefined" && process.env.DEBUG_AUTH === "true") {
      console.error("[RateLimitErrorBoundary] Caught error:", error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isRateLimited) {
        return (
          <RateLimitErrorUI
            error={this.state.error}
            retryCount={this.state.retryCount}
            onRetry={this.handleRetry}
          />
        );
      }

      // Non-rate-limit errors: show generic error
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              maxWidth: "400px",
              padding: "24px",
              borderRadius: "12px",
              background: "rgba(154,59,42,0.08)",
              border: "1px solid #9A3B2A",
            }}
          >
            <h2 style={{ color: "#9A3B2A", marginTop: 0 }}>Error</h2>
            <p style={{ color: "#6B6258", lineHeight: "1.6" }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={this.handleRetry}
              style={{
                padding: "8px 16px",
                background: "#9A3B2A",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * UI for rate limit errors with retry feedback
 */
function RateLimitErrorUI({
  error,
  retryCount,
  onRetry,
}: {
  error: Error | null;
  retryCount: number;
  onRetry: () => void;
}) {
  const [showRefreshHint, setShowRefreshHint] = useState(false);

  useEffect(() => {
    // After 3+ retries, suggest page refresh
    if (retryCount >= 3) {
      const timer = setTimeout(() => setShowRefreshHint(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [retryCount]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "400px",
          padding: "32px",
          borderRadius: "12px",
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.1)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          textAlign: "center",
        }}
      >
        {/* Loading spinner animation */}
        <div
          style={{
            width: "48px",
            height: "48px",
            margin: "0 auto 16px",
            borderRadius: "50%",
            border: "2px solid rgba(26,26,26,0.1)",
            borderTopColor: "#1a1a1a",
            animation: "spin 0.8s linear infinite",
          }}
        />

        <h2 style={{ margin: "16px 0 8px", color: "#1a1a1a", fontSize: "18px" }}>
          System Busy
        </h2>

        <p style={{ margin: "0 0 16px", color: "#6B6258", fontSize: "14px", lineHeight: "1.6" }}>
          We're experiencing high traffic. Please give us a moment...
          {retryCount > 0 && <span> (Retry {retryCount})</span>}
        </p>

        {showRefreshHint && (
          <p style={{ margin: "12px 0", color: "#9A3B2A", fontSize: "13px" }}>
            If this continues, please{" "}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "none",
                border: "none",
                color: "#9A3B2A",
                textDecoration: "underline",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              refresh the page
            </button>
          </p>
        )}

        <button
          onClick={onRetry}
          style={{
            marginTop: "16px",
            padding: "8px 16px",
            background: "#1a1a1a",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          Try Again
        </button>

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * Hook to enable graceful degradation for rate limit errors
 * Returns cached/stale data when auth is unavailable
 *
 * Usage:
 * ```typescript
 * const data = useGracefulDegradation(
 *   fetchFreshData,
 *   "cache-key",
 *   defaultFallbackData
 * );
 * ```
 */
export function useGracefulDegradation<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  fallback: T
): { data: T; isFresh: boolean; error: Error | null } {
  const [data, setData] = useState<T>(fallback);
  const [isFresh, setIsFresh] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const fresh = await fetchFn();
        if (isMounted) {
          setData(fresh);
          setIsFresh(true);
          setError(null);
          // Cache to localStorage as fallback
          try {
            localStorage.setItem(cacheKey, JSON.stringify(fresh));
          } catch (e) {
            // LocalStorage full or disabled, ignore
          }
        }
      } catch (err) {
        if (isMounted) {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);

          // Try to load from cache
          try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              setData(parsed);
              setIsFresh(false);
            }
          } catch (e) {
            // Cache invalid or unavailable, use fallback
            setData(fallback);
          }
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [fetchFn, cacheKey, fallback]);

  return { data, isFresh, error };
}
