"use client";

import { useMode } from "./ModeSwitcher";

/** Persistent "Private to you" badge, shown only in Personal mode. */
export default function PrivateIndicator() {
  const [mode] = useMode();
  if (mode !== "personal") return null;

  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
        padding: "3px 9px", borderRadius: 8,
        background: "rgba(59,92,127,0.1)", color: "var(--color-accent, #3B5C7F)",
        fontFamily: "var(--font-geist, system-ui), sans-serif",
      }}
    >
      🔒 Private to you
    </div>
  );
}
