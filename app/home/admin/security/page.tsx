import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/auth-utils";
import { securitySnapshot } from "@/lib/security/server";
import { RECIPIENT, REPOSITORY } from "@/lib/security/model";
import PullQueue from "./PullQueue";
import AutopilotControls from "./AutopilotControls";
import {reviewHref} from "@/lib/security/pulls";
import FixNow from "./FixNow";
import SecurityControls from "./SecurityControls";
import styles from "./security.module.css";
export const dynamic = "force-dynamic";
const github = `https://github.com/${REPOSITORY}`;
const date = (v: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Indiana/Indianapolis" }).format(new Date(v));
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ severity?: string; state?: string; source?: string; page?: string }> }) {
  try { await requireAdmin(); } catch { redirect("/home"); }
  const filters = await searchParams;
  let snapshot;
  try { snapshot = await securitySnapshot(); } catch {
    return <main className={styles.main}><Link href="/home/admin">← Admin</Link><h1>Security tracker unavailable</h1><p role="alert">The security database could not be reached. This does not mean the platform is free of vulnerabilities.</p><a className={styles.actionLink} href={`${github}/actions/workflows/security-review.yml`}>Check GitHub reviews</a></main>;
  }
  const { runs, findings, mail, stale, config, requests } = snapshot;
  const open = findings.filter(f => !f.resolved_at);
  const latest = runs[0];
  const activeRequests = requests.filter(r => r.status === "queued" || r.status === "running");
  const scanRequests = requests.filter(r => r.kind !== "repair");
  const repairs = new Map<string, NonNullable<typeof latest>["repairs"][number]>();
  for (const run of runs) for (const repair of run.repairs ?? []) if (!repairs.has(repair.key)) repairs.set(repair.key, repair);
  const matches = findings.filter(f => (filters.state === "resolved" ? !!f.resolved_at : !f.resolved_at) && (!filters.severity || f.severity === filters.severity) && (!filters.source || f.source === filters.source));
  const ranks = { critical: 0, high: 1, medium: 2, low: 3 };
  matches.sort((a,b) => ranks[a.severity] - ranks[b.severity]);
  const pages = Math.max(1, Math.ceil(matches.length / 20));
  const page = Math.min(pages, Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1));
  const shown = matches.slice((page - 1) * 20, page * 20);
  const pageHref = (next: number) => {
    const params = new URLSearchParams();
    for (const key of ["state", "severity", "source"] as const) if (filters[key]) params.set(key, filters[key]);
    params.set("page", String(next));
    return `?${params}#vulnerabilities`;
  };
  return <main className={styles.main}>
    <Link className={styles.back} href="/home/admin">← Admin</Link>
    <header className={styles.header}><div><p className={styles.eyebrow}>MORRIS AI · SECURITY</p><h1>Security, handled.</h1><p>One action. The agent prioritizes findings, attempts fixes, and asks for your judgment when the change needs it.</p></div></header>
    <section className={`${styles.panel} ${styles.protectionPanel}`} aria-labelledby="protection-title"><div className={styles.sectionHeader}><div><span className={`${styles.badge} ${config.automation_enabled ? styles.goodBadge : ""}`}>{config.automation_enabled ? "Risk-based automation on" : "Automatic repairs paused"}</span><h2 id="protection-title">{activeRequests.length ? "The agent is working" : stale ? "Protection needs attention" : "Your security agent is ready"}</h2><p>{open.length} open findings · {open.filter(f=>f.severity==='critical'||f.severity==='high').length} high / critical · {latest ? `Last checked ${date(latest.received_at)} Eastern` : "First review pending"}</p><p className={styles.muted}>Low-risk fixes apply after validation. Sensitive changes and unsuccessful repairs stay visible for review. Findings close after a confirming scan.</p></div></div><AutopilotControls enabled={config.automation_enabled === true} pending={activeRequests.length>0}/></section>
    <PullQueue findings={findings}/>
    {(stale||!!latest?.errors.length||!!latest?.repairs?.some(r=>r.status==='blocked'||r.status==='validation_failed'))&&<section className={styles.panel}><h2>Agent needs help</h2>{stale&&<p className={styles.issue}>A review is overdue or stalled. Protect now requests a fresh attempt.</p>}{latest?.errors.map((e,i)=><p className={styles.issue} key={i}>{e}</p>)}{latest?.repairs?.filter(r=>r.status==='blocked'||r.status==='validation_failed').sort((a,b)=>ranks[findings.find(f=>f.key===a.key)?.severity??'medium']-ranks[findings.find(f=>f.key===b.key)?.severity??'medium']).slice(0,5).map(r=><article className={styles.activityRow} key={r.key}><div><strong>{findings.find(f=>f.key===r.key)?.title??r.key}</strong><p>{r.message}</p></div>{r.url&&<Link className={styles.actionLink} href={reviewHref(r.url)}>Review fix →</Link>}</article>)}</section>}
    <details className={styles.panel} open={!!(filters.state||filters.severity||filters.source||filters.page)}><summary className={styles.summary}>All findings <span className={styles.count}>{open.length} open</span></summary>
    <section id="vulnerabilities" className={styles.panel} aria-labelledby="findings-title">
      <div className={styles.heading}><h2 id="findings-title">Vulnerabilities</h2><span>{matches.length} findings{filters.state === "resolved" ? " · latest 200" : ""}</span></div>
      <p className={styles.muted}>Highest severity first. Expand a finding for details, or use its action to request a repair.</p>
      <form className={styles.filters} method="get"><label>Status<select name="state" defaultValue={filters.state ?? "open"}><option value="open">Open</option><option value="resolved">Resolved</option></select></label><label>Severity<select name="severity" defaultValue={filters.severity ?? ""}><option value="">All severities</option>{["critical","high","medium","low"].map(s => <option key={s} value={s}>{s}</option>)}</select></label><label>Source<select name="source" defaultValue={filters.source ?? ""}><option value="">All sources</option><option value="codeql">CodeQL</option><option value="dependencies">Dependencies</option></select></label><button className={styles.button} type="submit">Apply filters</button><Link className={styles.actionLink} href="/home/admin/security">Clear</Link></form>
      {!shown.length && <p className={styles.empty}>{latest ? "No findings match these filters. Check review coverage above." : "Findings will appear after the first completed review."}</p>}
      {shown.length > 0 && <div className={styles.tableFrame}>
        <table className={styles.findingsTable}>
          <caption className={styles.srOnly}>Vulnerabilities sorted by severity. Expand a finding for remediation and advisory details.</caption>
          <thead><tr><th scope="col">Severity / source</th><th scope="col">Finding and remediation</th><th scope="col">Next action</th></tr></thead>
          <tbody>{shown.map(f => {
            const repair = repairs.get(f.key);
            const pending = activeRequests.some(r => r.kind === "repair" && (!r.target_key || r.target_key === f.key));
            return <tr key={f.key}>
              <td><span className={`${styles.severityBadge} ${styles[f.severity]}`}>{f.severity}</span><span className={styles.cellMeta}>{f.source === "codeql" ? "CodeQL" : "Dependencies"}</span></td>
              <td><h3 className={styles.findingTitle}>{f.title}</h3><code className={styles.location}>{f.location}</code>
                <p className={styles.repairState}>{f.resolved_at ? "Resolved" : pending ? "Repair queued / running" : repair ? repair.status.replaceAll("_", " ") : "Open · needs review"}</p>
                <details className={styles.findingDetails}><summary>Details and remediation</summary><p>{f.remediation}</p>{repair && <p><strong>Last repair:</strong> {repair.message}</p>}<p className={styles.muted}>{f.resolved_at ? `Resolved ${date(f.resolved_at)}` : `First seen ${date(f.first_seen)}`} Eastern</p><a className={styles.actionLink} href={f.url || `${github}/security`}>View advisory / code review ↗</a></details>
              </td>
              <td className={styles.rowActions}>{repair?.url && <Link className={styles.actionLink} href={reviewHref(repair.url)}>Review fix →</Link>}{!f.resolved_at && <details className={styles.findingDetails}><summary>More actions</summary><FixNow finding={f.key} pending={pending} /></details>}{f.resolved_at && <span className={`${styles.badge} ${styles.goodBadge}`}>Resolved</span>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
      {pages > 1 && <nav className={styles.pagination} aria-label="Vulnerability pages"><span className={styles.muted}>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, matches.length)} of {matches.length} · Page {page} of {pages}</span><div>{page > 1 && <Link className={styles.button} href={pageHref(page - 1)}>← Previous</Link>}{page < pages && <Link className={styles.button} href={pageHref(page + 1)}>Next →</Link>}</div></nav>}
    </section>
    </details>
    <details className={styles.panel}><summary className={styles.summary}>Schedule and automation policy</summary><p>Protection attempts repairs on scheduled reviews and pushes to main. Low-risk compatible lockfile changes and small stateless presentation fixes can merge after fresh validation. Changes to authentication, permissions, financial or health logic, data, workflows, infrastructure, dependency structure, and major upgrades need human review.</p><p className={styles.muted}>Automation never bypasses repository rules. Failed validation stops automatic retries for that version. Medium, high, critical findings and automation failures are emailed to {RECIPIENT}.</p><SecurityControls config={config} pending={activeRequests.length>0}/><details className={styles.activityGroup}><summary>Technical links</summary><a className={styles.actionLink} href={`${github}/actions/workflows/security-review.yml`}>GitHub security workflow ↗</a></details></details>
    <details className={styles.panel}><summary className={styles.summary}>Activity and notifications</summary><p className={styles.muted}>Expand a log to see delivery, scan requests, or completed reviews.</p>
      <details className={styles.activityGroup}><summary>Email alerts <span className={styles.count}>{mail.length}</span></summary><p>Sent to <strong>{RECIPIENT}</strong> for medium, high, or critical findings and review or fix failures. Open issues receive daily reminders. Pending PRs stay open findings until merged and rescanned.</p><p className={styles.muted}>Provider acceptance is recorded below; inbox delivery depends on the email provider.</p>{!mail.length && <p>No security emails queued yet.</p>}{mail.map(m => <article className={styles.activityRow} key={m.id}><div><strong>{m.subject}</strong><p>{m.sent_at ? `Accepted by email provider ${date(m.sent_at)}` : `Pending · ${m.attempts} attempts`}</p>{m.last_error && <p role="alert" className={styles.issue}>{m.last_error}</p>}</div></article>)}</details>
      <details className={styles.activityGroup}><summary>Requested scans <span className={styles.count}>{scanRequests.length}</span></summary>{!scanRequests.length && <p>No ad hoc scans requested yet.</p>}{scanRequests.map(r => <article className={styles.activityRow} key={r.id}><div><strong>{r.status === "failed" ? "Completed with issues / failed" : r.status}</strong><p>Requested {date(r.requested_at)} Eastern</p></div>{r.claimed_run && <a className={styles.actionLink} href={`${github}/actions/runs/${r.claimed_run}`}>Open run ↗</a>}</article>)}</details>
      <details className={styles.activityGroup}><summary>Review history <span className={styles.count}>{runs.length}</span></summary>{!runs.length && <p>No reviews received yet.</p>}{runs.map(r => <article className={styles.activityRow} key={r.run_id}><div><strong>{date(r.received_at)} Eastern</strong><p>{r.completed.join(" + ") || "Incomplete"} · {r.errors.length} issues · <code>{r.sha.slice(0,12)}</code></p></div><a className={styles.actionLink} href={`${github}/actions/runs/${r.run_id}`}>Run {r.run_id} · attempt {r.attempt} ↗</a></article>)}</details>
    </details>
  </main>;
}
