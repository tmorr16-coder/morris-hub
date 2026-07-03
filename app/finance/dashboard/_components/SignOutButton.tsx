"use client";

import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  async function handleSignOut() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="ios-btn ios-btn--plain"
      style={{ color: "var(--ios-red)" }}
    >
      Sign out
    </button>
  );
}
