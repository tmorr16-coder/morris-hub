"use client";

import React from "react";

/**
 * Lightweight markdown renderer for chat assistant messages.
 * Handles: headings, bold, italic, inline code, code blocks,
 * unordered lists, ordered lists, horizontal rules, paragraphs.
 * No external dependencies.
 */

// ── Inline formatting ────────────────────────────────────────────────────────

function renderInline(text: string, key?: number | string): React.ReactNode {
  // Process: **bold**, *italic*, `code`, and plain text
  const parts: React.ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2] !== undefined) {
      parts.push(<strong key={match.index} style={{ fontWeight: 600 }}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      parts.push(
        <code key={match.index} style={{
          fontFamily: "var(--font-jetbrains-mono, monospace)",
          fontSize: "0.875em",
          background: "rgba(0,0,0,0.07)",
          borderRadius: 3,
          padding: "1px 5px",
        }}>
          {match[4]}
        </code>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <React.Fragment key={key}>{parts}</React.Fragment>;
}

// ── Block parser ─────────────────────────────────────────────────────────────

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "hr" }
  | { type: "code"; lang: string; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string };

function parseBlocks(markdown: string): Block[] {
  const rawLines = markdown.split("\n");
  const blocks: Block[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];

    // Code fence
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < rawLines.length && !rawLines[i].startsWith("```")) {
        codeLines.push(rawLines[i]);
        i++;
      }
      i++; // consume closing ```
      blocks.push({ type: "code", lang, lines: codeLines });
      continue;
    }

    // Headings
    if (/^### /.test(line)) { blocks.push({ type: "h3", text: line.slice(4) }); i++; continue; }
    if (/^## /.test(line))  { blocks.push({ type: "h2", text: line.slice(3) }); i++; continue; }
    if (/^# /.test(line))   { blocks.push({ type: "h1", text: line.slice(2) }); i++; continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { blocks.push({ type: "hr" }); i++; continue; }

    // Unordered list (-, *, •)
    if (/^[-*•] /.test(line)) {
      const items: string[] = [];
      while (i < rawLines.length && /^[-*•] /.test(rawLines[i])) {
        items.push(rawLines[i].replace(/^[-*•] /, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\d+\. /.test(rawLines[i])) {
        items.push(rawLines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Blank line — skip
    if (line.trim() === "") { i++; continue; }

    // Paragraph — accumulate until blank line or block element
    const paragraphLines: string[] = [];
    while (
      i < rawLines.length &&
      rawLines[i].trim() !== "" &&
      !/^(#{1,3} |```|---+$|[-*•] |\d+\. )/.test(rawLines[i])
    ) {
      paragraphLines.push(rawLines[i]);
      i++;
    }
    if (paragraphLines.length) {
      blocks.push({ type: "p", text: paragraphLines.join(" ") });
    }
  }

  return blocks;
}

// ── Renderer ─────────────────────────────────────────────────────────────────

function renderBlock(block: Block, idx: number): React.ReactNode {
  switch (block.type) {
    case "h1":
      return <h1 key={idx} style={{ fontSize: 16, fontWeight: 700, margin: "14px 0 6px", lineHeight: 1.3 }}>{renderInline(block.text)}</h1>;
    case "h2":
      return <h2 key={idx} style={{ fontSize: 14, fontWeight: 700, margin: "12px 0 5px", lineHeight: 1.3 }}>{renderInline(block.text)}</h2>;
    case "h3":
      return <h3 key={idx} style={{ fontSize: 13, fontWeight: 600, margin: "10px 0 4px", lineHeight: 1.3, color: "inherit" }}>{renderInline(block.text)}</h3>;
    case "hr":
      return <hr key={idx} style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.12)", margin: "10px 0" }} />;
    case "code":
      return (
        <pre key={idx} style={{
          background: "rgba(0,0,0,0.06)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 6,
          padding: "10px 14px",
          overflowX: "auto",
          margin: "8px 0",
          fontSize: 12,
          lineHeight: 1.6,
          fontFamily: "var(--font-jetbrains-mono, monospace)",
        }}>
          <code>{block.lines.join("\n")}</code>
        </pre>
      );
    case "ul":
      return (
        <ul key={idx} style={{ margin: "6px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 3 }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ fontSize: "inherit", lineHeight: 1.55 }}>
              {renderInline(item, j)}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={idx} style={{ margin: "6px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 3 }}>
          {block.items.map((item, j) => (
            <li key={j} style={{ fontSize: "inherit", lineHeight: 1.55 }}>
              {renderInline(item, j)}
            </li>
          ))}
        </ol>
      );
    case "p":
      return (
        <p key={idx} style={{ margin: "4px 0", lineHeight: 1.6 }}>
          {renderInline(block.text)}
        </p>
      );
  }
}

// ── Public component ─────────────────────────────────────────────────────────

interface MarkdownMessageProps {
  content: string;
  /** Extra inline styles on the container */
  style?: React.CSSProperties;
}

export default function MarkdownMessage({ content, style }: MarkdownMessageProps) {
  const blocks = parseBlocks(content);
  return (
    <div style={{ ...style }}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  );
}
