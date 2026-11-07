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
    return Response.json({ should_run: result.data === true });
  } catch { return Response.json({ error: "Security queue unavailable" }, { status: 503 }); }
}
