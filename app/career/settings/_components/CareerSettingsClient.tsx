"use client";

import { useState, useEffect } from "react";
import { Group, Cell } from "@/components/ios";

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

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "10px 14px",
  borderRadius: 10,
  border: "var(--ios-hair) solid var(--ios-separator)",
  background: "var(--ios-bg)",
  color: "var(--ios-label)",
  fontSize: 16,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "light dark",
};

const codeStyle: React.CSSProperties = {
  fontSize: 12,
  background: "var(--ios-fill)",
  padding: "2px 6px",
  borderRadius: 4,
};

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

  const toggle = (on: boolean, set: (v: boolean) => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => set(!on)}
      style={{ width: 51, height: 31, borderRadius: 16, border: "none", background: on ? "var(--ios-green)" : "var(--ios-fill-2)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );

  const notifications = [
    { key: "advisor", label: "Career Advisor weekly digest", desc: "Summary of insights and suggested actions from your advisor", state: advisorDigest, set: setAdvisorDigest },
    { key: "goals", label: "Goal milestone reminders", desc: "Nudges when goal milestones are approaching", state: goalReminders, set: setGoalReminders },
    { key: "review", label: "Weekly 70/20/10 review prompt", desc: "Reminder to log experiences and learning each week", state: weeklyReview, set: setWeeklyReview },
  ];

  return (
    <div>
      {flash && (
        <div
          className="ios-footnote"
          style={{
            margin: "10px 16px 0",
            padding: "11px 14px",
            borderRadius: 10,
            background: "var(--ios-fill)",
            color: flashKind === "success" ? "var(--ios-green)" : "var(--ios-red)",
          }}
        >
          {flash}
        </div>
      )}

      {/* LinkedIn */}
      <Group header="LinkedIn">
        {!linkedinConfigured ? (
          <div className="ios-cell">
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.6 }}>
              LinkedIn OAuth is not configured. Add <code style={codeStyle}>LINKEDIN_CLIENT_ID</code> and <code style={codeStyle}>LINKEDIN_CLIENT_SECRET</code> to Vercel environment variables, then register <code style={codeStyle}>https://morrisai.family/api/career/linkedin/callback</code> as a redirect URL in your LinkedIn app.
            </span>
          </div>
        ) : connected ? (
          <>
            <div className="ios-cell">
              {linkedinPictureUrl && (
                <span className="ios-cell-lead">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={linkedinPictureUrl} alt="" width={40} height={40} style={{ borderRadius: "50%", objectFit: "cover" }} />
                </span>
              )}
              <span className="ios-cell-body">
                <span className="ios-cell-title">{linkedinName ?? "Connected"}</span>
                <span className="ios-cell-sub">
                  {linkedinConnectedAt ? `Connected ${new Date(linkedinConnectedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "LinkedIn connected"}
                </span>
              </span>
              <span className="ios-cell-trail">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--ios-green)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ios-green)" }} />
                  Active
                </span>
              </span>
            </div>
            <div className="ios-cell">
              <span className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
                Your LinkedIn profile name and picture have been imported. The Career Advisor uses this data to personalise its recommendations.
              </span>
            </div>
            <button type="button" onClick={disconnect} disabled={disconnecting} className="ios-cell" style={{ color: "var(--ios-red)" }}>
              <span className="ios-cell-body">
                <span className="ios-cell-title" style={{ color: "var(--ios-red)" }}>
                  {disconnecting ? "Disconnecting…" : "Disconnect LinkedIn"}
                </span>
              </span>
            </button>
          </>
        ) : (
          <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 14 }}>
            <span className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.5 }}>
              Connect LinkedIn to automatically import your name, profile picture, and headline. This data powers the Career Advisor — the more context it has, the better its recommendations.
            </span>
            <a href="/api/career/linkedin/connect" className="ios-btn" style={{ background: "#0077B5", color: "#fff", textDecoration: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
              Connect with LinkedIn
            </a>
          </div>
        )}

        {/* Manual URL fallback */}
        <div className="ios-cell" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Or paste your LinkedIn URL manually (used as a reference link)</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/your-profile"
              style={inputStyle} />
            <button type="button" onClick={saveLinkedinUrl} disabled={savingUrl} className="ios-btn"
              style={{ minHeight: 0, padding: "0 18px", borderRadius: 10, fontSize: 15, background: "var(--ios-tint)", color: "var(--ios-on-tint)", whiteSpace: "nowrap" }}>
              {savingUrl ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Group>

      {/* Notifications */}
      <Group header="Notification Preferences" footer="Notification delivery (email/SMS) coming soon.">
        {notifications.map((item) => (
          <Cell
            key={item.key}
            title={item.label}
            subtitle={item.desc}
            trailing={toggle(item.state, item.set)}
            chevron={false}
          />
        ))}
      </Group>

      {/* Privacy */}
      <Group
        header="Privacy"
        footer={
          <>
            Career data is never shared with other platform members and is not used to train AI models. <a href="/privacy" style={{ color: "var(--ios-tint)" }}>Privacy policy →</a>
          </>
        }
      >
        <Cell
          title="Share profile with Career Advisor"
          subtitle="When on, the advisor receives your resume, goals, and experiences as context for every conversation."
          trailing={toggle(shareWithAdvisor, setShareWithAdvisor)}
          chevron={false}
        />
      </Group>
    </div>
  );
}
