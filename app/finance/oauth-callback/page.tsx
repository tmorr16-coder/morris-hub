"use client";

import { useEffect } from "react";

// Plaid OAuth callback target for institutions that require a redirect
// (Chase, Capital One, etc.). Plaid Link auto-resumes when this page
// loads in the same browser tab that started the flow.
export default function OAuthCallback() {
  useEffect(() => {
    // For multi-tab support, persist the link_token in localStorage and
    // re-initialize usePlaidLink here. Single-tab works without that.
    window.close();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p className="serif" style={{ fontSize: 20, color: "var(--color-ink-2)" }}>
        Connecting your bank…
      </p>
    </div>
  );
}
