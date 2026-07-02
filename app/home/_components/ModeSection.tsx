"use client";

import type { ReactNode } from "react";
import { useMode } from "@/components/ModeSwitcher";

/**
 * Renders both variants server-side (so there's no hydration mismatch) and
 * toggles visibility client-side once the real mode is read from
 * localStorage. Pass `null` for a variant that should render nothing in
 * that mode.
 */
export default function ModeSection({ family, personal }: { family: ReactNode; personal: ReactNode }) {
  const [mode] = useMode();
  return (
    <>
      <div style={{ display: mode === "family" ? "block" : "none" }}>{family}</div>
      <div style={{ display: mode === "personal" ? "block" : "none" }}>{personal}</div>
    </>
  );
}
