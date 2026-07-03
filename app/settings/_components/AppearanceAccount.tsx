"use client";

// Appearance (theme) + account actions for the Settings hub. Theme is applied
// by stamping data-theme on the `[data-ui="ios"]` scope container and persisted
// to localStorage; "automatic" defers to the OS (prefers-color-scheme), which
// ios.css already handles when no explicit data-theme is present.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Group, Cell, IconBadge, Segmented, Icons } from "@/components/ios";

type Theme = "automatic" | "light" | "dark";

function applyTheme(theme: Theme) {
  document.querySelectorAll<HTMLElement>('[data-ui="ios"]').forEach((scope) => {
    if (theme === "automatic") scope.removeAttribute("data-theme");
    else scope.setAttribute("data-theme", theme);
  });
}

export default function AppearanceAccount() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("automatic");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("ios-theme") as Theme | null) ?? "automatic";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const onTheme = (t: Theme) => {
    setTheme(t);
    localStorage.setItem("ios-theme", t);
    applyTheme(t);
  };

  const signOut = async () => {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push("/login");
  };

  return (
    <>
      <Group header="Appearance" footer="Automatic follows your device's light or dark setting.">
        <Cell
          lead={<IconBadge color="#5E5CE6"><Icons.MoonIcon /></IconBadge>}
          title="Theme"
          chevron={false}
        />
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
