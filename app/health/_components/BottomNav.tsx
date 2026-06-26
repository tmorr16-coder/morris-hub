"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

const TABS = [
  { label: "Today",    href: "/health" },
  { label: "Train",    href: "/health/train" },
  { label: "Eat",      href: "/health/nutrition" },
  { label: "History",  href: "/health/day" },
  { label: "Health",   href: "/health/medications" },
  { label: "Profile",  href: "/health/profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata ?? {};
      setAvatarUrl(meta.avatar_url ?? meta.picture ?? null);
    });
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        background: "var(--color-bg-raised)",
        borderTop: "1px solid var(--color-line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        zIndex: 50,
      }}
    >
      {TABS.map(({ label, href }) => {
        const isActive =
          href === "/health"
            ? pathname === "/health"
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              textDecoration: "none",
              color: isActive ? "var(--color-accent)" : "var(--color-ink-3)",
              flex: 1,
              padding: "8px 0",
            }}
          >
            {href === "/health/profile" && avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Profile"
                width={22}
                height={22}
                style={{
                  borderRadius: "50%",
                  border: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </span>
            )}
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: isActive ? "var(--color-accent)" : "transparent",
              }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
