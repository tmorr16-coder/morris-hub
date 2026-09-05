"use client";

// Pull-to-refresh — drag down from the top of any screen to reload what's on it,
// the way a native iOS app does. Installed to the Home Screen there's no browser
// reload button, so this is the only way to pull fresh data without navigating
// away.
//
// A refresh re-runs the current route's server components (router.refresh(), so
// client state and scroll position survive) and fires an "app:refresh" event
// that client components fetching their own data can listen for:
//
//   useEffect(() => {
//     const onRefresh = () => load();
//     window.addEventListener("app:refresh", onRefresh);
//     return () => window.removeEventListener("app:refresh", onRefresh);
//   }, []);

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const TRIGGER = 72;   // pull distance (px, after resistance) that arms a refresh
const MAX = 112;      // furthest the dial travels
const RESIST = 0.55;  // rubber-band factor — the pull outruns the finger 45%
const MIN_SPIN = 500; // ms the spinner stays up, so an instant refresh still reads

/** True if the touch began inside something that scrolls vertically on its own. */
function inNestedScroller(target: EventTarget | null): boolean {
  let el = target as HTMLElement | null;
  while (el && el !== document.body) {
    if (el.scrollTop > 0) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return true;
    }
    el = el.parentElement;
  }
  return false;
}

export default function PullToRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dist, setDist] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [snap, setSnap] = useState(false);   // animate back, vs. track the finger

  const rootRef = useRef<HTMLDivElement | null>(null);
  const spinningRef = useRef(false);
  const pendingRef = useRef(false);
  const startedAt = useRef(0);
  const g = useRef({ y0: 0, x0: 0, tracking: false, armed: false, dist: 0 });

  useEffect(() => { pendingRef.current = pending; }, [pending]);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      const s = g.current;
      s.tracking = false; s.armed = false;
      if (spinningRef.current || e.touches.length !== 1) return;
      if (window.scrollY > 0 || document.documentElement.scrollTop > 0) return;
      if (inNestedScroller(e.target)) return;
      s.y0 = e.touches[0].clientY;
      s.x0 = e.touches[0].clientX;
      s.tracking = true;
    }

    function onMove(e: TouchEvent) {
      const s = g.current;
      if (!s.tracking) return;
      const dy = e.touches[0].clientY - s.y0;
      const dx = Math.abs(e.touches[0].clientX - s.x0);
      if (!s.armed) {
        // Only claim the gesture once it's clearly a downward pull — sideways
        // swipes (the answer carousel) and upward scrolls stay untouched.
        if (dy > 8 && dy > dx * 1.5) { s.armed = true; setSnap(false); }
        else if (dy < -4 || dx > 12) { s.tracking = false; }
        return;
      }
      if (dy <= 0) { s.dist = 0; setDist(0); return; }
      e.preventDefault(); // suppress the browser's own rubber-band / refresh
      s.dist = Math.min(MAX, dy * RESIST);
      setDist(s.dist);
    }

    function onEnd() {
      const s = g.current;
      if (!s.tracking || !s.armed) { s.tracking = false; s.armed = false; return; }
      const go = s.dist >= TRIGGER;
      s.tracking = false; s.armed = false; s.dist = 0;
      setSnap(true);
      if (go) refresh(); else setDist(0);
    }

    function refresh() {
      spinningRef.current = true;
      startedAt.current = Date.now();
      setSpinning(true);
      setDist(TRIGGER);
      window.dispatchEvent(new Event("app:refresh"));
      startTransition(() => router.refresh());
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  // Hold the spinner until the refresh lands (and for a readable minimum).
  useEffect(() => {
    if (!spinning || pending) return;
    const wait = Math.max(0, MIN_SPIN - (Date.now() - startedAt.current));
    const t = setTimeout(() => {
      if (pendingRef.current) return; // still refreshing — this effect re-runs when it lands
      spinningRef.current = false;
      setSpinning(false);
      setSnap(true);
      setDist(0);
    }, wait);
    return () => clearTimeout(t);
  }, [spinning, pending]);

  const progress = Math.min(1, dist / TRIGGER);
  const armed = progress >= 1;

  return (
    <div
      className="ptr"
      ref={rootRef}
      style={{
        transform: `translate3d(0, ${dist - 46}px, 0)`,
        opacity: spinning ? 1 : Math.min(1, dist / 28),
        transition: snap ? "transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease" : "none",
      }}
    >
      <div className="ptr-dial">
        {spinning ? (
          <svg className="ptr-spin" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" />
            <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24" aria-hidden
            style={{ transform: `rotate(${armed ? 180 : progress * 180}deg)`, transition: "transform 0.18s ease" }}
          >
            <path d="M12 4.5v14M5.5 12.5 12 19l6.5-6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span role="status" aria-live="polite" className="ptr-sr">
        {spinning ? "Refreshing" : armed ? "Release to refresh" : ""}
      </span>
    </div>
  );
}
