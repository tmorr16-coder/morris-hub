"use client";

// TEMPORARY. Diagnosing a 10-15s white-then-black open on iPhone and iPad
// that a Mac does not show. Sends the browser's own navigation timings once
// per page load: how long until the first byte, until the HTML was parsed,
// until load, and until React had hydrated this component. Durations only —
// no identity, no URL beyond the path. Remove with app/api/perf.

import { useEffect } from "react";

export default function PerfBeacon() {
  useEffect(() => {
    const hydrated = Math.round(performance.now());
    const send = () => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;
      const r = (n: number) => Math.round(n);
      const body = JSON.stringify({
        path: location.pathname,
        standalone: matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
        type: nav.type,
        redirects: nav.redirectCount,
        dns: r(nav.domainLookupEnd - nav.domainLookupStart),
        connect: r(nav.connectEnd - nav.connectStart),
        ttfb: r(nav.responseStart),
        htmlDone: r(nav.responseEnd),
        domInteractive: r(nav.domInteractive),
        domContentLoaded: r(nav.domContentLoadedEventEnd),
        load: r(nav.loadEventEnd),
        hydrated,
        transferKB: r((nav.transferSize ?? 0) / 1024),
      });
      navigator.sendBeacon?.("/api/perf", new Blob([body], { type: "application/json" }));
    };
    if (document.readyState === "complete") setTimeout(send, 0);
    else addEventListener("load", () => setTimeout(send, 0), { once: true });
  }, []);
  return null;
}
