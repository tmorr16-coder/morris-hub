"use client";

import { useState, useEffect } from "react";
import type { Stock } from "@/lib/stock-research";
import { Icons } from "@/components/ios";

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

  const changeColor =
    stock.changeDirection === "up"
      ? "var(--ios-green)"
      : stock.changeDirection === "down"
        ? "var(--ios-red)"
        : "var(--ios-label-3)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 className="ios-title-2 ios-num" style={{ margin: "0 0 2px" }}>
            {stock.ticker}
          </h1>
          <p className="ios-subhead" style={{ margin: 0, color: "var(--ios-label-2)" }}>
            {stock.name}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={onAddToWatchlist}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 999,
              border: "none",
              background: isWatched ? "var(--ios-tint)" : "var(--ios-fill)",
              color: isWatched ? "var(--ios-on-tint)" : "var(--ios-label)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <Icons.HeartIcon style={{ width: 16, height: 16, fill: isWatched ? "currentColor" : "none" }} />
            {isWatched ? "Watching" : "Watch"}
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 999,
              border: "none",
              background: "var(--ios-fill)",
              color: "var(--ios-label-3)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Price Hero */}
      <div
        style={{
          background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)",
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span className="ios-num" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ios-label)" }}>
            ${stock.price.toFixed(2)}
          </span>
          <span className="ios-num" style={{ fontSize: 16, fontWeight: 600, color: changeColor }}>
            {stock.changeDirection === "up" ? "▲" : "▼"} {Math.abs(stock.change).toFixed(2)}% today
          </span>
        </div>

        {(stock.peRatio || stock.dividend || stock.sector) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 12,
              marginTop: 16,
              paddingTop: 16,
              borderTop: "var(--ios-hair) solid var(--ios-separator)",
            }}
          >
            {stock.peRatio && (
              <div>
                <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>P/E Ratio</div>
                <div className="ios-num" style={{ fontSize: 17, fontWeight: 600, color: "var(--ios-label)" }}>
                  {stock.peRatio.toFixed(1)}
                </div>
              </div>
            )}
            {stock.dividend && (
              <div>
                <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>Dividend Yield</div>
                <div className="ios-num" style={{ fontSize: 17, fontWeight: 600, color: "var(--ios-label)" }}>
                  {stock.dividend.toFixed(2)}%
                </div>
              </div>
            )}
            {stock.sector && (
              <div>
                <div className="ios-footnote" style={{ color: "var(--ios-label-3)" }}>Sector</div>
                <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ios-label)" }}>
                  {stock.sector}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Summary */}
      <div>
        <h3 className="ios-group-header" style={{ padding: "0 0 7px" }}>
          AI Analysis
        </h3>
        <div
          style={{
            background: "var(--ios-cell)",
            borderRadius: "var(--ios-radius-card)",
            padding: 16,
          }}
        >
          {loading && (
            <div className="ios-subhead" style={{ color: "var(--ios-label-3)" }}>
              Generating analysis…
            </div>
          )}

          {error && (
            <div
              className="ios-footnote"
              style={{
                color: "var(--ios-red)",
                padding: "8px 12px",
                background: "color-mix(in srgb, var(--ios-red) 12%, transparent)",
                borderRadius: 10,
              }}
            >
              {error}
            </div>
          )}

          {!loading && summary && (
            <p
              className="ios-subhead"
              style={{
                color: "var(--ios-label-2)",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {summary}
            </p>
          )}
        </div>
      </div>

      {/* Chat toggle */}
      <button
        onClick={() => setShowChat((v) => !v)}
        className={showChat ? "" : "ios-btn ios-btn--primary"}
        style={
          showChat
            ? {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "13px 20px",
                borderRadius: 12,
                minHeight: 50,
                border: "none",
                background: "var(--ios-fill)",
                color: "var(--ios-label)",
                fontSize: 17,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }
            : { fontFamily: "inherit", cursor: "pointer" }
        }
      >
        <Icons.SparkleIcon style={{ width: 18, height: 18 }} />
        {showChat ? "Close Chat" : "Ask About This Stock"}
      </button>

      {/* Inline Stock Chat */}
      {showChat && (
        <div
          style={{
            background: "var(--ios-cell)",
            borderRadius: "var(--ios-radius-card)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h3 className="ios-group-header" style={{ padding: 0 }}>
            Ask About {stock.ticker}
          </h3>

          {chatMessages.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {chatMessages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ios-bubble ios-bubble--me">
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="ios-bubble ios-bubble--ai" style={{ maxWidth: "85%", whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </div>
                )
              )}
              {chatSending && (
                <div className="ios-bubble ios-bubble--ai" style={{ color: "var(--ios-label-2)", fontStyle: "italic" }}>
                  Thinking…
                </div>
              )}
            </div>
          )}

          {chatError && (
            <div
              className="ios-footnote"
              style={{
                color: "var(--ios-red)",
                padding: "6px 10px",
                background: "color-mix(in srgb, var(--ios-red) 12%, transparent)",
                borderRadius: 10,
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
            style={{ display: "flex", gap: 8, alignItems: "center" }}
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatSending}
              placeholder={`Ask anything about ${stock.ticker}…`}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "9px 14px",
                borderRadius: 999,
                background: "var(--ios-fill)",
                border: "var(--ios-hair) solid var(--ios-separator)",
                color: "var(--ios-label)",
                fontSize: 16,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            <button
              type="submit"
              className="ios-send"
              disabled={chatSending || !chatInput.trim()}
              aria-label="Send"
              style={{
                border: "none",
                cursor: chatSending || !chatInput.trim() ? "not-allowed" : "pointer",
                opacity: chatSending || !chatInput.trim() ? 0.5 : 1,
              }}
            >
              <Icons.ChevronRight style={{ width: 18, height: 18, transform: "rotate(-90deg)" }} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
