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
      className="ios-scroll"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}
    >
      <div style={{ textAlign: "center", padding: "0 24px" }}>
        <div className="ios-title-3" style={{ color: "var(--ios-label)" }}>Connecting your bank…</div>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 6 }}>
          You can close this window.
        </div>
      </div>
    </div>
  );
}
