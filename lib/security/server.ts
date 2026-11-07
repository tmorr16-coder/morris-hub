import "server-only";
import { createHash } from "node:crypto";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { RECIPIENT, REPOSITORY, type Finding } from "./model";
// Custom schema tables are intentionally absent from the generated client types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const securityDb = () => (createServiceClient() as any).schema("hub");
export type StoredFinding = Finding & { first_seen: string; last_seen: string; resolved_at: string | null };
export type Run = { run_id: string; attempt: number; sha: string; completed: string[]; errors: string[]; fix_url: string | null; received_at: string };
export async function securitySnapshot() {
  const db = securityDb();
  async function openFindings(): Promise<StoredFinding[]> {
    const rows: StoredFinding[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await db.from("security_findings").select("*").is("resolved_at", null).order("key").range(offset, offset + 999);
      if (result.error) throw Error("Security findings unavailable");
      rows.push(...result.data);
      if (result.data.length < 1000) return rows;
    }
  }
  const [runs, open, history, mail] = await Promise.all([
    db.from("security_runs").select("*").order("run_id", { ascending: false }).limit(20),
    openFindings(),
    db.from("security_findings").select("*").not("resolved_at", "is", null).order("resolved_at", { ascending: false }).limit(200),
    db.from("security_mail").select("id,subject,created_at,sent_at,last_error,attempts").order("created_at", { ascending: false }).limit(10),
  ]);
  for (const r of [runs, history, mail]) if (r.error) throw Error("Security tracker database unavailable");
  return { stale: !runs.data?.[0] || Date.now() - Date.parse(runs.data[0].received_at) > 36 * 3600_000, runs: runs.data as Run[], findings: [...open, ...history.data] as StoredFinding[], mail: mail.data as { id: string; subject: string; created_at: string; sent_at: string | null; last_error: string | null; attempts: number }[] };
}
export async function sendSecurityAlerts() {
  const { runs, findings } = await securitySnapshot();
  const run = runs[0];
  const stale = !run || Date.now() - Date.parse(run.received_at) > 36 * 3600_000;
  const open = findings.filter(f => !f.resolved_at && f.severity !== "low").sort((a,b) => a.key.localeCompare(b.key));
  const issues = [...(run?.errors ?? []), ...(stale ? ["No security review has reported successfully in the past 36 hours. Check GitHub Actions and report delivery."] : [])];
  const db = securityDb();
  if (open.length || issues.length) {
    const subject = `Morris security: ${open.length} medium+ vulnerabilities${issues.length ? `, ${issues.length} review issues` : ""}`;
    const body = ["Morris Hub security review", "", ...issues.map(e => `Review issue: ${e}`), "", ...open.slice(0,100).map(f => `${f.severity.toUpperCase()}: ${f.title}\n${f.location}\n${f.remediation}\n${f.url}`), "", ...(open.length > 100 ? ["Showing the first 100 findings. Open the tracker for the full list."] : []), ...(run?.fix_url ? [`Dependency remediation PR: ${run.fix_url}`, "Findings remain open until a new scan confirms the merged fix."] : []), "Tracker: https://morrisai.family/home/admin/security", `GitHub: https://github.com/${REPOSITORY}/actions/workflows/security-review.yml`].join("\n");
    const fingerprint = createHash("sha256").update(JSON.stringify({ day: new Date().toISOString().slice(0,10), open: open.map(f => [f.key, f.severity, f.remediation]), issues, fix: run?.fix_url ?? null })).digest("hex");
    const { error } = await db.from("security_mail").upsert({ id: fingerprint, subject, body }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw Error("Could not queue security notification");
  }
  const { data: pending, error } = await db.rpc("claim_security_mail");
  if (error) throw Error("Could not claim security notification queue");
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  let failures = 0;
  for (const message of pending ?? []) {
    try {
      if (!resend || !process.env.RESEND_FROM_EMAIL) throw Error("Security email requires RESEND_API_KEY and RESEND_FROM_EMAIL");
      const { data, error: sendError } = await resend.emails.send({ from: process.env.RESEND_FROM_EMAIL, to: RECIPIENT, subject: message.subject, text: message.body }, { idempotencyKey: `security/${message.id}` });
      if (sendError || !data?.id) throw Error(sendError?.message ?? "Email provider did not accept message");
      const saved = await db.from("security_mail").update({ sent_at: new Date().toISOString(), provider_id: data.id, last_error: null }).eq("id", message.id);
      if (saved.error) throw Error("Email accepted, but delivery record could not be saved");
    } catch (e) {
      failures++;
      await db.from("security_mail").update({ last_error: e instanceof Error ? e.message.slice(0,500) : "Email delivery failed" }).eq("id", message.id);
    }
  }
  if (failures) throw Error(`${failures} security notifications pending; check tracker delivery status`);
}
