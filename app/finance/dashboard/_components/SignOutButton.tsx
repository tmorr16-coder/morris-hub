"use client";

import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  async function handleSignOut() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleSignOut}
      style={{
        padding: "6px 14px",
        borderRadius: 8,
        border: "1px solid var(--color-rule)",
        background: "transparent",
        color: "var(--color-ink-2)",
        fontSize: 12,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
