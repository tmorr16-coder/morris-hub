"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Challenge {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  plan: { title: string; duration_days: number } | null;
  participants?: { count: number }[];
}

export default function ChallengesClient({
  challenges, joinedIds, userId,
}: {
  challenges: Challenge[];
  joinedIds: string[];
  userId: string;
}) {
  const [joined, setJoined] = useState(new Set(joinedIds));
  const [joining, setJoining] = useState<string | null>(null);
  const db = createClient() as any;

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
      <h1 style={{ fontFamily: "var(--font-instrument-serif, serif)", fontSize: 26, fontWeight: 400, margin: "0 0 6px" }}>
        🏆 Reading Challenges
      </h1>
      <p style={{ color: "var(--color-ink-3)", fontSize: 14, margin: "0 0 24px" }}>
        Platform-wide challenges the whole family can follow together.
      </p>

      {challenges.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-ink-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ fontWeight: 600 }}>No active challenges</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Platform challenges are created by an admin.</div>
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
                  <div style={{ fontWeight: 600, fontSize: 16, color: "var(--color-ink)", marginBottom: 4 }}>
                    {ch.title}
                    {isJoined && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--color-accent)", fontWeight: 500 }}>● Joined</span>}
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
