"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LargeTitle, Icons } from "@/components/ios";

interface Challenge {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  visibility?: "platform" | "family";
  plan: { title: string; duration_days: number } | null;
  participants?: { count: number }[];
}

interface EligiblePlan {
  id: string;
  title: string;
  duration_days: number;
}

export default function ChallengesClient({
  challenges: initialChallenges, joinedIds, userId, eligiblePlans,
}: {
  challenges: Challenge[];
  joinedIds: string[];
  userId: string;
  eligiblePlans: EligiblePlan[];
}) {
  const [challenges, setChallenges] = useState(initialChallenges);
  const [joined, setJoined] = useState(new Set(joinedIds));
  const [joining, setJoining] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState(eligiblePlans[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient() as any;

  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFormOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [formOpen]);

  async function createChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlanId || !title.trim()) return;
    setSaving(true);
    setCreateError(null);
    const res = await fetch("/api/bible/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: selectedPlanId, title, description }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setCreateError(data.error ?? "Failed to create challenge"); return; }

    const plan = eligiblePlans.find((p) => p.id === selectedPlanId) ?? null;
    setChallenges((prev) => [{
      id: data.challenge_id,
      title: title.trim(),
      description: description.trim() || undefined,
      start_date: new Date().toISOString().slice(0, 10),
      visibility: "family",
      plan: plan ? { title: plan.title, duration_days: plan.duration_days } : null,
      participants: [{ count: 1 }],
    }, ...prev]);
    setJoined((prev) => new Set([...prev, data.challenge_id]));
    setTitle(""); setDescription(""); setFormOpen(false);
  }

  async function toggleJoin(challengeId: string) {
    setJoining(challengeId);
    if (joined.has(challengeId)) {
      await db.schema("bible").from("challenge_participants").delete()
        .eq("challenge_id", challengeId).eq("user_id", userId);
      const next = new Set(joined);
      next.delete(challengeId);
      setJoined(next);
    } else {
      await db.schema("bible").from("challenge_participants").upsert(
        { challenge_id: challengeId, user_id: userId },
        { onConflict: "challenge_id,user_id" }
      );
      setJoined(new Set([...joined, challengeId]));
    }
    setJoining(null);
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", background: "var(--ios-fill)", border: "none",
    borderRadius: 10, fontSize: 16, color: "var(--ios-label)", fontFamily: "inherit",
    boxSizing: "border-box", outline: "none",
  };

  return (
    <>
      <LargeTitle
        title="Challenges"
        subtitle="Platform-wide challenges anyone can join, plus challenges scoped to your family circle."
        onCompose={eligiblePlans.length > 0 ? () => setFormOpen(true) : undefined}
      />

      {challenges.length === 0 && (
        <div style={{ textAlign: "center", padding: "56px 24px", color: "var(--ios-label-2)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 52, height: 52, borderRadius: 26, background: "var(--ios-fill)", color: "var(--ios-orange)", marginBottom: 14 }}>
            <Icons.SparkleIcon aria-hidden style={{ width: 26, height: 26 }} />
          </span>
          <div className="ios-headline" style={{ color: "var(--ios-label)" }}>No active challenges</div>
          <div className="ios-subhead" style={{ marginTop: 4 }}>
            {eligiblePlans.length > 0 ? "Start a family challenge, or wait for a platform challenge." : "Enroll in a reading plan to start a family challenge."}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "14px 0 8px" }}>
        {challenges.map((ch) => {
          const isJoined = joined.has(ch.id);
          const participantCount = ch.participants?.[0]?.count ?? 0;
          return (
            <div key={ch.id} style={{ background: "var(--ios-cell)", borderRadius: "var(--ios-radius-card)", margin: "0 var(--ios-gutter)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="ios-headline" style={{ color: "var(--ios-label)" }}>{ch.title}</span>
                    {ch.visibility === "family" && (
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: "rgba(107,91,149,0.14)", color: "#6B5B95" }}>
                        Family
                      </span>
                    )}
                    {isJoined && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ios-green)", fontWeight: 500 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--ios-green)" }} />
                        Joined
                      </span>
                    )}
                  </div>
                  {ch.description && (
                    <div className="ios-subhead" style={{ marginTop: 5, lineHeight: 1.45 }}>{ch.description}</div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }} className="ios-footnote">
                    {ch.plan && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ios-label-2)" }}>
                        <Icons.BookIcon aria-hidden style={{ width: 14, height: 14 }} />
                        {ch.plan.title} <span className="ios-num">({ch.plan.duration_days} days)</span>
                      </span>
                    )}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ios-label-2)" }}>
                      <Icons.CalendarIcon aria-hidden style={{ width: 14, height: 14 }} />
                      <span className="ios-num">Started {new Date(ch.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ios-label-2)" }}>
                      <Icons.PeopleIcon aria-hidden style={{ width: 14, height: 14 }} />
                      <span className="ios-num">{participantCount}</span> participants
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => toggleJoin(ch.id)}
                  disabled={joining === ch.id}
                  style={{
                    flexShrink: 0, padding: "8px 18px", borderRadius: 999, fontSize: 15, fontWeight: 600,
                    background: isJoined ? "var(--ios-fill)" : "var(--ios-tint)",
                    color: isJoined ? "var(--ios-label)" : "var(--ios-on-tint)",
                    opacity: joining === ch.id ? 0.6 : 1,
                  }}
                >
                  {joining === ch.id ? "…" : isJoined ? "Leave" : "Join"}
                </button>
              </div>

              {isJoined && ch.plan && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "var(--ios-hair, 0.5px) solid var(--ios-separator)" }}>
                  <Link href="/bible/plans" className="ios-subhead" style={{ color: "var(--ios-tint)", textDecoration: "none", fontWeight: 500 }}>
                    View reading plan →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ height: 12 }} />

      {/* Create family-challenge sheet */}
      {formOpen && (
        <>
          <div className="ios-sheet-backdrop" onClick={() => setFormOpen(false)} aria-hidden="true" />
          <form onSubmit={createChallenge} className="ios-sheet" role="dialog" aria-modal="true" aria-label="New family challenge">
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <button type="button" className="ios-btn--plain" onClick={() => setFormOpen(false)}>Cancel</button>
              <span className="ios-headline">Family challenge</span>
              <span style={{ width: 52 }} />
            </div>

            <div className="ios-group-header" style={{ padding: "14px 0 6px" }}>Reading plan</div>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              style={{ ...fieldStyle, appearance: "none", WebkitAppearance: "none" }}
            >
              {eligiblePlans.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.duration_days} days)</option>
              ))}
            </select>

            <div className="ios-group-header" style={{ padding: "16px 0 6px" }}>Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Family Advent Challenge"
              required
              style={fieldStyle}
            />

            <div className="ios-group-header" style={{ padding: "16px 0 6px" }}>Description (optional)</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...fieldStyle, minHeight: 64, resize: "vertical", lineHeight: 1.5 }}
            />

            {createError && (
              <p className="ios-footnote" style={{ padding: "12px 0 0", color: "var(--ios-red)" }}>{createError}</p>
            )}

            <button
              type="submit"
              className="ios-btn ios-btn--primary"
              style={{ marginTop: 20, opacity: (saving || !selectedPlanId || !title.trim()) ? 0.5 : 1 }}
              disabled={saving || !selectedPlanId || !title.trim()}
            >
              {saving ? "Creating…" : "Create challenge"}
            </button>
          </form>
        </>
      )}
    </>
  );
}
