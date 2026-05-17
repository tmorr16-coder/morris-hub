// Shared platform-wide menu bar — same component lives in all 3 apps.
// Sits above each app's in-app header. Provides cross-app navigation.

import Image from "next/image";
import QuickAddReminder from "./QuickAddReminder";

const APPS = [
  { key: "hub",     label: "Hub",     href: "https://morrisai.family",                   dot: "#3B5C7F" },
  { key: "health",  label: "Health",  href: "https://health.morrisai.family/dashboard",  dot: "#4D6B3A" },
  { key: "finance", label: "Finance", href: "https://finance.morrisai.family/dashboard", dot: "#8B6A47" },
];

export interface MenuUser {
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  isAdmin?: boolean;
}

export default function PlatformMenu({
  currentApp,
  user,
}: {
  currentApp: "hub" | "health" | "finance";
  user?: MenuUser | null;
}) {
  return (
    <div
      style={{
        background: "rgba(255, 253, 248, 0.85)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
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
          padding: "8px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Logo + app switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <a
            href="https://morrisai.family"
            style={{
              fontFamily: "var(--font-instrument-serif, 'Instrument Serif'), serif",
              fontSize: 16,
              color: "#1a1a1a",
              textDecoration: "none",
              marginRight: 16,
              letterSpacing: "-0.01em",
            }}
          >
            morrisai<span style={{ fontStyle: "italic", color: "#6B6258" }}>.family</span>
          </a>

          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {APPS.map((app) => {
              const active = app.key === currentApp;
              return (
                <a
                  key={app.key}
                  href={app.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 11px",
                    fontSize: 12,
                    fontFamily: "var(--font-geist, system-ui), sans-serif",
                    fontWeight: active ? 600 : 500,
                    color: active ? "#1a1a1a" : "#6B6258",
                    textDecoration: "none",
                    borderRadius: 7,
                    background: active ? "rgba(0,0,0,0.06)" : "transparent",
                    transition: "background 100ms, color 100ms",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: app.dot,
                      display: "inline-block",
                    }}
                  />
                  {app.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* User */}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <QuickAddReminder sourceApp={currentApp} />
            {user.isAdmin && (
              <a
                href="https://morrisai.family/home/admin"
                style={{
                  fontSize: 11,
                  color: "#6B6258",
                  textDecoration: "none",
                  padding: "4px 9px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "rgba(0,0,0,0.03)",
                  fontFamily: "var(--font-geist, system-ui), sans-serif",
                }}
                title="Platform admin"
              >
                ⚙ Admin
              </a>
            )}
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt=""
                width={22}
                height={22}
                style={{ borderRadius: "50%" }}
              />
            ) : (
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#E0D9C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#6B6258",
                }}
              >
                {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <span
              style={{
                fontSize: 11,
                color: "#6B6258",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              {user.name?.split(" ")[0] ?? user.email ?? ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
