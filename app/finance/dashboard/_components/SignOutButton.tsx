"use client";

import { signOutOfDevice } from "@/lib/client/sign-out";

export default function SignOutButton() {
  async function handleSignOut() {
    await signOutOfDevice();
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
