"use client";

import { createContext, useContext, useState, useEffect } from "react";

export type ViewMode = "family" | "personal";

interface NavMode {
  /** True for solo users (individual/student persona) — always "Me", no toggle. */
  personal: boolean;
  /** Current scope. Drives the Today content and the footer's Family/Me tab. */
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
}

const NavModeContext = createContext<NavMode>({ personal: false, mode: "family", setMode: () => {} });

const STORAGE_KEY = "morris:navMode";

export function NavModeProvider({
  personal,
  children,
}: {
  personal: boolean;
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<ViewMode>(personal ? "personal" : "family");

  // Restore the last-selected scope so a full reload keeps the footer tab in sync.
  useEffect(() => {
    if (personal) return; // solo users are always "personal"
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "family" || saved === "personal") setModeState(saved);
    } catch {
      /* localStorage unavailable */
    }
  }, [personal]);

  const setMode = (m: ViewMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  // Solo users have no family scope — force "personal" regardless of stored mode.
  const effectiveMode: ViewMode = personal ? "personal" : mode;

  return (
    <NavModeContext.Provider value={{ personal, mode: effectiveMode, setMode }}>
      {children}
    </NavModeContext.Provider>
  );
}

export function useNavMode(): NavMode {
  return useContext(NavModeContext);
}
