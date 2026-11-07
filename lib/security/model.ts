export const REPOSITORY = "tmorr16-coder/morris-hub";
export const AUDIENCE = "https://morrisai.family/api/security/reports";
export const RECIPIENT = "tmorr16@gmail.com";
export type Source = "dependencies" | "codeql";
export type Severity = "critical" | "high" | "medium" | "low";
export type Finding = { key: string; source: Source; title: string; severity: Severity; location: string; url: string; remediation: string };
export type Repair = { key: string; status: "blocked" | "deferred" | "generating" | "existing_pr" | "pr_created" | "validated_pr" | "validation_failed"; message: string; url: string };
export type Report = { runId: string; attempt: number; sha: string; completed: Source[]; findings: Finding[]; errors: string[]; fixUrl: string | null; repairs: Repair[] };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
function string(v: unknown, max: number): string { if (typeof v !== "string" || !v.length || v.length > max) throw Error("Invalid report field"); return v; }
export function safeGithubUrl(value: unknown): string {
  if (!value) return "";
  const url = new URL(string(value, 1000));
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password || url.port) throw Error("Invalid GitHub URL");
  if (!url.pathname.startsWith(`/${REPOSITORY}/`) && !url.pathname.startsWith("/advisories/")) throw Error("Untrusted GitHub URL");
  return url.href;
}
export function parseReport(value: unknown): Report {
  if (!record(value) || !/^\d{1,20}$/.test(String(value.runId)) || !Number.isInteger(value.attempt) || Number(value.attempt) < 1 || Number(value.attempt) > 1000 || !/^[a-f0-9]{40}$/.test(String(value.sha))) throw Error("Invalid run");
  if (!Array.isArray(value.completed) || value.completed.some(s => s !== "dependencies" && s !== "codeql") || !Array.isArray(value.findings) || value.findings.length > 2000 || !Array.isArray(value.errors) || value.errors.length > 50) throw Error("Invalid coverage");
  const keys = new Set<string>();
  const findings = value.findings.map((f: unknown): Finding => {
    if (!record(f) || !["dependencies", "codeql"].includes(String(f.source)) || !["critical", "high", "medium", "low"].includes(String(f.severity))) throw Error("Invalid finding");
    const key = string(f.key, 250);
    if (!key.startsWith(`${f.source}:`) || keys.has(key)) throw Error("Duplicate or invalid finding key"); keys.add(key);
    return { key, source: f.source as Source, severity: f.severity as Severity, title: string(f.title, 500), location: string(f.location, 500), url: safeGithubUrl(f.url), remediation: string(f.remediation, 1000) };
  });
  if (value.repairs !== undefined && (!Array.isArray(value.repairs) || value.repairs.length > 200)) throw Error("Invalid repair results");
  const repairs = ((value.repairs ?? []) as unknown[]).map((r): Repair => {
    if (!record(r) || !["blocked","deferred","generating","existing_pr","pr_created","validated_pr","validation_failed"].includes(String(r.status))) throw Error("Invalid repair status");
    return { key: string(r.key,250), status: r.status as Repair["status"], message: string(r.message,1000), url: safeGithubUrl(r.url) };
  });
  return { repairs, runId: String(value.runId), attempt: Number(value.attempt), sha: String(value.sha), completed: [...new Set(value.completed)] as Source[], findings, errors: value.errors.map(e => string(e, 1000)), fixUrl: value.fixUrl ? safeGithubUrl(value.fixUrl) : null };
}
export function trustedClaims(p: Record<string, unknown>): boolean {
  return p.repository === REPOSITORY && p.repository_id === "1247836919" && p.ref === "refs/heads/main" && p.workflow_ref === `${REPOSITORY}/.github/workflows/security-review.yml@refs/heads/main` && ["schedule", "push", "workflow_dispatch"].includes(String(p.event_name));
}
export function cronAuthorized(header: string | null, secret: string | undefined): boolean { return !!secret && header === `Bearer ${secret}`; }
