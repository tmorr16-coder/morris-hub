"use client";

import { useState, useEffect } from "react";

interface Props {
  linkedinConnected: boolean;
  linkedinName: string | null;
  linkedinPictureUrl: string | null;
  linkedinConnectedAt: string | null;
  linkedinUrl: string;
  flashMessage: string | null;
  flashType: "success" | "error";
  linkedinConfigured: boolean;
}

export default function CareerSettingsClient({
  linkedinConnected, linkedinName, linkedinPictureUrl, linkedinConnectedAt,
  linkedinUrl: initialLinkedinUrl, flashMessage, flashType, linkedinConfigured,
}: Props) {
  const [connected, setConnected] = useState(linkedinConnected);
  const [disconnecting, setDisconnecting] = useState(false);
  const [flash, setFlash] = useState(flashMessage);
  const [flashKind, setFlashKind] = useState(flashType);
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedinUrl);
  const [savingUrl, setSavingUrl] = useState(false);

  // Notification preferences (stored locally — backend integration future)
  const [advisorDigest, setAdvisorDigest] = useState(true);
  const [goalReminders, setGoalReminders] = useState(true);
  const [weeklyReview, setWeeklyReview] = useState(false);

  // Privacy controls
  const [shareWithAdvisor, setShareWithAdvisor] = useState(true);

  useEffect(() => {
    if (flash) { const t = setTimeout(() => setFlash(null), 5000); return () => clearTimeout(t); }
  }, [flash]);

  async function disconnect() {
    setDisconnecting(true);
    await fetch("/api/career/linkedin/disconnect", { method: "POST" });
    setConnected(false);
    setDisconnecting(false);
    setFlash("LinkedIn disconnected.");
    setFlashKind("success");
  }

  async function saveLinkedinUrl() {
    setSavingUrl(true);
    await fetch("/api/career/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedin_url: linkedinUrl }),
    });
    setSavingUrl(false);
    setFlash("LinkedIn URL saved.");
    setFlashKind("success");
  }

  const card: React.CSSProperties = { background: "var(--color-bg-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "20px 22px", marginBottom: 16 };
  const label: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 10, display: "block" };
  const toggle = (on: boolean, set: (v: boolean) => void) => (
    <button onClick={() => set(!on)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: on ? "var(--color-accent)" : "var(--color-rule)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );

  return (
    <div>
      {flash && (
        <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 20, background: flashKind === "success" ? "rgba(74,107,58,0.1)" : "rgba(154,59,42,0.1)", border: `1px solid ${flashKind === "success" ? "var(--color-green)" : "var(--color-red)"}`, fontSize: 13, color: flashKind === "success" ? "var(--color-green)" : "var(--color-red)" }}>
          {flash}
        </div>
      )}

      {/* LinkedIn */}
      <div style={card}>
        <span style={label}>LinkedIn</span>
        {!linkedinConfigured ? (
          <div style={{ fontSize: 13, color: "var(--color-ink-3)", lineHeight: 1.6 }}>
            LinkedIn OAuth is not configured. Add <code style={{ fontSize: 12, background: "var(--color-bg-deep)", padding: "2px 6px", borderRadius: 4 }}>LINKEDIN_CLIENT_ID</code> and <code style={{ fontSize: 12, background: "var(--color-bg-deep)", padding: "2px 6px", borderRadius: 4 }}>LINKEDIN_CLIENT_SECRET</code> to Vercel environment variables, then register <code style={{ fontSize: 12, background: "var(--color-bg-deep)", padding: "2px 6px", borderRadius: 4 }}>https://morrisai.family/api/career/linkedin/callback</code> as a redirect URL in your LinkedIn app.
          </div>
        ) : connected ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              {linkedinPictureUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={linkedinPictureUrl} alt="" width={44} height={44} style={{ borderRadius: "50%", objectFit: "cover" }} />
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{linkedinName ?? "Connected"}</div>
                <div style={{ fontSize: 11, color: "var(--color-ink-4)" }}>
                  {linkedinConnectedAt ? `Connected ${new Date(linkedinConnectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "LinkedIn connected"}
                </div>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 10, background: "rgba(74,107,58,0.1)", color: "var(--color-green)" }}>● Active</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 14, lineHeight: 1.5 }}>
              Your LinkedIn profile name and picture have been imported. The Career Advisor uses this data to personalise its recommendations.
            </p>
            <button onClick={disconnect} disabled={disconnecting} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "transparent", color: "var(--color-ink-3)", cursor: "pointer", fontFamily: "inherit" }}>
              {disconnecting ? "Disconnecting…" : "Disconnect LinkedIn"}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 14, lineHeight: 1.5 }}>
              Connect LinkedIn to automatically import your name, profile picture, and headline. This data powers the Career Advisor — the more context it has, the better its recommendations.
            </p>
            <a href="/api/career/linkedin/connect" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, border: "none", background: "#0077B5", color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              Connect with LinkedIn
            </a>
          </div>
        )}

        {/* Manual URL fallback */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--color-rule)" }}>
          <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginBottom: 8 }}>Or paste your LinkedIn URL manually (used as a reference link)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/your-profile"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-rule)", background: "var(--color-bg)", color: "var(--color-ink)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            <button onClick={saveLinkedinUrl} disabled={savingUrl}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--color-accent)", color: "#FFFDF8", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              {savingUrl ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div style={card}>
        <span style={label}>Notification Preferences</span>
        {[
          { key: "advisor", label: "Career Advisor weekly digest", desc: "Summary of insights and suggested actions from your advisor", state: advisorDigest, set: setAdvisorDigest },
          { key: "goals", label: "Goal milestone reminders", desc: "Nudges when goal milestones are approaching", state: goalReminders, set: setGoalReminders },
          { key: "review", label: "Weekly 70/20/10 review prompt", desc: "Reminder to log experiences and learning each week", state: weeklyReview, set: setWeeklyReview },
        ].map((item) => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--color-rule-soft)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink)" }}>{item.label}</div>
              <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 2 }}>{item.desc}</div>
            </div>
            {toggle(item.state, item.set)}
          </div>
        ))}
        <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 10 }}>Notification delivery (email/SMS) coming soon.</div>
      </div>

      {/* Privacy */}
      <div style={card}>
        <span style={label}>Privacy</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink)" }}>Share profile with Career Advisor</div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 2 }}>When on, the advisor receives your resume, goals, and experiences as context for every conversation.</div>
          </div>
          {toggle(shareWithAdvisor, setShareWithAdvisor)}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-ink-3)", padding: "10px 0", borderTop: "1px solid var(--color-rule-soft)", lineHeight: 1.6 }}>
          Career data is never shared with other platform members and is not used to train AI models. <a href="/privacy" style={{ color: "var(--color-accent)" }}>Privacy policy →</a>
        </div>
      </div>
    </div>
  );
}
