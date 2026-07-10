"use client";

// A single, always-present back affordance so every screen you navigate INTO
// has a way back. History-aware (router.back), so it works regardless of where
// you came from. Hidden on the app's true entry points (Today, pre-auth, the
// standalone demo) where a back arrow would have nowhere to go. When shown, it
// flags <body data-back> so the title area reserves room for it (see globals.css).

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Screens reachable as top-level entry points (no back target).
const NO_BACK = new Set<string>([
  "/",
  "/login",
  "/onboarding",
  "/privacy",
  "/home",       // Today — the app home
  "/ios-demo",
]);

export default function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  const show = !!pathname && !NO_BACK.has(pathname) && !pathname.startsWith("/auth");

  useEffect(() => {
    if (show) document.body.setAttribute("data-back", "true");
    else document.body.removeAttribute("data-back");
    return () => document.body.removeAttribute("data-back");
  }, [show]);

  if (!show) return null;

  return (
    <button
      type="button"
      className="global-back-btn"
      aria-label="Back"
      onClick={() => router.back()}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
