/* Self-serve data export ("download all my data"). Returns a JSON file of the
   authenticated user's own records across modules. Uses the service-role client
   but every query is strictly scoped to the caller's user_id / profile_id.
   Sensitive credentials (encrypted bank access tokens) are never included. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/supabase/auth-utils";
import { createServiceClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Tables scoped directly by a user_id column. Selected with "*" — this is the
// user's own data being returned to them.
const USER_ID_TABLES: [string, string][] = [
  ["hub", "preferences"], ["hub", "reminders"], ["hub", "todos"], ["hub", "shopping_items"],
  ["hub", "journal_entries"], ["hub", "household_goals"], ["hub", "meal_plan"], ["hub", "investment_ideas"],
  ["hub", "family_members"], ["hub", "child_activities"], ["hub", "child_health_notes"],
  ["finance", "manual_accounts"], ["finance", "net_position_snapshots"], ["finance", "manual_account_shares"],
  ["career", "career_profile"], ["career", "career_goals"], ["career", "career_experiences"],
  ["career", "career_learning"], ["career", "career_relationships"], ["career", "career_milestones"],
  ["career", "career_advisor_messages"],
  ["bible", "notes"], ["bible", "highlights"], ["bible", "bookmarks"], ["bible", "user_plans"],
  ["bible", "reading_completions"], ["bible", "user_preferences"],
  ["student_support", "courses"], ["student_support", "student_settings"],
  ["student_support", "lsat_attempts"], ["student_support", "lsat_practice_sessions"], ["student_support", "lsat_review_notes"],
];

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const svc = createServiceClient() as any;
  const out: Record<string, unknown> = {
    export_type: "morrisai.family personal data export",
    exported_at: new Date().toISOString(),
    user_id: userId,
    note: "Your own records. Encrypted bank access tokens are intentionally excluded.",
  };

  // Directly user-scoped tables (defensive: skip any that don't exist / error).
  for (const [schema, table] of USER_ID_TABLES) {
    try {
      const { data, error } = await svc.schema(schema).from(table).select("*").eq("user_id", userId);
      if (!error && data && data.length) out[`${schema}.${table}`] = data;
    } catch { /* table may not exist in this project */ }
  }

  // Finance: linked banks WITHOUT the encrypted access token, plus their accounts
  // and transactions (scoped through the user's own item ids → account ids).
  try {
    const { data: items } = await svc.schema("finance").from("plaid_items")
      .select("id, institution_name, institution_id, status, last_synced_at, created_at")
      .eq("user_id", userId);
    if (items && items.length) {
      out["finance.linked_banks"] = items;
      const itemIds = items.map((i: any) => i.id);
      const { data: accts } = await svc.schema("finance").from("accounts").select("*").in("item_id", itemIds);
      if (accts && accts.length) {
        out["finance.accounts"] = accts;
        const acctIds = accts.map((a: any) => a.id);
        const { data: txns } = await svc.schema("finance").from("transactions").select("*").in("account_id", acctIds).limit(10000);
        if (txns && txns.length) out["finance.transactions"] = txns;
      }
    }
  } catch { /* finance tables unavailable */ }

  // Retirement plan: profile + children scoped by profile_id.
  try {
    const { data: prof } = await svc.schema("finance").from("retirement_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (prof) {
      out["finance.retirement_profile"] = prof;
      for (const t of ["retirement_accounts", "retirement_incomes", "retirement_expenses", "retirement_debts", "retirement_scenarios"]) {
        const { data } = await svc.schema("finance").from(t).select("*").eq("profile_id", prof.id);
        if (data && data.length) out[`finance.${t}`] = data;
      }
    }
  } catch { /* retirement tables unavailable */ }

  // Health metrics (public schema via admin client).
  try {
    const admin = createAdminClient() as any;
    const { data } = await admin.from("apple_health_metrics").select("*").eq("user_id", userId).limit(20000);
    if (data && data.length) out["health.apple_health_metrics"] = data;
  } catch { /* health data may live elsewhere */ }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="morrisai-data-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
