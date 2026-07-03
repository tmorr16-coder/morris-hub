"use client";

// Applies the user's saved appearance preference (set in /settings) to every
// iOS-scoped container on each navigation. "automatic" removes the override so
// ios.css falls back to the OS prefers-color-scheme. Mounted once in the root
// layout so the choice is global, not per-page.

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ThemeApplier() {
  const pathname = usePathname();
  useEffect(() => {
    const theme = localStorage.getItem("ios-theme");
    const scheme = localStorage.getItem("ios-scheme");
    const scopes = document.querySelectorAll<HTMLElement>('[data-ui="ios"]');
    scopes.forEach((el) => {
      if (theme === "light" || theme === "dark") el.setAttribute("data-theme", theme);
      else el.removeAttribute("data-theme");
      if (scheme === "famu" || scheme === "braves") el.setAttribute("data-scheme", scheme);
      else el.removeAttribute("data-scheme");
    });
  }, [pathname]);
  return null;
}
