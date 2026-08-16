"use client";

// One field for wherever a hotel search points: a city, a whole state, an area,
// or a property by name. The suggestions cover the first three; anything typed
// goes to the provider as-is, so a hotel name works without a matching entry.

import { useEffect, useRef, useState } from "react";
import { classifyDestination, searchDestinations, type PlaceSuggestion } from "@/lib/places";

const KIND_HINT: Record<string, string> = {
  city: "Searching that city",
  state: "Searching the whole state — expect a broad list",
  airport: "Searching near that airport",
  name: "Looking for that property by name",
};

export default function DestinationField({
  value, onChange, label = "Where",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? value;
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<PlaceSuggestion[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocPointer(e: PointerEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, []);

  function type(next: string) {
    setTyped(next);
    onChange(next);
    setHits(searchDestinations(next));
    setOpen(next.trim().length >= 2);
  }

  function pick(s: PlaceSuggestion) {
    onChange(s.value);
    setTyped(null);
    setOpen(false);
  }

  const kind = classifyDestination(text);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
        <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>{label}</span>
        <input
          value={text}
          onChange={(e) => type(e.target.value)}
          onFocus={() => { if (text.trim().length >= 2) { setHits(searchDestinations(text)); setOpen(true); } }}
          placeholder="City, state, or hotel name"
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          style={{ flex: 1, maxWidth: 210, textAlign: "right", background: "transparent", border: "none", color: "var(--ios-label)", fontSize: 16, outline: "none" }}
        />
      </div>

      {/* Show the hint whenever no list is actually on screen — a property name
          matches no suggestion, which is exactly when the hint matters most. */}
      {(!open || hits.length === 0) && text.trim().length >= 2 && (
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", textAlign: "right", marginTop: -4, paddingBottom: 4 }}>
          {KIND_HINT[kind]}
        </div>
      )}

      {open && hits.length > 0 && (
        <div className="ios-list" style={{ position: "absolute", right: 0, left: 0, top: "100%", zIndex: 40, margin: 0, maxHeight: 250, overflowY: "auto", boxShadow: "0 8px 24px rgba(16,24,40,0.16)" }}>
          {hits.map((s, i) => (
            <button key={`${s.kind}-${s.value}`} onClick={() => pick(s)}
              style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", background: "none", cursor: "pointer",
                border: "none", borderBottom: i < hits.length - 1 ? "1px solid var(--ios-separator)" : "none", textAlign: "left" }}>
              <span style={{ color: "var(--ios-label)", fontSize: 15 }}>{s.label}</span>
              <span className="ios-caption" style={{ color: "var(--ios-label-3)", flexShrink: 0 }}>{s.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
