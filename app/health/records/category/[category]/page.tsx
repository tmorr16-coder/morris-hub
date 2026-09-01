export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/health/auth";
import { LargeTitle, Group } from "@/components/ios";
import {
  BIOMARKER_BY_KEY,
  CATEGORY_LABELS,
  type BiomarkerCategory,
} from "@/lib/health/biomarkers";
import { ResultRow, type LabResultRow } from "../../_components/ResultRow";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Every marker in one category, showing the most recent value for each.
 * The point of the category view is comparability — one screen for "how is
 * my liver doing" rather than hunting through a report's page order.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;
  const userId = await getCurrentUserId();
  const { category } = await params;

  const label = CATEGORY_LABELS[category as BiomarkerCategory];
  if (!label) notFound();

  const keys = Object.values(BIOMARKER_BY_KEY)
    .filter((b) => b.category === category)
    .map((b) => b.key);

  const { data: rows } = await db
    .from("health_lab_results")
    .select(
      "id, biomarker_key, name, panel, collected_on, value, value_text, unit, ref_low, ref_high, ref_text, flag, note"
    )
    .eq("user_id", userId)
    .in("biomarker_key", keys)
    .order("collected_on", { ascending: false })
    .limit(1000);

  const all: LabResultRow[] = rows ?? [];
  if (all.length === 0) notFound();

  // Rows arrive newest-first, so the first hit per marker is the latest.
  const latestByMarker = new Map<string, LabResultRow>();
  for (const r of all) {
    if (r.biomarker_key && !latestByMarker.has(r.biomarker_key)) {
      latestByMarker.set(r.biomarker_key, r);
    }
  }

  const latest = [...latestByMarker.values()].sort((a, b) =>
    (BIOMARKER_BY_KEY[a.biomarker_key!]?.name ?? a.name).localeCompare(
      BIOMARKER_BY_KEY[b.biomarker_key!]?.name ?? b.name
    )
  );

  const mostRecentDate = all[0]?.collected_on;

  return (
    <div className="ios-scroll">
      <LargeTitle
        title={label}
        subtitle={mostRecentDate ? `Most recent values · ${fmtDate(mostRecentDate)}` : undefined}
      />

      <Group
        header={`${latest.length} marker${latest.length === 1 ? "" : "s"}`}
        footer="Tap a marker for its full history."
      >
        {latest.map((r) => (
          <ResultRow key={r.id} result={r} />
        ))}
      </Group>

      <div style={{ padding: "18px 16px 0" }}>
        <Link href="/health/records" style={{ color: "var(--ios-tint)", fontSize: 15, textDecoration: "none" }}>
          ← All records
        </Link>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
