"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export interface ProfileMenuUser {
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  isAdmin?: boolean;
}

export default function ProfileMenu({ user }: { user: ProfileMenuUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const initial = (user.name ?? user.email ?? "?").slice(0, 1).toUpperCase();
  const displayName = user.name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: 8,
          fontFamily: "var(--font-geist, system-ui), sans-serif",
        }}
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={28}
            height={28}
            style={{ borderRadius: "50%", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--color-accent)",
              color: "#FFFDF8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
        )}
        <span style={{ fontSize: 12, color: "var(--color-ink-2)" }}>{displayName}</span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
          style={{ color: "var(--color-ink-4)", transition: "transform 150ms", transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile options"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-rule)",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            minWidth: 200,
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px 10px",
              borderBottom: "1px solid var(--color-rule-soft)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink)", fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
              {user.name ?? displayName}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 2, fontFamily: "var(--font-geist, system-ui), sans-serif" }}>
              {user.email}
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: "4px 0" }}>
            <a
              href="/home/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 16px",
                fontSize: 13,
                color: "var(--color-ink-2)",
                textDecoration: "none",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.6 2.6l1.06 1.06M10.34 10.34l1.06 1.06M2.6 11.4l1.06-1.06M10.34 3.66l1.06-1.06"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              Settings
            </a>

            {user.isAdmin && (
              <a
                href="/home/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px",
                  fontSize: 13,
                  color: "var(--color-ink-2)",
                  textDecoration: "none",
                  fontFamily: "var(--font-geist, system-ui), sans-serif",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M4 7h6M4 9.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  <circle cx="7" cy="4.5" r="1" fill="currentColor" />
                </svg>
                Admin
              </a>
            )}

            <div style={{ height: 1, background: "var(--color-rule-soft)", margin: "4px 0" }} />

            <button
              role="menuitem"
              onClick={handleSignOut}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "center",
                gap: 10,
                padding: "9px 16px",
                fontSize: 13,
                color: "var(--color-red)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-geist, system-ui), sans-serif",
                textAlign: "left",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5 7h7M9 4.5L12 7l-3 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
