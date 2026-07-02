"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export interface SubNavTab {
  href: string;
  label: string;
}

interface Props {
  tabs: SubNavTab[];
  /** Defaults to exact-match on the first tab's href, startsWith for the rest. */
  isActive?: (pathname: string, href: string) => boolean;
}

export default function SubNav({ tabs, isActive }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const activeCheck =
    isActive ?? ((p: string, href: string) => (href === tabs[0].href ? p === href : p.startsWith(href)));

  const activeTab = tabs.find((t) => activeCheck(pathname, t.href)) ?? tabs[0];

  return (
    <div style={{ background: "var(--color-bg-card)", borderBottom: "1px solid var(--color-rule)" }}>
      {/* Desktop / wide viewports — horizontal tab row */}
      <div
        className="subnav-desktop"
        style={{ overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ display: "flex", gap: 0, maxWidth: 1180, margin: "0 auto", padding: "0 28px" }}>
          {tabs.map(({ href, label }) => {
            const active = activeCheck(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "inline-block",
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--color-accent)" : "var(--color-ink-2)",
                  textDecoration: "none",
                  borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "color 0.15s",
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Narrow viewports — dropdown, always fully accessible regardless of tab count */}
      <div className="subnav-mobile" style={{ padding: "8px 16px" }}>
        <select
          value={activeTab.href}
          onChange={(e) => router.push(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid var(--color-rule)",
            background: "var(--color-bg-card)",
            color: "var(--color-ink)",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        >
          {tabs.map(({ href, label }) => (
            <option key={href} value={href}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
