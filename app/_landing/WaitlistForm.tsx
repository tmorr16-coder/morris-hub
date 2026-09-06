"use client";

// The only interactive part of the front door. It lives in its own file so
// app/page.tsx can stay a server component and decide, before anything is
// sent, whether this visitor should be looking at the landing page at all.

import { useState } from "react";

export default function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? "Something went wrong."); setStatus("error"); return; }
      setStatus("done");
    } catch {
      setErrorMsg("Could not submit. Check your connection.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="lp-done">
        <div className="lp-done-mark" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </div>
        <div className="lp-done-title">You&rsquo;re on the list</div>
        <div className="lp-note">We&rsquo;ll be in touch when access opens up for new members.</div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="lp-form">
      <input
        required
        className="lp-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        autoComplete="name"
      />
      <input
        required
        type="email"
        className="lp-input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        autoComplete="email"
      />
      {errorMsg && <div className="lp-err">{errorMsg}</div>}
      <button type="submit" disabled={status === "loading"} className="lp-btn lp-btn--solid" style={{ marginTop: 4 }}>
        {status === "loading" ? "Requesting…" : "Request access"}
      </button>
      <div className="lp-note">
        Invitation only. We&rsquo;ll never share your address, and there is no mailing list to unsubscribe from.
      </div>
    </form>
  );
}
