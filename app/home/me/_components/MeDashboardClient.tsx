"use client";

import { useState, useTransition } from "react";
import { savePreferences } from "@/app/home/actions";
import type { MeDomainKey } from "@/lib/prefs-shared";
import type { DomainCardData } from "../_lib/domains";
import DomainCard from "./DomainCard";

interface Props {
  domains: DomainCardData[];
  order: MeDomainKey[];
  disabled: string[];
}

const DOMAIN_LABELS: Record<MeDomainKey, string> = {
  career: "Career", health: "Health", mind: "Mind", spirit: "Spirit",
};

export default function MeDashboardClient({ domains, order: initialOrder, disabled: initialDisabled }: Props) {
  const [order, setOrder] = useState<MeDomainKey[]>(initialOrder);
  const [disabledKeys, setDisabledKeys] = useState<string[]>(initialDisabled);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  function moveDomain(key: MeDomainKey, dir: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx === -1) return prev;
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function toggleDomain(key: MeDomainKey) {
    setDisabledKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function handleSave() {
    setSaveMsg(null);
    startTransition(async () => {
      const res = await savePreferences({ me_domain_order: order, me_domains_disabled: disabledKeys });
      setSaveMsg(res.error ?? "Saved");
      setTimeout(() => setSaveMsg(null), 2500);
    });
  }

  const byKey = new Map(domains.map((d) => [d.key, d]));
  const visibleDomains = order.map((k) => byKey.get(k)).filter((d): d is DomainCardData => !!d && !disabledKeys.includes(d.key));

  return (
    <div>
      <div style={{
        fontSize: 12, color: "var(--color-ink-3)", marginBottom: 20, padding: "10px 14px",
        background: "var(--color-bg-deep)", borderRadius: 10, lineHeight: 1.5,
        fontFamily: "var(--font-geist, system-ui), sans-serif",
      }}>
        🔒 Your Mind and Spirit reflections stay private — never shown in Family views.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {visibleDomains.map((d) => (
          <DomainCard key={d.key} domain={d} />
        ))}
        {visibleDomains.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--color-ink-4)", padding: "20px 0" }}>
            All domains are hidden. Use Customize below to bring one back.
          </div>
        )}
      </div>

      <button
        onClick={() => setCustomizeOpen((o) => !o)}
        style={{
          fontSize: 12, fontWeight: 600, color: "var(--color-ink-3)", background: "none",
          border: "1px solid var(--color-rule)", borderRadius: 8, padding: "7px 14px",
          cursor: "pointer", fontFamily: "var(--font-geist, system-ui), sans-serif",
        }}
      >
        {customizeOpen ? "Hide customize" : "Customize"}
      </button>

      {customizeOpen && (
        <div style={{
          marginTop: 12, background: "var(--color-bg-card)", border: "1px solid var(--color-rule)",
          borderRadius: 12, padding: "16px 18px",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {order.map((key, i) => {
              const isDisabled = disabledKeys.includes(key);
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => moveDomain(key, -1)}
                      disabled={i === 0}
                      style={{ ...reorderBtn, opacity: i === 0 ? 0.3 : 1 }}
                      aria-label="Move up"
                    >↑</button>
                    <button
                      onClick={() => moveDomain(key, 1)}
                      disabled={i === order.length - 1}
                      style={{ ...reorderBtn, opacity: i === order.length - 1 ? 0.3 : 1 }}
                      aria-label="Move down"
                    >↓</button>
                  </div>
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: 500,
                    color: isDisabled ? "var(--color-ink-4)" : "var(--color-ink-2)",
                    fontFamily: "var(--font-geist, system-ui), sans-serif",
                  }}>
                    {DOMAIN_LABELS[key]}
                  </span>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-ink-3)", cursor: "pointer" }}>
                    <input type="checkbox" checked={!isDisabled} onChange={() => toggleDomain(key)} />
                    Enabled
                  </label>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={pending}
              style={{
                padding: "8px 18px", borderRadius: 8, border: "none",
                background: "var(--color-accent)", color: "#FFFDF8", fontSize: 13, fontWeight: 600,
                cursor: pending ? "wait" : "pointer", fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            {saveMsg && <span style={{ fontSize: 12, color: "var(--color-ink-3)" }}>{saveMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const reorderBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--color-rule)",
  borderRadius: 6,
  width: 26,
  height: 26,
  cursor: "pointer",
  fontSize: 12,
  color: "var(--color-ink-2)",
};
