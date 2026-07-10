"use client";

// Appearance (theme + color scheme) + account actions for the Settings hub.
// Theme (light/dark) and scheme (brand tint) are applied by stamping
// data-theme / data-scheme on every `[data-ui="ios"]` scope and persisted to
// localStorage; ThemeApplier re-applies them on every navigation so the choice
// is global. "automatic" theme defers to the OS; "classic" scheme clears the
// override back to the default indigo brand.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Group, Cell, IconBadge, Segmented, Icons } from "@/components/ios";

type Theme = "automatic" | "light" | "dark";
type Scheme = "classic" | "famu" | "braves";

function applyTheme(theme: Theme) {
  document.querySelectorAll<HTMLElement>('[data-ui="ios"]').forEach((scope) => {
    if (theme === "automatic") scope.removeAttribute("data-theme");
    else scope.setAttribute("data-theme", theme);
  });
}

function applyScheme(scheme: Scheme) {
  document.querySelectorAll<HTMLElement>('[data-ui="ios"]').forEach((scope) => {
    if (scheme === "classic") scope.removeAttribute("data-scheme");
    else scope.setAttribute("data-scheme", scheme);
  });
}

const SCHEME_SWATCH: Record<Scheme, string> = {
  classic: "#356FB0",
  famu: "#F58025",
  braves: "#CE1141",
};

export default function AppearanceAccount() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("automatic");
  const [scheme, setScheme] = useState<Scheme>("classic");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem("ios-theme") as Theme | null) ?? "automatic";
    const savedScheme = (localStorage.getItem("ios-scheme") as Scheme | null) ?? "classic";
    setTheme(savedTheme);
    setScheme(savedScheme);
    applyTheme(savedTheme);
    applyScheme(savedScheme);
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
