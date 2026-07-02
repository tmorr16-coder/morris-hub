"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif, serif)", fontSize: 26, fontWeight: 400, margin: 0 }}>
          🏆 Reading Challenges
        </h1>
        {eligiblePlans.length > 0 && (
          <button
            onClick={() => setFormOpen((o) => !o)}
            style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: "1px solid var(--color-accent)",
              background: formOpen ? "transparent" : "var(--color-accent)",
              color: formOpen ? "var(--color-accent)" : "#fff", flexShrink: 0,
            }}
          >
            {formOpen ? "Cancel" : "+ Family challenge"}
          </button>
        )}
      </div>
      <p style={{ color: "var(--color-ink-3)", fontSize: 14, margin: "0 0 24px" }}>
        Platform-wide challenges anyone can join, plus challenges scoped to your family circle.
      </p>

      {formOpen && (
        <form onSubmit={createChallenge} style={{
          background: "var(--color-bg-card)", border: "1px solid var(--color-accent)",
          borderRadius: 12, padding: "18px 20px", marginBottom: 20,
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>
              Reading plan
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
            >
              {eligiblePlans.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.duration_days} days)</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Family Advent Challenge"
              required
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-ink-3)", display: "block", marginBottom: 6 }}>
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", minHeight: 60, padding: "9px 12px", border: "1px solid var(--color-rule)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
          {createError && <div style={{ fontSize: 12, color: "var(--color-red)" }}>{createError}</div>}
          <button
            type="submit"
            disabled={saving || !selectedPlanId || !title.trim()}
            style={{
              padding: "10px", background: "var(--color-accent)", color: "#fff", border: "none",
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Creating…" : "Create challenge"}
          </button>
        </form>
      )}

      {challenges.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-ink-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ fontWeight: 600 }}>No active challenges</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {eligiblePlans.length > 0 ? "Start a family challenge above, or wait for a platform challenge." : "Enroll in a reading plan to start a family challenge."}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {challenges.map((ch) => {
          const isJoined = joined.has(ch.id);
          const participantCount = ch.participants?.[0]?.count ?? 0;
          return (
            <div key={ch.id} style={{
              background: "var(--color-bg-card)", border: `1px solid ${isJoined ? "var(--color-accent)" : "var(--color-rule)"}`,
              borderRadius: 14, padding: "18px 22px", boxShadow: "var(--shadow-card)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, color: "var(--color-ink)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    {ch.title}
                    {ch.visibility === "family" && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 8, background: "rgba(107,91,149,0.1)", color: "#6B5B95" }}>
                        Family
                      </span>
                    )}
                    {isJoined && <span style={{ fontSize: 11, color: "var(--color-accent)", fontWeight: 500 }}>● Joined</span>}
                  </div>
                  {ch.description && (
                    <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 8, lineHeight: 1.5 }}>{ch.description}</div>
                  )}
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--color-ink-4)" }}>
                    {ch.plan && <span>📋 {ch.plan.title} ({ch.plan.duration_days} days)</span>}
                    <span>Started {new Date(ch.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <span>👥 {participantCount} participants</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleJoin(ch.id)}
                  disabled={joining === ch.id}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                    border: `1px solid ${isJoined ? "var(--color-rule)" : "var(--color-accent)"}`,
                    background: isJoined ? "transparent" : "var(--color-accent)",
                    color: isJoined ? "var(--color-ink-2)" : "#fff",
                    flexShrink: 0,
                  }}
                >
                  {joining === ch.id ? "…" : isJoined ? "Leave" : "Join"}
                </button>
              </div>

              {isJoined && ch.plan && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-rule)" }}>
                  <Link href="/bible/plans" style={{ fontSize: 13, color: "var(--color-accent)", textDecoration: "none", fontWeight: 500 }}>
                    View reading plan →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
