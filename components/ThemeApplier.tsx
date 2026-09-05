"use client";

// Keeps the appearance choice on <html> in sync after first paint.
//
// THEME_BOOT in app/layout.tsx does the real work: it stamps data-theme and
// data-scheme on the document element synchronously in the head, so the first
// frame is already correct. This component exists for the cases that happen
// after that — another tab changing the setting, or a browser that blocked the
// inline script — and for nothing else.
//
// It no longer walks the `[data-ui="ios"]` scopes. That was the bug: scopes
// nest, and app/ios.css declares the light palette on the bare scope selector,
// so a scope that missed the stamp repainted its subtree light over a correctly
// themed ancestor. A scope that mounted after the effect — a page replacing its
// own loading skeleton — never got stamped at all. One attribute on one element
// above every screen cannot go out of step with itself.

import { useEffect } from "react";

function applyFromStorage() {
  try {
    const root = document.documentElement;
    const theme = localStorage.getItem("ios-theme");
    const scheme = localStorage.getItem("ios-scheme");
    if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
    if (scheme === "famu" || scheme === "braves") root.setAttribute("data-scheme", scheme);
    else root.removeAttribute("data-scheme");
  } catch {
    /* private mode — leave whatever the boot script managed */
  }
}

export default function ThemeApplier() {
  useEffect(() => {
    applyFromStorage();
    // `storage` fires in the *other* tabs, which is exactly the case the boot
    // script cannot cover: change the theme on one tab, see it on the rest.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ios-theme" || e.key === "ios-scheme" || e.key === null) applyFromStorage();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
