import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MEASTYPES: Record<number, { metric_name: string; unit: string; toStored: (v: number) => number }> = {
  1:  { metric_name: "weight",                    unit: "lbs", toStored: (v) => v * 2.20462 },
  6:  { metric_name: "body_fat_percent",           unit: "%",   toStored: (v) => v },
  8:  { metric_name: "fat_mass",                   unit: "lbs", toStored: (v) => v * 2.20462 },
  9:  { metric_name: "blood_pressure_diastolic",   unit: "mmHg", toStored: (v) => v },
  10: { metric_name: "blood_pressure_systolic",    unit: "mmHg", toStored: (v) => v },
  11: { metric_name: "heart_rate",                 unit: "bpm", toStored: (v) => v },
  54: { metric_name: "spo2",                       unit: "%",   toStored: (v) => v },
  76: { metric_name: "muscle_mass",                unit: "lbs", toStored: (v) => v * 2.20462 },
  88: { metric_name: "bone_mass",                  unit: "lbs", toStored: (v) => v * 2.20462 },
};

const MEASTYPES_PARAM = Object.keys(MEASTYPES).join(",");

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface TokenRow {
  user_id:       string;
  access_token:  string;
  refresh_token: string;
  expires_at:    string;
  scope:         string | null;
}

interface WithingsTokenResponse {
  status: number;
  body?: {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
    scope:         string;
  };
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getValidToken(db: any, row: TokenRow): Promise<{ accessToken: string } | { error: string }> {
  if (new Date(row.expires_at).getTime() - Date.now() > 5 * 60_000) {
    return { accessToken: row.access_token };
  }

  console.log(`[withings/sync] Refreshing token for user ${row.user_id}`);
  let refreshData: WithingsTokenResponse;
  try {
    const res = await fetch("https://wbsapi.withings.net/v2/oauth2", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action:        "requesttoken",
        grant_type:    "refresh_token",
        client_id:     process.env.WITHINGS_CLIENT_ID!,
        client_secret: process.env.WITHINGS_CLIENT_SECRET!,
        refresh_token: row.refresh_token,
      }),
    });
    refreshData = (await res.json()) as WithingsTokenResponse;
  } catch (err) {
    return { error: `Refresh fetch failed: ${err}` };
  }

  if (refreshData.status !== 0 || !refreshData.body) {
    return { error: `Token refresh failed: status ${refreshData.status}` };
  }

  const { access_token, refresh_token, expires_in, scope } = refreshData.body;
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  await db.from("withings_tokens").update({
    access_token, refresh_token, expires_at, scope,
    updated_at: new Date().toISOString(),
  }).eq("user_id", row.user_id);

  return { accessToken: access_token };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncOneUser(db: any, tokenRow: TokenRow): Promise<{ inserted: number; error?: string }> {
  const tokenResult = await getValidToken(db, tokenRow);
  if ("error" in tokenResult) return { inserted: 0, error: tokenResult.error };

  let measData: {
    status: number;
    body?: { measuregrps: Array<{ date: number; measures: Array<{ value: number; type: number; unit: number }> }> };
  };

  try {
    const url = new URL("https://wbsapi.withings.net/measure");
    url.searchParams.set("action", "getmeas");
    url.searchParams.set("meastypes", MEASTYPES_PARAM);
    url.searchParams.set("category", "1");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });
    measData = await res.json();
  } catch (err) {
    return { inserted: 0, error: `Measure fetch failed: ${err}` };
  }

  if (measData.status !== 0 || !measData.body) {
    return { inserted: 0, error: `Withings API error: status ${measData.status}` };
  }

  const rows: { user_id: string; timestamp: string; metric_name: string; value: number; unit: string; source: string }[] = [];
  for (const grp of measData.body.measuregrps) {
    const timestamp = new Date(grp.date * 1000).toISOString();
    for (const m of grp.measures) {
      const mapping = MEASTYPES[m.type];
      if (!mapping) continue;
      const rawValue = m.value * Math.pow(10, m.unit);
      rows.push({
        user_id:     tokenRow.user_id,
        timestamp,
        metric_name: mapping.metric_name,
        value:       parseFloat(mapping.toStored(rawValue).toFixed(4)),
        unit:        mapping.unit,
        source:      "withings",
      });
    }
  }

  if (rows.length === 0) return { inserted: 0 };

  let inserted = 0;
  for (const batch of chunk(rows, 500)) {
    const { data, error } = await db
      .from("apple_health_metrics")
      .upsert(batch, { onConflict: "user_id,timestamp,metric_name,source", ignoreDuplicates: true })
      .select("id");
    if (error) console.error(`[withings/sync] Upsert error for ${tokenRow.user_id}:`, error.message);
    else inserted += (data as unknown[]).length;
  }

  return { inserted };
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // Optional userId param: sync just one user (manual "Sync now" button).
  // Without it, sync all connected users (cron job).
  const { searchParams } = new URL(request.url);
  const specificUserId = searchParams.get("userId");

  const query = db
    .from("withings_tokens")
    .select("user_id, access_token, refresh_token, expires_at, scope");
  if (specificUserId) query.eq("user_id", specificUserId);

  const { data: tokenRows, error: tokenErr } = await query;
  if (tokenErr) {
    return NextResponse.json({ error: tokenErr.message }, { status: 500 });
  }
  if (!tokenRows?.length) {
    return NextResponse.json({ measurements_inserted: 0, users_synced: 0 });
  }

  let totalInserted = 0;
  for (const row of tokenRows as TokenRow[]) {
    const { inserted, error } = await syncOneUser(db, row);
    if (error) console.error(`[withings/sync] User ${row.user_id}:`, error);
    else totalInserted += inserted;
  }

  const result = { measurements_inserted: totalInserted, users_synced: (tokenRows as TokenRow[]).length };
  console.log("[withings/sync] Complete:", result);
  return NextResponse.json(result);
}
