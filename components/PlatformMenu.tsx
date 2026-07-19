// Shared platform nav — synced across all repos via pre-commit hook.
// Keep ProfileMenu.tsx and BottomNav.tsx in sync as well.

import QuickAddReminder from "./QuickAddReminder";
import ProfileMenu from "./ProfileMenu";
import BottomNav from "./BottomNav";
import ModeSwitcher from "./ModeSwitcher";

const NAV = [
  { key: "today",  label: "Today",       href: "/home",               accessKeys: [] as string[] },
  { key: "news",   label: "News",        href: "/news",               accessKeys: [] as string[] },
  { key: "family", label: "Family",      href: "/home/family",        accessKeys: [] as string[] },
  { key: "children", label: "Children",  href: "/children",           accessKeys: ["children"] },
  { key: "me",     label: "Me",          href: "/home/me",            accessKeys: ["health"] },
  { key: "health", label: "Health",      href: "/health",             accessKeys: ["health"] },
  { key: "money",  label: "Money",       href: "/finance/dashboard",  accessKeys: ["finance", "investments"] },
  { key: "career", label: "Career",      href: "/career",             accessKeys: ["career"] },
  { key: "travel", label: "Travel",      href: "/travel",             accessKeys: ["travel"] },
  { key: "bible",  label: "Bible",       href: "/bible/dashboard",    accessKeys: ["bible"] },
  { key: "ask",    label: "Ask Morris",  href: "/home/ask",           accessKeys: [] as string[] },
];

export interface MenuUser {
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  appAccess?: string[] | null;
}

function activeKeyFromApp(currentApp: string): string {
  if (currentApp === "hub") return "today";
  if (currentApp === "news") return "news";
  if (currentApp === "family") return "family";
  if (currentApp === "ask") return "ask";
  if (currentApp === "health") return "health";
  if (currentApp === "finance" || currentApp === "investments") return "money";
  if (currentApp === "children") return "children";
  if (currentApp === "career") return "career";
  if (currentApp === "travel") return "travel";
  if (currentApp === "bible") return "bible";
  return "";
}

export default function PlatformMenu({
  currentApp,
  user,
}: {
  currentApp: "hub" | "family" | "ask" | "health" | "finance" | "investments" | "student-success" | "bible" | "career" | "travel" | "children" | "news";
  user?: MenuUser | null;
}) {
  const activeKey = activeKeyFromApp(currentApp);

  const visibleNav = user?.appAccess?.length
    ? NAV.filter(
        (n) => n.accessKeys.length === 0 || n.accessKeys.some((k) => user.appAccess!.includes(k))
      )
    : NAV;

  return (
    <>
      <header
        role="banner"
        style={{
          background: "rgba(255,253,248,0.92)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "0 20px",
            height: 52,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* Logo */}
          <a
            href="/home"
            aria-label="morrisai.family — go to Today"
            style={{
              fontFamily: "var(--font-instrument-serif, 'Instrument Serif'), serif",
              fontSize: 16,
              color: "var(--color-ink)",
              textDecoration: "none",
              letterSpacing: "-0.01em",
              flexShrink: 0,
              marginRight: 8,
            }}
          >
            morrisai
            <span style={{ fontStyle: "italic", color: "var(--color-ink-3)" }}>.family</span>
          </a>

          {/* Family/Personal mode switcher — always visible, both mobile and desktop */}
          {user && <ModeSwitcher />}

          {/* Desktop nav — visible on md+, hidden on mobile via globals.css */}
          <div className="nav-desktop-items" style={{ alignItems: "center", gap: 2, flex: 1 }}>
            <nav role="navigation" aria-label="Main navigation" style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {visibleNav.map((item) => {
                const active = item.key === activeKey;
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: "var(--font-geist, system-ui), sans-serif",
                      fontWeight: active ? 600 : 500,
                      color: active ? "var(--color-ink)" : "var(--color-ink-2)",
                      textDecoration: "none",
                      background: active ? "rgba(0,0,0,0.06)" : "transparent",
                      transition: "background 100ms, color 100ms",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Flex spacer on mobile — pushes profile to the right */}
          <div className="nav-mobile-spacer" />

          {/* Right side */}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {/* QuickAdd reminder — desktop only */}
              <div className="nav-desktop-items">
                <QuickAddReminder sourceApp={currentApp} />
              </div>
              {/* Profile dropdown */}
              <ProfileMenu user={user} />
            </div>
          )}
        </div>
      </header>

      {/* Mobile bottom nav — BibleNav is a horizontal tab bar, not a substitute
          for the platform-level bottom nav (Family/Kids/Me/Money/etc access) */}
      {user && (
        <BottomNav
          currentApp={currentApp}
          appAccess={user.appAccess}
          isAdmin={user.isAdmin}
        />
      )}
    </>
  );
}
