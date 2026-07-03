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
  career: "Career", health: "Health", mind: "Mind", spirit: "Spirit", courses: "Courses",
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
    <div style={{ paddingBottom: 20 }}>
      <div className="ios-footnote" style={{
        display: "flex", alignItems: "center", gap: 8,
        color: "var(--ios-label-2)", marginBottom: 20, padding: "12px 14px",
        background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", lineHeight: 1.5,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>Your Mind and Spirit reflections stay private — never shown in Family views.</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {visibleDomains.map((d) => (
          <DomainCard key={d.key} domain={d} />
        ))}
        {visibleDomains.length === 0 && (
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "20px 0" }}>
            All domains are hidden. Use Customize below to bring one back.
          </div>
        )}
      </div>

      <button
        onClick={() => setCustomizeOpen((o) => !o)}
        className="ios-subhead"
        style={{ fontWeight: 500, color: "var(--ios-tint)" }}
      >
        {customizeOpen ? "Hide customize" : "Customize"}
      </button>

      {customizeOpen && (
        <div style={{
          marginTop: 12, background: "var(--ios-cell)",
          borderRadius: "var(--ios-radius-card)", padding: "16px 18px",
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
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M6 11l6-6 6 6" /></svg>
                    </button>
                    <button
                      onClick={() => moveDomain(key, 1)}
                      disabled={i === order.length - 1}
                      style={{ ...reorderBtn, opacity: i === order.length - 1 ? 0.3 : 1 }}
                      aria-label="Move down"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M6 13l6 6 6-6" /></svg>
                    </button>
                  </div>
                  <span className="ios-subhead" style={{
                    flex: 1, fontWeight: 500,
                    color: isDisabled ? "var(--ios-label-3)" : "var(--ios-label)",
                  }}>
                    {DOMAIN_LABELS[key]}
                  </span>
                  <label className="ios-footnote" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ios-label-2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={!isDisabled} onChange={() => toggleDomain(key)} style={{ accentColor: "var(--ios-tint)" }} />
                    Enabled
                  </label>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={handleSave}
              disabled={pending}
              className="ios-btn ios-btn--primary"
              style={{ width: "auto", minHeight: 0, padding: "10px 20px", fontSize: 15, cursor: pending ? "wait" : "pointer" }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
            {saveMsg && <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{saveMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const reorderBtn: React.CSSProperties = {
  background: "var(--ios-fill)",
  borderRadius: 7,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ios-tint)",
};
