"use client";

// Small presentational helpers shared across the /ios-demo screens.

export function Circle({ checked }: { checked?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 22, height: 22, borderRadius: "50%",
        border: `1.7px solid ${checked ? "var(--ios-green)" : "var(--ios-label-3)"}`,
        background: checked ? "var(--ios-green)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      {checked && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>
      )}
    </span>
  );
}

export function Avatar({ color, initial, size = 30 }: { color: string; initial: string; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.46, fontWeight: 600, flexShrink: 0 }}>
      {initial}
    </span>
  );
}

/** Concentric Apple-style activity rings (move / exercise / stand). Values 0–1. */
export function Rings({ move = 0.72, exercise = 0.55, stand = 0.9, size = 96 }: { move?: number; exercise?: number; stand?: number; size?: number }) {
  const stroke = size * 0.11;
  const rings = [
    { v: move, c: "#FA114F", r: size / 2 - stroke / 2 },
    { v: exercise, c: "#92E82A", r: size / 2 - stroke * 1.7 },
    { v: stand, c: "#1AD5DE", r: size / 2 - stroke * 2.9 },
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ transform: "rotate(-90deg)" }}>
      {rings.map((ring, i) => {
        const circ = 2 * Math.PI * ring.r;
        return (
          <g key={i}>
            <circle cx={size / 2} cy={size / 2} r={ring.r} fill="none" stroke={ring.c} strokeOpacity={0.22} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={ring.r} fill="none" stroke={ring.c} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(ring.v, 1))} />
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal week strip with a selected day and per-day event dots. */
export function WeekStrip({ days }: { days: { label: string; date: number; selected?: boolean; dots?: string[] }[] }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "12px 16px 0", overflowX: "auto", scrollbarWidth: "none" }}>
      {days.map((d, i) => (
        <div key={i} style={{ flex: "1 0 44px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <span className="ios-caption" style={{ color: "var(--ios-label-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{d.label}</span>
          <span
            className="ios-num"
            style={{
              width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 600,
              background: d.selected ? "var(--ios-tint)" : "transparent",
              color: d.selected ? "#fff" : "var(--ios-label)",
            }}
          >
            {d.date}
          </span>
          <span style={{ display: "flex", gap: 2, height: 5 }}>
            {(d.dots ?? []).slice(0, 3).map((c, j) => (
              <span key={j} style={{ width: 5, height: 5, borderRadius: "50%", background: c }} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
