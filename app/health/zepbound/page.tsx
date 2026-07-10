export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/health/auth";
import type { Database } from "@/lib/health/types/database";
import { LargeTitle, Group, Cell, Sparkline } from "@/components/ios";
import LogDoseButton from "./_components/LogDoseButton";

type DoseRow = Database["public"]["Tables"]["doses"]["Row"];

const INJECTION_SITES = [
  "Left abdomen", "Right abdomen",
  "Left thigh",   "Right thigh",
  "Left arm",     "Right arm",
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

  const doses = rawDoses ?? [];

  // No doses logged yet — show a real empty state instead of a fabricated
  // mid-treatment history, and avoid dereferencing a non-existent latest dose.
  if (doses.length === 0) {
    return (
      <div className="ios-scroll">
        <LargeTitle
          title="Zepbound"
          subtitle="Zepbound · Tirzepatide"
          trailing={<LogDoseButton recommendedSite={INJECTION_SITES[0]} defaultDoseMg={2.5} weekNumber={1} />}
        />
        <Group header="Get started" footer="Log your first injection to start tracking dose, site rotation, and timing.">
          <Cell chevron={false} title="No doses logged yet" subtitle="Tap Log dose to record your first injection." />
        </Group>
        <div style={{ height: 12 }} />
      </div>
    );
  }

  const latest = doses[doses.length - 1];

  const lastSite        = latest.injection_site ?? "Unknown";
  const recommendedSite = INJECTION_SITES.find((s) => s !== lastSite) ?? "Left abdomen";
  const currentDoseMg   = latest.dose_mg;
  const weekNumber      = doses.length + 1;

  const days      = daysUntil(latest.date);
  const daysLabel = days > 0 ? `${days} day${days === 1 ? "" : "s"}` : days === 0 ? "Today" : "Overdue";
  const isUrgent  = days <= 1;

  const doseSeries = doses.map((d) => d.dose_mg);

  return (
    <div className="ios-scroll">

      <LargeTitle
        title={`Week ${doses.length} · ${currentDoseMg} mg`}
        subtitle="Zepbound · Tirzepatide"
        trailing={
          <LogDoseButton
            recommendedSite={recommendedSite}
            defaultDoseMg={currentDoseMg}
            weekNumber={weekNumber}
          />
        }
      />

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <Group header="Overview">
        <Cell chevron={false} title="Doses logged" subtitle="Total injections" trailing={<span className="ios-num">{doses.length}</span>} />
        <Cell chevron={false} title="Current dose" subtitle="Tirzepatide" trailing={<span className="ios-num">{currentDoseMg} mg</span>} />
        <Cell chevron={false} title="Last site" subtitle="Previous injection" trailing={lastSite} />
        <Cell
          chevron={false}
          title="Next dose"
          subtitle={`Suggested: ${recommendedSite}`}
          trailing={<span className="ios-num" style={{ color: isUrgent ? "var(--ios-red)" : "var(--ios-label-2)" }}>{daysLabel}</span>}
        />
      </Group>

      {/* ── Dose over time ───────────────────────────────────────────────── */}
      {doseSeries.length >= 2 && (
        <Group header="Dose over time" footer="Milligrams per weekly injection.">
          <div className="ios-cell" style={{ justifyContent: "space-between" }}>
            <span className="ios-cell-body">
              <span className="ios-cell-title">Tirzepatide</span>
              <span className="ios-cell-sub">Week 1 → {doses.length}</span>
            </span>
            <Sparkline points={doseSeries} color="var(--ios-tint)" width={120} height={36} />
            <span className="ios-num" style={{ width: 56, textAlign: "right", fontWeight: 600 }}>{currentDoseMg} mg</span>
          </div>
        </Group>
      )}

      {/* ── Upcoming ─────────────────────────────────────────────────────── */}
      <Group header="Upcoming">
        <Cell
          chevron={false}
          title={`Next injection · ${daysLabel}`}
          subtitle={`Suggested: ${recommendedSite}`}
          trailing={<span className="ios-num" style={{ color: "var(--ios-label-2)" }}>Week {weekNumber}</span>}
        />
      </Group>

      {/* ── Dose history — newest first ──────────────────────────────────── */}
      <Group header="Dose history">
        {[...doses].reverse().map((dose, i) => {
          const week = doses.length - i;
          return (
            <Cell
              key={dose.id}
              chevron={false}
              lead={
                <span className="ios-num" style={{ width: 29, height: 29, borderRadius: 7, background: "var(--ios-fill)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600 }}>
                  {week}
                </span>
              }
              title={formatDisplayDate(dose.date)}
              subtitle={[dose.injection_site, dose.notes].filter(Boolean).join(" · ") || undefined}
              trailing={<span className="ios-num" style={{ color: "var(--ios-green)" }}>{dose.dose_mg} mg</span>}
            />
          );
        })}
      </Group>

      <div style={{ height: 12 }} />
    </div>
  );
}
