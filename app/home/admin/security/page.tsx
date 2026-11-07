import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/auth-utils";
import { securitySnapshot } from "@/lib/security/server";
import { RECIPIENT, REPOSITORY } from "@/lib/security/model";
import PullQueue from "./PullQueue";
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
  const repairRequests = requests.filter(r => r.kind === "repair");
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
    <header className={styles.header}><div><p className={styles.eyebrow}>MORRIS AI · SECURITY</p><h1>Keep the family protected.</h1><p>Daily code and dependency reviews. Clear fixes. No silent failures.</p></div><a className={styles.button} href={`${github}/actions/workflows/security-review.yml`} target="_blank" rel="noreferrer">Open GitHub reviews ↗</a></header>
    <nav className={styles.quickNav} aria-label="Security navigation"><a className={`${styles.button} ${styles.primary}`} href="#pull-reviews">Review fixes →</a><a className={styles.button} href="#vulnerabilities">View findings</a><a className={styles.button} href="#cyber-agent">Cyber agent</a><a className={styles.button} href="#scan-controls">Scan settings</a></nav>
    <PullQueue/>
    <section className={styles.stats} aria-label="Open vulnerability counts">{(["critical","high","medium","low"] as const).map(s => <Link key={s} href={`?severity=${s}`} className={styles.stat}><span className={styles[s]}>{s}</span><strong>{open.filter(f => f.severity === s).length}</strong><span>open findings</span></Link>)}</section>
    <section className={styles.panel}>
      <h2>{stale ? "Review needs attention" : latest?.completed.length === 2 && !latest.errors.length ? "Review received" : "Review has coverage gaps"}</h2>
      <p>{latest ? `Last report: ${date(latest.received_at)} Eastern · ${latest.completed.join(" + ") || "no completed scans"}` : "Waiting for the first GitHub review. Zero findings does not yet mean a clean scan."}</p>
      <p>{config.enabled ? `Scheduled ${config.frequency} at ${config.time} Eastern. Next due: ${config.next_due ? date(config.next_due) : "being calculated"}.` : "Scheduled reviews are paused."} Every push to main still triggers a review. A separate daily watchdog checks for missed reports.</p>
      {latest?.errors.map((e,i) => <p role="alert" className={styles.issue} key={i}>{e}</p>)}
      {latest?.fix_url && <a className={styles.button} href={reviewHref(latest.fix_url)}>Review dependency fix →</a>}
      <p className={styles.muted}>Compatible dependency fixes are installed and tested before a PR opens. Validated lockfile fixes merge automatically when repository policy permits; CodeQL findings and major upgrades require review. Findings close only after a completed scan confirms resolution.</p>
    </section>
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
              <td className={styles.rowActions}>{repair?.url && <Link className={styles.actionLink} href={reviewHref(repair.url)}>Review fix →</Link>}{!f.resolved_at && <FixNow finding={f.key} pending={pending} />}{f.resolved_at && <span className={`${styles.badge} ${styles.goodBadge}`}>Resolved</span>}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
      {pages > 1 && <nav className={styles.pagination} aria-label="Vulnerability pages"><span className={styles.muted}>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, matches.length)} of {matches.length} · Page {page} of {pages}</span><div>{page > 1 && <Link className={styles.button} href={pageHref(page - 1)}>← Previous</Link>}{page < pages && <Link className={styles.button} href={pageHref(page + 1)}>Next →</Link>}</div></nav>}
    </section>
    <section id="cyber-agent" className={`${styles.panel} ${styles.agentPanel}`} aria-labelledby="agent-title">
      <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>REPAIR WORKSPACE</p><h2 id="agent-title">Cyber agent</h2><p>Request repairs for open findings, then review the resulting fixes.</p></div><div className={styles.agentAction}><FixNow pending={activeRequests.some(r => r.kind === "repair")} /><span className={styles.muted}>Attempt supported repairs</span></div></div>
      <ol className={styles.agentSteps}><li><strong>1. Request repairs</strong><span>Compatible dependency updates and up to three code-fix generation attempts per request.</span></li><li><strong>2. Validate and review</strong><span>Fixes run through isolated checks. Code PRs need your review before merging.</span><a className={styles.actionLink} href="#pull-reviews">Review fixes ↑</a></li><li><strong>3. Confirm resolution</strong><span>Findings stay open until a completed scan confirms the fix. Unsupported or failed fixes trigger alerts.</span></li></ol>
      <div className={styles.subsection}><div className={styles.heading}><h3>Repair requests</h3><span className={styles.count}>{activeRequests.filter(r => r.kind === "repair").length} active</span></div>
        {!repairRequests.length && <p className={styles.muted}>No repair requests yet. Use Fix now here for supported open findings, or beside an individual finding.</p>}
        {repairRequests.map(r => <article className={styles.activityRow} key={r.id}><div><strong>{r.status === "failed" ? "Completed with issues / failed" : r.status}</strong><p>{r.target_key ? "Individual finding" : "All supported open findings"} · {date(r.requested_at)} Eastern</p></div>{r.claimed_run && <a className={styles.actionLink} href={`${github}/actions/runs/${r.claimed_run}`}>Open run ↗</a>}</article>)}
      </div>
    </section>
    <SecurityControls config={config} pending={activeRequests.length > 0} />
    <section className={styles.panel} aria-labelledby="activity-title"><h2 id="activity-title">Activity and notifications</h2><p className={styles.muted}>Expand a log to see delivery, scan requests, or completed reviews.</p>
      <details className={styles.activityGroup}><summary>Email alerts <span className={styles.count}>{mail.length}</span></summary><p>Sent to <strong>{RECIPIENT}</strong> for medium, high, or critical findings and review or fix failures. Open issues receive daily reminders. Pending PRs stay open findings until merged and rescanned.</p><p className={styles.muted}>Provider acceptance is recorded below; inbox delivery depends on the email provider.</p>{!mail.length && <p>No security emails queued yet.</p>}{mail.map(m => <article className={styles.activityRow} key={m.id}><div><strong>{m.subject}</strong><p>{m.sent_at ? `Accepted by email provider ${date(m.sent_at)}` : `Pending · ${m.attempts} attempts`}</p>{m.last_error && <p role="alert" className={styles.issue}>{m.last_error}</p>}</div></article>)}</details>
      <details className={styles.activityGroup}><summary>Requested scans <span className={styles.count}>{scanRequests.length}</span></summary>{!scanRequests.length && <p>No ad hoc scans requested yet.</p>}{scanRequests.map(r => <article className={styles.activityRow} key={r.id}><div><strong>{r.status === "failed" ? "Completed with issues / failed" : r.status}</strong><p>Requested {date(r.requested_at)} Eastern</p></div>{r.claimed_run && <a className={styles.actionLink} href={`${github}/actions/runs/${r.claimed_run}`}>Open run ↗</a>}</article>)}</details>
      <details className={styles.activityGroup}><summary>Review history <span className={styles.count}>{runs.length}</span></summary>{!runs.length && <p>No reviews received yet.</p>}{runs.map(r => <article className={styles.activityRow} key={r.run_id}><div><strong>{date(r.received_at)} Eastern</strong><p>{r.completed.join(" + ") || "Incomplete"} · {r.errors.length} issues · <code>{r.sha.slice(0,12)}</code></p></div><a className={styles.actionLink} href={`${github}/actions/runs/${r.run_id}`}>Run {r.run_id} · attempt {r.attempt} ↗</a></article>)}</details>
    </section>
  </main>;
}
