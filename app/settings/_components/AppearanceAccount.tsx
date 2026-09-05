"use client";

// Appearance (theme + color scheme) + account actions for the Settings hub.
//
// Both are stamped on <html> and persisted to localStorage, which is where
// app/ios.css reads them from. They used to be written onto every
// `[data-ui="ios"]` scope; that could not hold, because scopes nest and any one
// of them that missed the stamp repainted its subtree with the light default.
// "automatic" clears the theme override, which is light — the app is
// deliberately light-first. "classic" clears the tint back to the brand blue.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Group, Cell, IconBadge, Segmented, Icons } from "@/components/ios";

type Theme = "automatic" | "light" | "dark";
type Scheme = "classic" | "famu" | "braves";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "automatic") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function applyScheme(scheme: Scheme) {
  const root = document.documentElement;
  if (scheme === "classic") root.removeAttribute("data-scheme");
  else root.setAttribute("data-scheme", scheme);
}

/** localStorage read that survives private mode and server rendering. */
function readStored(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

const SCHEME_SWATCH: Record<Scheme, string> = {
  classic: "#356FB0",
  famu: "#F58025",
  braves: "#CE1141",
};

export default function AppearanceAccount() {
  const router = useRouter();
  // Read straight into state rather than through an effect, so the controls
  // show the saved choice on the first frame instead of flicking off "Automatic".
  const [theme, setTheme] = useState<Theme>(() => readStored("ios-theme", "automatic") as Theme);
  const [scheme, setScheme] = useState<Scheme>(() => readStored("ios-scheme", "classic") as Scheme);
  const [signingOut, setSigningOut] = useState(false);

  // The boot script in app/layout.tsx has already stamped <html>; re-applying
  // here only matters if it was blocked.
  useEffect(() => {
    applyTheme(theme);
    applyScheme(scheme);
    // Once, on mount: afterwards the setters below own both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem("ios-theme", t);
    applyTheme(t);
  };

  const onScheme = (s: Scheme) => {
    setScheme(s);
    localStorage.setItem("ios-scheme", s);
    applyScheme(s);
  };

  const signOut = async () => {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push("/login");
  };

  return (
    <>
      <Group header="Appearance" footer="Automatic follows your device's light or dark setting.">
        <Cell lead={<IconBadge color="#5E5CE6"><Icons.MoonIcon /></IconBadge>} title="Theme" chevron={false} />
        <div style={{ padding: "0 16px 12px" }}>
          <Segmented
            ariaLabel="Theme"
            value={theme}
            onChange={onTheme}
            options={[
              { value: "automatic", label: "Automatic" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>
      </Group>

      <Group header="Color scheme" footer="Pick a brand accent. It applies across the whole app in light and dark.">
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "12px 16px", scrollbarWidth: "none" }}>
          {(["classic", "famu", "braves"] as Scheme[]).map((s) => {
            const active = scheme === s;
            const label = s === "classic" ? "Classic" : s === "famu" ? "FAMU" : "Braves";
            return (
              <button
                key={s}
                type="button"
                onClick={() => onScheme(s)}
                aria-pressed={active}
                style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 72 }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 52, height: 52, borderRadius: "50%", background: SCHEME_SWATCH[s],
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: active ? `0 0 0 3px var(--ios-bg-elevated), 0 0 0 5px ${SCHEME_SWATCH[s]}` : "none",
                  }}
                >
                  {active && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>
                  )}
                </span>
                <span className="ios-caption" style={{ color: active ? "var(--ios-label)" : "var(--ios-label-2)", fontWeight: active ? 600 : 400 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group header="Account">
        <Cell
          lead={<IconBadge color="var(--ios-tint)"><Icons.PersonIcon /></IconBadge>}
          title="Profile & health details"
          href="/health/profile"
        />
        <Cell
          title={<span style={{ color: "var(--ios-red)" }}>{signingOut ? "Signing out…" : "Sign out"}</span>}
          chevron={false}
          onClick={signOut}
        />
      </Group>
    </>
  );
}
