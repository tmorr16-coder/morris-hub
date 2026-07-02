"use client";

import { useSyncExternalStore } from "react";

export type Mode = "family" | "personal";

const STORAGE_KEY = "morris-mode";
const CHANGE_EVENT = "morris-mode-change";

function readMode(): Mode {
  return window.localStorage.getItem(STORAGE_KEY) === "family" ? "family" : "personal";
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerSnapshot(): Mode {
  return "personal";
}

/** Shared hook so any component (nav switcher, page sections) can read/set the current mode. */
export function useMode(): [Mode, (m: Mode) => void] {
  const mode = useSyncExternalStore(subscribe, readMode, getServerSnapshot);

  function setMode(m: Mode) {
    window.localStorage.setItem(STORAGE_KEY, m);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return [mode, setMode];
}

export default function ModeSwitcher() {
  const [mode, setMode] = useMode();

  return (
    <div
      role="group"
      aria-label="Family or Personal view"
      style={{
        display: "flex", gap: 2, padding: 2, borderRadius: 9,
        background: "rgba(0,0,0,0.045)", flexShrink: 0,
      }}
    >
      {(["family", "personal"] as const).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={active}
            style={{
              padding: "4px 11px", borderRadius: 7, fontSize: 12,
              fontWeight: active ? 600 : 500, border: "none", cursor: "pointer",
              background: active ? "var(--color-bg-card, #FFFDF8)" : "transparent",
              color: active ? "var(--color-ink, #1A1814)" : "var(--color-ink-3, #8A8278)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
              fontFamily: "var(--font-geist, system-ui), sans-serif",
              transition: "background 100ms, color 100ms, box-shadow 100ms",
            }}
          >
            {m === "family" ? "Family" : "Personal"}
          </button>
        );
      })}
    </div>
  );
}
