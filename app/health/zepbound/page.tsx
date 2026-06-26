export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/health/auth";
import type { Database } from "@/lib/health/types/database";
import LogDoseButton from "./_components/LogDoseButton";

type DoseRow = Database["public"]["Tables"]["doses"]["Row"];

const INJECTION_SITES = [
  "Left abdomen", "Right abdomen",
  "Left thigh",   "Right thigh",
  "Left arm",     "Right arm",
];

const MOCK_DOSES: DoseRow[] = [
  { id: "m1", user_id: "dev", date: "2026-04-01", dose_mg: 5, injection_site: "Left abdomen",  notes: null, created_at: "2026-04-01T07:30:00Z" },
  { id: "m2", user_id: "dev", date: "2026-04-08", dose_mg: 5, injection_site: "Right abdomen", notes: null, created_at: "2026-04-08T07:45:00Z" },
  { id: "m3", user_id: "dev", date: "2026-04-15", dose_mg: 5, injection_site: "Left thigh",    notes: null, created_at: "2026-04-15T08:00:00Z" },
  { id: "m4", user_id: "dev", date: "2026-04-22", dose_mg: 5, injection_site: "Right thigh",   notes: null, created_at: "2026-04-22T07:15:00Z" },
];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const next = parseLocalDate(dateStr);
  next.setDate(next.getDate() + 7);
  return Math.ceil((next.getTime() - Date.now()) / 86_400_000);
}

export default async function ZepboundPage() {
  const supabase = await createClient();
  const userId   = await getCurrentUserId();

  const { data: rawDoses } = (await supabase
    .from("doses")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true })) as { data: DoseRow[] | null; error: unknown };

  const doses  = rawDoses && rawDoses.length > 0 ? rawDoses : MOCK_DOSES;
  const latest = doses[doses.length - 1];

  const lastSite        = latest.injection_site ?? "Unknown";
  const recommendedSite = INJECTION_SITES.find((s) => s !== lastSite) ?? "Left abdomen";
  const currentDoseMg   = latest.dose_mg;
  const weekNumber      = doses.length + 1;

  const days      = daysUntil(latest.date);
  const daysLabel = days > 0 ? `${days} day${days === 1 ? "" : "s"}` : days === 0 ? "Today" : "Overdue";
  const isUrgent  = days <= 1;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ padding: "20px 20px 0" }}>
        <Link
          href="/health/medications"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            color: "var(--color-ink-3)",
            textDecoration: "none",
            marginBottom: 20,
          }}
        >
          ← Health
        </Link>

        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 6,
          }}
        >
          Zepbound · Tirzepatide
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 36,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "var(--color-ink)",
            }}
          >
            Week {doses.length}<br />
            <span style={{ color: "var(--color-accent)" }}>{currentDoseMg} mg.</span>
          </div>
          <LogDoseButton
            recommendedSite={recommendedSite}
            defaultDoseMg={currentDoseMg}
            weekNumber={weekNumber}
          />
        </div>
      </div>

      {/* ── Stats 2×2 ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          padding: "0 20px 16px",
        }}
      >
        {[
          { label: "Doses logged",  value: String(doses.length),        sub: "total injections" },
          { label: "Current dose",  value: `${currentDoseMg} mg`,       sub: "tirzepatide" },
          { label: "Last site",     value: lastSite,                     sub: "previous injection" },
          {
            label: "Next dose",
            value: daysLabel,
            sub: "Suggested: " + recommendedSite,
            urgent: isUrgent,
          },
        ].map(({ label, value, sub, urgent }) => (
          <div
            key={label}
            style={{
              background: "var(--color-bg-raised)",
              border: `1px solid ${urgent ? "var(--color-accent)" : "var(--color-line)"}`,
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-ink-4)",
                marginBottom: 6,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 400,
                letterSpacing: "-0.01em",
                color: urgent ? "var(--color-accent)" : "var(--color-ink)",
                lineHeight: 1.2,
                marginBottom: 3,
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 10, color: "var(--color-ink-4)", lineHeight: 1.3 }}>
              {sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Dose history ─────────────────────────────────────────────────── */}
      <div style={{ padding: "0 20px 20px" }}>

        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
            marginBottom: 12,
          }}
        >
          Dose history
        </div>

        {/* Next dose preview */}
        <div
          style={{
            background: "var(--color-bg-raised)",
            border: "1px dashed var(--color-line-2)",
            borderRadius: 14,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              border: "1.5px dashed var(--color-line-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-ink-4)",
            }}
          >
            {weekNumber}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>
              Next injection · {daysLabel}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginTop: 2 }}>
              Suggested: {recommendedSite}
            </div>
          </div>
        </div>

        {/* Historical cards — newest first */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...doses].reverse().map((dose, i) => {
            const week    = doses.length - i;
            const isFirst = i === 0;
            return (
              <div
                key={dose.id}
                style={{
                  background: "var(--color-bg-raised)",
                  border: `1px solid ${isFirst ? "var(--color-accent)" : "var(--color-line)"}`,
                  borderRadius: 14,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                }}
              >
                {/* Week badge */}
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: isFirst ? "var(--color-accent-soft)" : "var(--color-bg-sunk)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 500,
                    color: isFirst ? "var(--color-accent)" : "var(--color-ink-3)",
                  }}
                >
                  {week}
                </div>

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-ink)" }}>
                      {formatDisplayDate(dose.date)}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--color-moss)",
                        fontWeight: 500,
                      }}
                    >
                      {dose.dose_mg} mg
                    </div>
                  </div>

                  {dose.injection_site && (
                    <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 3 }}>
                      {dose.injection_site}
                    </div>
                  )}

                  {dose.notes && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "8px 10px",
                        background: "var(--color-bg-sunk)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--color-ink-2)",
                        lineHeight: 1.5,
                      }}
                    >
                      {dose.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
