"use client";

import { useState, useRef, useEffect } from "react";

const TABS = [
  { key: "today",  label: "Today",  href: "/home" },
  { key: "family", label: "Family", href: "/home/family" },
  { key: "kids",   label: "Kids",   href: "/student-success" },
  { key: "me",     label: "Me",     href: "/health" },
];

const MORE_ITEMS = [
  { label: "Money",       href: "/finance/dashboard",                      accessKey: "finance" },
  { label: "Ask Morris",  href: "/home/ask",                                accessKey: null },
  { label: "Bible",       href: "/bible/dashboard",                        accessKey: "bible" },
  { label: "Career",      href: "/career",                                 accessKey: "career" },
  { label: "Settings",    href: "/home/settings",                          accessKey: null },
];

function activeKeyFromApp(currentApp: string): string | null {
  if (currentApp === "hub") return "today";
  if (currentApp === "family") return "family";
  if (currentApp === "health") return "me";
  if (currentApp === "student-success") return "kids";
  return null;
}

export default function BottomNav({
  currentApp,
  appAccess,
  isAdmin,
}: {
  currentApp: string;
  appAccess?: string[] | null;
  isAdmin?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const activeKey = activeKeyFromApp(currentApp);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Keyboard handling for More sheet: Escape closes + returns focus; arrow keys navigate
  useEffect(() => {
    if (!moreOpen) return;
    // Focus first link in sheet
    const firstLink = sheetRef.current?.querySelector("a") as HTMLElement | null;
    firstLink?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setMoreOpen(false);
        moreBtnRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const links = Array.from(
          sheetRef.current?.querySelectorAll("a") ?? []
        ) as HTMLElement[];
        if (!links.length) return;
        const current = links.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown"
          ? (current + 1) % links.length
          : (current - 1 + links.length) % links.length;
        links[next]?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  const visibleMore = MORE_ITEMS.filter(
    (item) => !item.accessKey || !appAccess?.length || appAccess.includes(item.accessKey)
  );

  return (
    <div className="nav-mobile-bar">
      {/* Backdrop */}
      {moreOpen && (
        <div
          onClick={() => { setMoreOpen(false); moreBtnRef.current?.focus(); }}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 149,
            background: "rgba(0,0,0,0.25)",
          }}
        />
      )}

      {/* More sheet */}
      {moreOpen && (
        <div
          ref={sheetRef}
          role="dialog"
          aria-label="More navigation options"
          aria-modal="true"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 65,
            zIndex: 150,
            background: "var(--color-bg-card)",
            borderTop: "1px solid var(--color-rule)",
            borderRadius: "16px 16px 0 0",
            paddingTop: 16,
            paddingBottom: 8,
            boxShadow: "0 -4px 24px rgba(0,0,0,0.14)",
          }}
        >
          <div
            style={{
              padding: "0 20px 10px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              fontFamily: "var(--font-geist, system-ui), sans-serif",
            }}
          >
            More
          </div>
          {visibleMore.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              style={{
                display: "block",
                padding: "13px 20px",
                fontSize: 15,
                fontWeight: 500,
                color: "var(--color-ink-2)",
                textDecoration: "none",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              {item.label}
            </a>
          ))}
          {isAdmin && (
            <a
              href="/home/admin"
              onClick={() => setMoreOpen(false)}
              style={{
                display: "block",
                padding: "13px 20px",
                fontSize: 15,
                fontWeight: 500,
                color: "var(--color-ink-2)",
                textDecoration: "none",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              Admin
            </a>
          )}
        </div>
      )}

      {/* Tab bar */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 65,
          background: "rgba(255,253,248,0.94)",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          zIndex: 100,
          display: "flex",
          alignItems: "stretch",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {TABS.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <a
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                textDecoration: "none",
                color: active ? "var(--color-accent)" : "var(--color-ink-2)",
                fontSize: 10,
                fontWeight: active ? 600 : 500,
                fontFamily: "var(--font-geist, system-ui), sans-serif",
                letterSpacing: "0.02em",
              }}
            >
              <TabIcon name={tab.key} active={active} />
              {tab.label}
            </a>
          );
        })}

        {/* More tab */}
        <button
          ref={moreBtnRef}
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          aria-label="More navigation options"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: moreOpen ? "var(--color-accent)" : "var(--color-ink-2)",
            fontSize: 10,
            fontWeight: moreOpen ? 600 : 500,
            fontFamily: "var(--font-geist, system-ui), sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          <TabIcon name="more" active={moreOpen} />
          More
        </button>
      </nav>
    </div>
  );
}

function TabIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? "var(--color-accent)" : "var(--color-ink-3)";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      {name === "today" && (
        <>
          <rect x="3" y="5" width="16" height="14" rx="2" stroke={color} strokeWidth="1.5" />
          <path d="M7 3v4M15 3v4M3 9h16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7 13h4M7 16h2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {name === "family" && (
        <>
          <circle cx="7.5" cy="7" r="2.5" stroke={color} strokeWidth="1.5" />
          <circle cx="14.5" cy="7" r="2.5" stroke={color} strokeWidth="1.5" />
          <path d="M2 19c0-3 2.5-5.5 5.5-5.5h7C17.5 13.5 20 16 20 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {name === "kids" && (
        <>
          <circle cx="11" cy="8" r="3" stroke={color} strokeWidth="1.5" />
          <path d="M5 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M15.5 3.5L17 2M6.5 3.5L5 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {name === "me" && (
        <>
          <circle cx="11" cy="8" r="3" stroke={color} strokeWidth="1.5" />
          <path d="M5 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {name === "more" && (
        <>
          <circle cx="5.5" cy="11" r="1.5" fill={color} />
          <circle cx="11" cy="11" r="1.5" fill={color} />
          <circle cx="16.5" cy="11" r="1.5" fill={color} />
        </>
      )}
    </svg>
  );
}
