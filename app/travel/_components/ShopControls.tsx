"use client";

// The controls that turn a list of offers into something you can shop: sort,
// narrow, and see at a glance how much of the result set you're looking at.

import {
  EMPTY_HOTEL_FILTERS, TIME_WINDOWS, airlinesIn, priceRange,
  type FlightFilters, type FlightSort, type HotelFilters, type HotelSort, type TimeWindow,
} from "@/lib/offer-filters";
import type { FlightOffer, HotelOffer } from "@/lib/travel-search";

const chip = (on: boolean): React.CSSProperties => ({
  padding: "6px 11px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
  border: `1px solid ${on ? "transparent" : "var(--ios-separator)"}`,
  background: on ? "var(--ios-tint)" : "transparent",
  color: on ? "var(--ios-on-tint)" : "var(--ios-label)",
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>
    </div>
  );
}

export function FlightShopControls({
  offers, shown, sort, setSort, filters, setFilters,
}: {
  offers: FlightOffer[]; shown: number;
  sort: FlightSort; setSort: (s: FlightSort) => void;
  filters: FlightFilters; setFilters: (f: FlightFilters) => void;
}) {
  const airlines = airlinesIn(offers);
  const range = priceRange(offers);
  const active = filters.maxStops != null || filters.airlines.length > 0 || filters.maxPrice != null || filters.departWindows.length > 0;

  const toggleAirline = (code: string) =>
    setFilters({ ...filters, airlines: filters.airlines.includes(code) ? filters.airlines.filter((c) => c !== code) : [...filters.airlines, code] });
  const toggleWindow = (w: TimeWindow) =>
    setFilters({ ...filters, departWindows: filters.departWindows.includes(w) ? filters.departWindows.filter((x) => x !== w) : [...filters.departWindows, w] });

  return (
    <div className="ios-list" style={{ margin: "0 0 10px", padding: 14 }}>
      <Row label="SORT BY">
        {([["price", "Cheapest"], ["duration", "Fastest"], ["departure", "Earliest"], ["stops", "Fewest stops"]] as [FlightSort, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setSort(key)} style={chip(sort === key)}>{label}</button>
        ))}
      </Row>

      <Row label="STOPS">
        {([[0, "Non-stop"], [1, "1 stop or fewer"], [null, "Any"]] as [number | null, string][]).map(([value, label]) => (
          <button key={label} onClick={() => setFilters({ ...filters, maxStops: value })} style={chip(filters.maxStops === value)}>{label}</button>
        ))}
      </Row>

      <Row label="DEPARTS">
        {TIME_WINDOWS.map((w) => (
          <button key={w.key} onClick={() => toggleWindow(w.key)} style={chip(filters.departWindows.includes(w.key))}>{w.label}</button>
        ))}
      </Row>

      {airlines.length > 1 && (
        <Row label="AIRLINES">
          {airlines.map((code) => (
            <button key={code} onClick={() => toggleAirline(code)} style={chip(filters.airlines.includes(code))}>{code}</button>
          ))}
        </Row>
      )}

      {range && range.max > range.min && (
        <div style={{ marginBottom: 6 }}>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 700, marginBottom: 4 }}>
            MAX PRICE · ${filters.maxPrice ?? range.max}
          </div>
          <input
            type="range" min={range.min} max={range.max} step={Math.max(1, Math.round((range.max - range.min) / 40))}
            value={filters.maxPrice ?? range.max}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFilters({ ...filters, maxPrice: v >= range.max ? null : v });
            }}
            style={{ width: "100%", accentColor: "var(--ios-tint)" }}
            aria-label="Maximum price"
          />
        </div>
      )}

      <Summary shown={shown} total={offers.length} active={active} onReset={() => setFilters({ maxStops: null, airlines: [], maxPrice: null, departWindows: [] })} />
    </div>
  );
}

export function HotelShopControls({
  offers, shown, sort, setSort, filters, setFilters,
}: {
  offers: HotelOffer[]; shown: number;
  sort: HotelSort; setSort: (s: HotelSort) => void;
  filters: HotelFilters; setFilters: (f: HotelFilters) => void;
}) {
  const range = priceRange(offers);
  const active = filters.minRating != null || filters.minGuestScore != null || filters.maxPrice != null || filters.pricedOnly || filters.preferredOnly;

  return (
    <div className="ios-list" style={{ margin: "0 0 10px", padding: 14 }}>
      <Row label="SORT BY">
        {([["recommended", "Recommended"], ["price", "Cheapest"], ["guests", "Guest score"], ["rating", "Stars"], ["name", "Name"]] as [HotelSort, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setSort(key)} style={chip(sort === key)}>{label}</button>
        ))}
      </Row>

      <Row label="STARS">
        {[3, 4, 5].map((r) => (
          <button key={r} onClick={() => setFilters({ ...filters, minRating: filters.minRating === r ? null : r })} style={chip(filters.minRating === r)}>
            {r}★ and up
          </button>
        ))}
      </Row>

      <Row label="GUEST SCORE">
        {[4, 4.5].map((g) => (
          <button key={g} onClick={() => setFilters({ ...filters, minGuestScore: filters.minGuestScore === g ? null : g })} style={chip(filters.minGuestScore === g)}>
            {g.toFixed(1)}+ from guests
          </button>
        ))}
        <button onClick={() => setFilters({ ...filters, pricedOnly: !filters.pricedOnly })} style={chip(filters.pricedOnly)}>
          Priced only
        </button>
        <button onClick={() => setFilters({ ...filters, preferredOnly: !filters.preferredOnly })} style={chip(filters.preferredOnly)}>
          My brands
        </button>
      </Row>

      {range && range.max > range.min && (
        <div style={{ marginBottom: 6 }}>
          <div className="ios-caption" style={{ color: "var(--ios-label-3)", fontWeight: 700, marginBottom: 4 }}>
            MAX NIGHTLY · ${filters.maxPrice ?? range.max}
          </div>
          <input
            type="range" min={range.min} max={range.max} step={Math.max(1, Math.round((range.max - range.min) / 40))}
            value={filters.maxPrice ?? range.max}
            onChange={(e) => {
              const v = Number(e.target.value);
              setFilters({ ...filters, maxPrice: v >= range.max ? null : v });
            }}
            style={{ width: "100%", accentColor: "var(--ios-tint)" }}
            aria-label="Maximum nightly price"
          />
        </div>
      )}

      <Summary shown={shown} total={offers.length} active={active} onReset={() => setFilters(EMPTY_HOTEL_FILTERS)} />
    </div>
  );
}

function Summary({ shown, total, active, onReset }: { shown: number; total: number; active: boolean; onReset: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 4 }}>
      <span className="ios-caption" style={{ color: shown === 0 ? "var(--ios-orange, #D9772B)" : "var(--ios-label-3)" }}>
        {shown === total ? `All ${total} results` : `${shown} of ${total} results`}
        {shown === 0 && total > 0 ? " — nothing matches these filters" : ""}
      </span>
      {active && (
        <button onClick={onReset} className="ios-caption" style={{ background: "none", border: "none", color: "var(--ios-tint)", fontWeight: 700, cursor: "pointer" }}>
          Clear filters
        </button>
      )}
    </div>
  );
}
