"use client";

import { useEffect, useRef, useState } from "react";

// A scanned document, one page at a time.
//
// The first version stacked every page into one tall column, which on a phone
// meant the second page was a long scroll away and the third was easy to miss
// altogether. This shows one page, says which one it is, and moves with a
// swipe, the arrows, or the keyboard — the way a document reads.

export default function DocumentViewer({ title, urls, onClose, initialPage = 0 }: { title: string; urls: string[]; onClose: () => void; initialPage?: number }) {
  const [page, setPage] = useState(Math.min(Math.max(0, initialPage), Math.max(0, urls.length - 1)));
  const touchX = useRef<number | null>(null);
  const n = urls.length;
  const prev = () => setPage((p) => Math.max(0, p - 1));
  const next = () => setPage((p) => Math.min(n - 1, p + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, onClose]);

  const btn: React.CSSProperties = { background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 999, padding: "8px 14px", fontWeight: 700, fontSize: 15, cursor: "pointer" };

  return (
    <div role="dialog" aria-label={title} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.94)", display: "flex", flexDirection: "column" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "max(12px, env(safe-area-inset-top)) 16px 10px", color: "#fff" }}>
        <span style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{title}</span>
        <button type="button" onClick={onClose} style={btn}>Close</button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const x0 = touchX.current; touchX.current = null;
          const x1 = e.changedTouches[0]?.clientX;
          if (x0 == null || x1 == null) return;
          if (x1 - x0 > 50) prev(); else if (x0 - x1 > 50) next();
        }}
        style={{ flex: 1, minHeight: 0, overflow: "auto", WebkitOverflowScrolling: "touch", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "0 8px", touchAction: "pan-y pinch-zoom" }}
      >
        {n === 0 ? (
          <p style={{ color: "#fff", opacity: 0.8, padding: 24, textAlign: "center" }}>No pages were stored for this document. Add it again from the camera and the pages will be kept.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URLs; next/image cannot proxy them
          <img key={urls[page]} src={urls[page]} alt={`${title}, page ${page + 1} of ${n}`} style={{ maxWidth: "100%", height: "auto", borderRadius: 8, background: "#fff" }} />
        )}
      </div>

      {n > 1 && (
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "10px 16px max(14px, env(safe-area-inset-bottom))", color: "#fff" }}>
          <button type="button" onClick={prev} disabled={page === 0} style={{ ...btn, opacity: page === 0 ? 0.35 : 1 }}>‹ Previous</button>
          <span className="ios-num" style={{ fontWeight: 700, minWidth: 90, textAlign: "center" }}>Page {page + 1} of {n}</span>
          <button type="button" onClick={next} disabled={page === n - 1} style={{ ...btn, opacity: page === n - 1 ? 0.35 : 1 }}>Next ›</button>
        </div>
      )}
      {n === 1 && (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13, padding: "8px 16px max(14px, env(safe-area-inset-bottom))" }}>1 page stored</div>
      )}
    </div>
  );
}
