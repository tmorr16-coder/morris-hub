"use client";

import { useState, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";

interface StockDetailProps {
  stock: Stock;
  onAddToWatchlist: () => void;
  isWatched: boolean;
  onClose: () => void;
}

export default function StockDetail({
  stock,
  onAddToWatchlist,
  isWatched,
  onClose,
}: StockDetailProps) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/investments/stock-summary?ticker=${stock.ticker}`
        );

        if (!response.ok) {
          throw new Error("Failed to load summary");
        }

        const data = await response.json();
        setSummary(data.summary);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [stock.ticker]);

  const sendChatMessage = async (text: string) => {
    const userMsg = { role: "user" as const, content: text };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatSending(true);
    setChatError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          systemPrompt: `You are a financial research assistant helping analyze ${stock.ticker} (${stock.name}). Current price: $${stock.price.toFixed(2)}${stock.peRatio ? `, P/E: ${stock.peRatio.toFixed(1)}` : ""}${stock.dividend ? `, Dividend: ${stock.dividend.toFixed(2)}%` : ""}${stock.sector ? `, Sector: ${stock.sector}` : ""}. Provide balanced investment research. This is not financial advice.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat failed");
      setChatMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setChatError((e as Error).message);
      setChatMessages(newMessages);
    } finally {
      setChatSending(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "20px 24px",
        maxWidth: 800,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1
            className="serif"
            style={{
              fontSize: 24,
              margin: "0 0 4px 0",
              color: "var(--color-ink)",
            }}
          >
            {stock.ticker}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-ink-2)",
            }}
          >
            {stock.name}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onAddToWatchlist}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--color-rule)",
              background: isWatched ? "var(--color-accent)" : "transparent",
              color: isWatched ? "#FFFDF8" : "var(--color-ink)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!isWatched) {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--color-bg)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isWatched) {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }
            }}
          >
            {isWatched ? "❤️ Watched" : "🤍 Watch"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--color-rule)",
              background: "transparent",
              color: "var(--color-ink-3)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Price Card */}
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "16px 20px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 32, fontWeight: 600, color: "var(--color-ink)" }}>
            ${stock.price.toFixed(2)}
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 500,
              color:
                stock.changeDirection === "up"
                  ? "var(--color-green)"
                  : stock.changeDirection === "down"
                    ? "var(--color-red)"
                    : "var(--color-ink-3)",
            }}
          >
            {stock.changeDirection === "up" ? "↑" : "↓"} {Math.abs(stock.change).toFixed(2)}% today
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--color-rule)",
            fontSize: 12,
          }}
        >
          {stock.peRatio && (
            <div>
              <span style={{ color: "var(--color-ink-3)" }}>P/E Ratio</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>
                {stock.peRatio.toFixed(1)}
              </div>
            </div>
          )}
          {stock.dividend && (
            <div>
              <span style={{ color: "var(--color-ink-3)" }}>Dividend Yield</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>
                {stock.dividend.toFixed(2)}%
              </div>
            </div>
          )}
          {stock.sector && (
            <div>
              <span style={{ color: "var(--color-ink-3)" }}>Sector</span>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-ink)" }}>
                {stock.sector}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Summary */}
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-rule)",
          borderRadius: 12,
          padding: "16px 20px",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: "0 0 12px 0",
            color: "var(--color-ink)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          📊 AI Analysis
        </h3>

        {loading && (
          <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>
            Generating analysis...
          </div>
        )}

        {error && (
          <div
            style={{
              fontSize: 13,
              color: "var(--color-red)",
              padding: "8px 12px",
              background: "rgba(154,59,42,0.08)",
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}

        {!loading && summary && (
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--color-ink-2)",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {summary}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
        <button
          onClick={() => setShowChat((v) => !v)}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--color-rule)",
            background: showChat ? "var(--color-bg)" : "var(--color-accent)",
            color: showChat ? "var(--color-ink)" : "#FFFDF8",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 500,
            transition: "all 0.2s",
          }}
        >
          💬 {showChat ? "Close Chat" : "Ask About This Stock"}
        </button>
      </div>

      {/* Inline Stock Chat */}
      {showChat && (
        <div
          style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 12,
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              margin: "0 0 4px 0",
              color: "var(--color-ink)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            💬 Ask About {stock.ticker}
          </h3>

          {chatMessages.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {chatMessages.map((m, i) =>
                m.role === "user" ? (
                  <div
                    key={i}
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "80%",
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "var(--color-accent)",
                      color: "#FFFDF8",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    {m.content}
                  </div>
                ) : (
                  <div
                    key={i}
                    style={{
                      alignSelf: "flex-start",
                      maxWidth: "92%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-rule)",
                      fontSize: 13,
                      color: "var(--color-ink)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {m.content}
                  </div>
                )
              )}
              {chatSending && (
                <div style={{ fontSize: 12, color: "var(--color-ink-3)", fontStyle: "italic" }}>
                  Thinking…
                </div>
              )}
            </div>
          )}

          {chatError && (
            <div
              style={{
                fontSize: 12,
                color: "var(--color-red)",
                padding: "6px 10px",
                background: "rgba(154,59,42,0.08)",
                borderRadius: 6,
              }}
            >
              {chatError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const text = chatInput.trim();
              if (text && !chatSending) sendChatMessage(text);
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatSending}
              placeholder={`Ask anything about ${stock.ticker}…`}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "1px solid var(--color-rule)",
                borderRadius: 8,
                background: "var(--color-bg)",
                color: "var(--color-ink)",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={chatSending || !chatInput.trim()}
              style={{
                padding: "9px 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--color-accent)",
                color: "#FFFDF8",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: chatSending || !chatInput.trim() ? "not-allowed" : "pointer",
                opacity: chatSending || !chatInput.trim() ? 0.5 : 1,
              }}
            >
              Ask
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
