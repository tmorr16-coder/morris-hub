import { verifySecurityWorkflow } from "@/lib/security/auth";
import { securityDb } from "@/lib/security/server";
import { nextReview, localReviewDate, type ReviewConfig } from "@/lib/security/schedule";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let claims;
  try { claims = await verifySecurityWorkflow(request); } catch { return Response.json({ error: "Unauthorized workflow" }, { status: 401 }); }
  try {
    const db = securityDb();
    const { data, error } = await db.from("security_config").select("*").eq("id", true).single();
    if (error || !data) throw Error("Schedule unavailable");
    const config = data as ReviewConfig;
    const following_due = config.enabled && config.next_due && Date.parse(config.next_due) <= Date.now() ? nextReview(config, Date.now(), localReviewDate(config.next_due)) : config.next_due;
    const result = await db.rpc("claim_security_scan", { rid: claims.run_id, event: claims.event_name, expected_version: config.version, following_due, head_sha: claims.sha });
    if (result.error) throw Error("Queue claim failed");
    const commands = await db.rpc("claim_security_pr_commands", { rid: claims.run_id });
    if (commands.error) throw Error("PR commands unavailable");
    const cached = await db.from("security_pulls").select("synced_at").order("synced_at", { ascending: false }).limit(1);
    if(cached.error) throw Error("PR sync status unavailable");
    const sync_pulls = result.data === true || (commands.data ?? []).length > 0 || !cached.data?.[0] || Date.now() - Date.parse(cached.data[0].synced_at) > 10 * 60_000;
    const pull_numbers = (commands.data ?? []).filter((c:{kind:string;pr_number:number|null})=>c.kind === "refresh" && c.pr_number).map((c:{pr_number:number})=>c.pr_number);
    const merges = (commands.data ?? []).filter((c: {kind: string}) => c.kind === "merge");
    if (result.data !== true) return Response.json({ should_run: false, repair: false, targets: [], merges, sync_pulls, pull_numbers, automate: config.automation_enabled === true });
    const requests = await db.from("security_requests").select("kind,target_key").eq("claimed_run", claims.run_id).eq("kind", "repair");
    if (requests.error) throw Error("Repair request unavailable");
    let targets = [];
    const repair = config.automation_enabled === true || !!requests.data?.length;
    if (repair) {
      let query = db.from("security_findings").select("key,source,title,severity,location").is("resolved_at", null);
      if (config.automation_enabled !== true && requests.data.length && requests.data.every((r: { target_key: string | null }) => r.target_key)) query = query.in("key", requests.data.map((r: { target_key: string }) => r.target_key));
      const findings = await query.limit(200);
      if (findings.error) throw Error("Repair targets unavailable");
      targets = findings.data;
    }
    return Response.json({ should_run: true, repair, targets, merges, sync_pulls, pull_numbers, automate: config.automation_enabled === true });
  } catch { return Response.json({ error: "Security queue unavailable" }, { status: 503 }); }
}
