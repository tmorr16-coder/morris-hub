#!/usr/bin/env node
/*
 * Guard: the service-role Supabase client bypasses RLS, so every finance query
 * MUST be scoped to the caller's user_id / profile_id (or ids derived from them).
 * This scans server code for finance-schema reads/writes that appear to be missing
 * such a scope and prints them for review. Exit code 1 if any are found.
 *
 * Heuristic, not a proof — it can false-positive (scope applied via a variable it
 * can't see). Treat hits as "review this", not "definitely a bug".
 *
 *   node scripts/check-finance-scoping.mjs
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOTS = ["app", "lib"];
// Per-user finance tables — accessing these unscoped via service role leaks data.
const SENSITIVE = /\.from\(\s*["'`](accounts|transactions|plaid_items|manual_accounts|manual_account_shares|account_shares|net_position_snapshots|retirement_profiles|retirement_accounts|retirement_incomes|retirement_expenses|retirement_debts|retirement_scenarios)["'`]\s*\)/g;
// A scope anywhere in the query chain makes it safe enough. Three forms:
//   1. a filter:   .eq("user_id", …) / .in("account_id", …)
//   2. an insert/upsert payload key:   { user_id: … } / profile_id: profileId
//   3. an upsert conflict target on a user key:   onConflict: "user_id,date"
const KEYS = "user_id|profile_id|item_id|account_id|owner_user_id|grantee_user_id|recipient_user_id|member_user_id";
const SCOPE = new RegExp(
  `\\.(eq|in)\\(\\s*["'\`](id|${KEYS})["'\`]` +          // filter
  `|(^|[\\s{(])(${KEYS})\\s*:` +                          // object key (payload)
  `|onConflict[^)]*(${KEYS})`,                            // upsert conflict target
  "m"
);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const findings = [];
for (const root of ROOTS) {
  let files = [];
  try { files = walk(root); } catch { continue; }
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    // Only files that use the RLS-bypassing clients are in scope.
    if (!/createServiceClient|createAdminClient/.test(src)) continue;
    for (const m of src.matchAll(SENSITIVE)) {
      const start = m.index;
      // Query chain = from the .from(...) to the statement terminator, plus a bit
      // before it to catch a leading `// scoping-ok:` suppression comment.
      const semi = src.indexOf(";", start);
      const window = src.slice(Math.max(0, start - 220), semi === -1 ? start + 600 : Math.min(semi + 1, start + 600));
      if (/scoping-ok/.test(window)) continue; // reviewed & intentionally unscoped
      if (!SCOPE.test(window)) {
        const line = src.slice(0, start).split("\n").length;
        findings.push({ file, line, table: m[1] });
      }
    }
  }
}

if (findings.length === 0) {
  console.log("✓ finance service-role scoping: no unscoped queries found.");
  process.exit(0);
}

console.error(`✗ ${findings.length} finance query(ies) may be missing a user_id/profile_id scope:\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  — .from("${f.table}") with no visible user scope in the chain`);
}
console.error("\nAdd a .eq(\"user_id\", …) / .eq(\"profile_id\", …) (or an .in(...) of ids you derived from the user), or confirm the scope is applied and update this check's allowlist.");
process.exit(1);
