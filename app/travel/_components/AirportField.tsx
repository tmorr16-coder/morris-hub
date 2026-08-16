"use client";

// Airport picker that accepts what people actually type. "madrid", "barajas"
// and "MAD" all resolve to MAD; an unlisted three-letter code still goes
// through untouched, so the field is never a dead end.

import { useEffect, useRef, useState } from "react";
import { airportByCode, searchAirports, type Airport } from "@/lib/airports";

export default function AirportField({
  value, onChange, placeholder, label,
}: {
  value: string;                    // the IATA code held by the form
  onChange: (code: string) => void;
  placeholder?: string;
  label: string;
}) {
  // What the user has typed, or null when they haven't touched it — deriving
  // the displayed text this way means a code set from outside (home-airport
  // prefill, a repeated search) shows up without an effect syncing it.
  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? value;
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Airport[]>([]);
  const box = useRef<HTMLDivElement>(null);

  // Close when the tap lands outside.
  useEffect(() => {
    function onDocPointer(e: PointerEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, []);

  function type(next: string) {
    setTyped(next);
    setHits(searchAirports(next));
    setOpen(next.trim().length >= 2);
    // A bare three-letter code is a valid answer on its own.
    if (/^[A-Za-z]{3}$/.test(next.trim())) onChange(next.trim().toUpperCase());
    else if (!next.trim()) onChange("");
  }

  function pick(a: Airport) {
    onChange(a.code);
    setTyped(null);   // fall back to showing the code the form now holds
    setOpen(false);
  }

  const known = airportByCode(value);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40 }}>
        <span className="ios-subhead" style={{ color: "var(--ios-label)" }}>{label}</span>
        <input
          value={text}
          onChange={(e) => type(e.target.value)}
          onFocus={() => { if (text.trim().length >= 2) { setHits(searchAirports(text)); setOpen(true); } }}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label={label}
          style={{ flex: 1, maxWidth: 190, textAlign: "right", background: "transparent", border: "none", color: "var(--ios-label)", fontSize: 16, outline: "none" }}
        />
      </div>

      {/* Confirm what a code means, so ATL vs ATH is obvious before searching. */}
      {!open && known && (
        <div className="ios-caption" style={{ color: "var(--ios-label-3)", textAlign: "right", marginTop: -4, paddingBottom: 4 }}>
          {known.city} · {known.name}
        </div>
      )}

      {open && hits.length > 0 && (
        <div className="ios-list" style={{ position: "absolute", right: 0, left: 0, top: "100%", zIndex: 40, margin: 0, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(16,24,40,0.16)" }}>
          {hits.map((a, i) => (
            <button key={a.code} onClick={() => pick(a)}
              style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", background: "none", cursor: "pointer",
                border: "none", borderBottom: i < hits.length - 1 ? "1px solid var(--ios-separator)" : "none", textAlign: "left" }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", color: "var(--ios-label)", fontSize: 15 }}>{a.city}</span>
                <span className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{a.name} · {a.country}</span>
              </span>
              <span className="ios-num" style={{ color: "var(--ios-label-2)", fontWeight: 700, flexShrink: 0 }}>{a.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
