"use client";

import { useEffect, useState } from "react";
import type { PriceWatch } from "../types";

function money(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function WatchList() {
  const [watches, setWatches] = useState<PriceWatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/travel/watches");
        const data = await res.json();
        if (alive && Array.isArray(data.watches)) setWatches(data.watches);
      } catch { /* ignore */ } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  async function remove(id: string) {
    setWatches((w) => w.filter((x) => x.id !== id));
    await fetch(`/api/travel/watches?id=${id}`, { method: "DELETE" });
  }

  if (loading) return null;
  if (watches.length === 0) return null;

  return (
    <>
      <div className="ios-group-header" style={{ padding: "16px 16px 7px" }}>PRICE ALERTS</div>
      <div className="ios-list" style={{ margin: "0 16px" }}>
        {watches.map((w, i) => {
          const hit = w.last_price != null && w.target_price != null && w.last_price <= w.target_price;
          return (
            <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderBottom: i < watches.length - 1 ? "1px solid var(--ios-separator)" : "none" }}>
              <div style={{ minWidth: 0 }}>
                <div className="ios-headline" style={{ fontSize: 16 }}>
                  {w.origin} → {w.destination}
                  {w.kind === "hotel" && " (hotel)"}
                </div>
                <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 2 }}>
                  {w.depart_date}{w.return_date ? ` · ${w.return_date}` : ""} · target {money(w.target_price)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right" }}>
                  <div className="ios-num" style={{ fontWeight: 700, color: hit ? "var(--ios-green)" : "var(--ios-label)" }}>{money(w.last_price)}</div>
                  <div className="ios-caption" style={{ color: "var(--ios-label-3)" }}>{hit ? "target hit!" : w.last_checked ? "latest" : "not checked"}</div>
                </div>
                <button onClick={() => remove(w.id)} aria-label="Remove alert"
                  style={{ background: "none", border: "none", color: "var(--ios-red, #FF3B30)", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
