"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Chip } from "@/components/ios";
import { saveProfileGoals, deleteMyAccount, submitSupportTicket } from "../actions";

interface OAuthUser {
  name: string;
  email: string;
  avatarUrl: string | null;
  provider: string;
}

interface UserProfile {
  name: string;
  age: string;
  fitnessGoals: string[];
  activityLevel: string;
  dietary: string[];
  currentWeightLbs: string;
  targetWeightLbs: string;
  calorieGoal: string;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  age: "",
  fitnessGoals: [],
  activityLevel: "",
  dietary: [],
  currentWeightLbs: "",
  targetWeightLbs: "",
  calorieGoal: "",
};

const STORAGE_KEY = "health-dashboard-profile";

const FITNESS_GOALS = [
  { value: "lose_weight",    label: "Lose weight" },
  { value: "maintain",       label: "Maintain weight" },
  { value: "build_muscle",   label: "Build muscle" },
  { value: "endurance",      label: "Improve endurance" },
  { value: "general_health", label: "General health" },
  { value: "flexibility",    label: "Flexibility & mobility" },
  { value: "performance",    label: "Athletic performance" },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", sub: "Desk job, little exercise" },
  { value: "light",     label: "Light",     sub: "1–3 workouts/week" },
  { value: "moderate",  label: "Moderate",  sub: "3–5 workouts/week" },
  { value: "active",    label: "Active",    sub: "6–7 workouts/week" },
];

const DIETARY_OPTIONS = [
  "No restrictions", "Vegetarian", "Vegan", "Keto", "Paleo",
  "Gluten-free", "Dairy-free", "Intermittent fasting", "High protein", "Low carb",
];

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google", apple: "Apple", linkedin: "LinkedIn", github: "GitHub",
};

const cardStyle: React.CSSProperties = {
  background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", padding: "16px",
};

const fieldLabel: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "var(--ios-label)", marginBottom: 6,
};

const groupLabel: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "var(--ios-label)", marginBottom: 14,
};

const fieldInput: React.CSSProperties = {
  width: "100%", padding: "11px 12px", borderRadius: 10,
  border: "1px solid var(--ios-separator)", background: "var(--ios-bg)",
  color: "var(--ios-label)", fontSize: 16, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};

export default function ProfileClient({ withingsWeightLbs, isAdmin }: { withingsWeightLbs: number | null; isAdmin: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  const [oauthUser, setOauthUser] = useState<OAuthUser | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [ticketType, setTicketType] = useState<"bug" | "feature" | "question" | "other">("question");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketSent, setTicketSent] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [ticketSending, setTicketSending] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.fitnessGoal === "string" && !parsed.fitnessGoals) {
          parsed.fitnessGoals = parsed.fitnessGoal ? [parsed.fitnessGoal] : [];
          delete parsed.fitnessGoal;
        }
        setProfile({ ...DEFAULT_PROFILE, ...parsed });
      }
    } catch { /* ignore */ }

    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const meta = user.user_metadata ?? {};
      const oauth: OAuthUser = {
        name:      meta.full_name ?? meta.name ?? "",
        email:     user.email ?? "",
        avatarUrl: meta.avatar_url ?? meta.picture ?? null,
        provider:  user.app_metadata?.provider ?? "google",
      };
      setOauthUser(oauth);
      setProfile((p) => ({ ...p, name: p.name || oauth.name }));
    });
  }, []);

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  function toggleGoal(value: string) {
    setProfile((p) => {
      const next = p.fitnessGoals.includes(value)
        ? p.fitnessGoals.filter((g) => g !== value)
        : [...p.fitnessGoals, value];
      return { ...p, fitnessGoals: next };
    });
    setSaved(false);
  }

  function toggleDietary(option: string) {
    setProfile((p) => {
      const next = p.dietary.includes(option)
        ? p.dietary.filter((d) => d !== option)
        : [...p.dietary, option];
      return { ...p, dietary: next };
    });
    setSaved(false);
  }

  function handleTicketSubmit() {
    if (!ticketSubject.trim() || !ticketDesc.trim()) return;
    setTicketError(null);
    setTicketSending(true);
    startTransition(async () => {
      const result = await submitSupportTicket({ type: ticketType, subject: ticketSubject, description: ticketDesc });
      setTicketSending(false);
      if (result.error) { setTicketError(result.error); return; }
      setTicketSent(true);
      setTicketSubject("");
      setTicketDesc("");
      setTimeout(() => setTicketSent(false), 4000);
    });
  }

  function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setDeleteError(null);
    setDeleteInProgress(true);
    startTransition(async () => {
      try {
        localStorage.clear();
      } catch { /* ignore */ }
      const result = await deleteMyAccount();
      if (result.error) {
        setDeleteError(result.error);
        setDeleteInProgress(false);
        return;
      }
      await createClient().auth.signOut();
      router.push("/health");
    });
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch { /* ignore */ }
    const targetLbs = parseFloat(profile.targetWeightLbs);
    const calGoal   = parseFloat(profile.calorieGoal);
    saveProfileGoals({
      targetWeightLbs: isNaN(targetLbs) ? null : targetLbs,
      calorieGoal:     isNaN(calGoal)   ? null : calGoal,
    }).catch(() => { /* non-blocking */ });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const ticketReady = !!ticketSubject.trim() && !!ticketDesc.trim();

  return (
    <div style={{ padding: "4px 16px 0" }}>

      {/* OAuth identity */}
      {oauthUser && (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          {oauthUser.avatarUrl ? (
            <Image src={oauthUser.avatarUrl} alt={oauthUser.name} width={56} height={56} style={{ borderRadius: "50%", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--ios-tint)", color: "var(--ios-on-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 600, flexShrink: 0 }}>
              {oauthUser.name?.[0] ?? "?"}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ios-headline" style={{ color: "var(--ios-label)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{oauthUser.name}</div>
            <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{oauthUser.email}</div>
            <div className="ios-caption" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 20, background: "var(--ios-fill)", color: "var(--ios-label-2)" }}>
              via {PROVIDER_LABELS[oauthUser.provider] ?? oauthUser.provider}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Basic info */}
        <div style={cardStyle}>
          <div style={groupLabel}>About you</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={fieldLabel}>Name</div>
              <input value={profile.name} onChange={(e) => update("name", e.target.value)} placeholder="Terry" style={fieldInput} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={fieldLabel}>Age</div>
                <input value={profile.age} onChange={(e) => update("age", e.target.value)} placeholder="35" type="number" min="10" max="120" style={fieldInput} />
              </div>
              <div>
                <div style={fieldLabel}>Activity level</div>
                <select value={profile.activityLevel} onChange={(e) => update("activityLevel", e.target.value)} style={fieldInput}>
                  <option value="">Select…</option>
                  {ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={fieldLabel}>Current weight (lbs)</div>
                {withingsWeightLbs !== null ? (
                  <div style={{ padding: "11px 12px", borderRadius: 10, border: "1px solid var(--ios-separator)", background: "var(--ios-bg)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="ios-num" style={{ fontSize: 16, color: "var(--ios-label)", fontWeight: 500 }}>{withingsWeightLbs.toFixed(1)}</span>
                    <span className="ios-caption" style={{ color: "var(--ios-green)", fontWeight: 600 }}>Withings</span>
                  </div>
                ) : (
                  <input value={profile.currentWeightLbs} onChange={(e) => update("currentWeightLbs", e.target.value)} placeholder="185" type="number" style={fieldInput} />
                )}
              </div>
              <div>
                <div style={fieldLabel}>Target weight (lbs)</div>
                <input value={profile.targetWeightLbs} onChange={(e) => update("targetWeightLbs", e.target.value)} placeholder="170" type="number" style={fieldInput} />
              </div>
            </div>
          </div>
        </div>

        {/* Nutrition goals */}
        <div style={cardStyle}>
          <div style={groupLabel}>Nutrition goals</div>
          <div>
            <div style={fieldLabel}>Daily calorie goal (kcal)</div>
            <input value={profile.calorieGoal} onChange={(e) => update("calorieGoal", e.target.value)} type="number" min="500" max="5000" placeholder="e.g. 2000" style={fieldInput} />
            <div className="ios-caption" style={{ color: "var(--ios-label-3)", marginTop: 6 }}>Used to show your daily progress in the Eat tab</div>
          </div>
        </div>

        {/* Fitness goals */}
        <div style={cardStyle}>
          <div style={{ ...groupLabel, marginBottom: 4 }}>Fitness goals</div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-3)", marginBottom: 12 }}>Select all that apply</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {FITNESS_GOALS.map((g) => (
              <Chip key={g.value} selected={profile.fitnessGoals.includes(g.value)} onClick={() => toggleGoal(g.value)}>
                {g.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Dietary preferences */}
        <div style={cardStyle}>
          <div style={groupLabel}>Dietary preferences</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DIETARY_OPTIONS.map((opt) => (
              <Chip key={opt} selected={profile.dietary.includes(opt)} onClick={() => toggleDietary(opt)}>
                {opt}
              </Chip>
            ))}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={save}
          className="ios-btn ios-btn--full"
          style={{ background: saved ? "var(--ios-green)" : "var(--ios-tint)", color: "#fff", cursor: "pointer", marginBottom: 8 }}
        >
          {saved ? "Saved" : "Save profile"}
        </button>

        {/* Sign out */}
        <button
          onClick={async () => {
            await createClient().auth.signOut();
            window.location.href = "/health";
          }}
          className="ios-btn ios-btn--full"
          style={{ background: "var(--ios-cell)", color: "var(--ios-tint)", cursor: "pointer", marginBottom: 8 }}
        >
          Sign out
        </button>

        {/* Help & Support */}
        <div style={cardStyle}>
          <div style={groupLabel}>Help &amp; Support</div>
          {ticketSent ? (
            <div className="ios-footnote" style={{ background: "var(--ios-fill)", borderRadius: 10, padding: "12px 14px", color: "var(--ios-green)", lineHeight: 1.5 }}>
              Ticket submitted — we&apos;ll be in touch soon.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={fieldLabel}>Type</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["question", "bug", "feature", "other"] as const).map((t) => {
                    const labels = { question: "Question", bug: "Bug", feature: "Feature request", other: "Other" };
                    return (
                      <Chip key={t} small selected={ticketType === t} onClick={() => setTicketType(t)}>
                        {labels[t]}
                      </Chip>
                    );
                  })}
                </div>
              </div>
              <div>
                <div style={fieldLabel}>Subject</div>
                <input value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} placeholder="Brief summary" style={fieldInput} />
              </div>
              <div>
                <div style={fieldLabel}>Details</div>
                <textarea value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} placeholder="Describe the issue or request…" rows={3} style={{ ...fieldInput, resize: "none", lineHeight: 1.5 }} />
              </div>
              {ticketError && <div className="ios-footnote" style={{ color: "var(--ios-red)" }}>{ticketError}</div>}
              <button
                onClick={handleTicketSubmit}
                disabled={ticketSending || !ticketReady}
                className="ios-btn ios-btn--full"
                style={{ background: ticketReady ? "var(--ios-tint)" : "var(--ios-fill)", color: ticketReady ? "#fff" : "var(--ios-label-3)", cursor: ticketReady ? "pointer" : "default" }}
              >
                {ticketSending ? "Sending…" : "Submit ticket"}
              </button>
            </div>
          )}
        </div>

        {/* Admin panel link — only visible to admins. Lives on the hub now. */}
        {isAdmin && (
          <a
            href="https://morrisai.family/home/admin"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 16px", borderRadius: "var(--ios-radius-card)",
              background: "var(--ios-cell)",
              color: "var(--ios-label)", textDecoration: "none", marginBottom: 8,
            }}
          >
            <div>
              <div className="ios-subhead" style={{ fontWeight: 600, marginBottom: 1 }}>Admin panel</div>
              <div className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>Manage users and access on morrisai.family</div>
            </div>
            <span className="ios-footnote" style={{ color: "var(--ios-tint)", fontWeight: 600 }}>Admin ›</span>
          </a>
        )}

        {/* Danger zone */}
        <div style={{ ...cardStyle, border: "1px solid var(--ios-red)", marginBottom: 8 }}>
          <div className="ios-footnote" style={{ fontWeight: 600, color: "var(--ios-red)", marginBottom: 8 }}>
            Danger zone
          </div>
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", lineHeight: 1.6, marginBottom: 12 }}>
            Permanently deletes your account and all associated health data. This cannot be undone.
          </div>
          <div className="ios-caption" style={{ fontWeight: 600, color: "var(--ios-label-3)", marginBottom: 6 }}>
            Type DELETE to confirm
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(null); }}
              placeholder="DELETE"
              style={{ ...fieldInput, flex: 1, border: "1px solid var(--ios-red)" }}
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== "DELETE" || deleteInProgress}
              style={{
                padding: "11px 16px", borderRadius: 10, border: "none",
                background: deleteConfirm === "DELETE" ? "var(--ios-red)" : "var(--ios-fill)",
                color: deleteConfirm === "DELETE" ? "#fff" : "var(--ios-label-3)",
                fontSize: 15, fontWeight: 600,
                cursor: deleteConfirm === "DELETE" ? "pointer" : "default",
                fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              {deleteInProgress ? "Deleting…" : "Delete account"}
            </button>
          </div>
          {deleteError && (
            <div className="ios-footnote" style={{ color: "var(--ios-red)", marginTop: 8 }}>{deleteError}</div>
          )}
        </div>

      </div>
    </div>
  );
}
