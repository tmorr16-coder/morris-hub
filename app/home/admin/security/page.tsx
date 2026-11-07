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
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ severity?: string; state?: string }> }) {
  try { await requireAdmin(); } catch { redirect("/home"); }
  const filters = await searchParams;
  let snapshot;
  try { snapshot = await securitySnapshot(); } catch {
    return <main className={styles.main}><Link href="/home/admin">← Admin</Link><h1>Security tracker unavailable</h1><p role="alert">The security database could not be reached. This does not mean the platform is free of vulnerabilities.</p><a className={styles.actionLink} href={`${github}/actions/workflows/security-review.yml`}>Check GitHub reviews</a></main>;
  }
  const { runs, findings, mail, stale, config, requests } = snapshot;
  const open = findings.filter(f => !f.resolved_at);
  const latest = runs[0];
  const shown = findings.filter(f => (filters.state === "resolved" ? !!f.resolved_at : !f.resolved_at) && (!filters.severity || f.severity === filters.severity));
  const ranks = { critical: 0, high: 1, medium: 2, low: 3 };
  shown.sort((a,b) => ranks[a.severity] - ranks[b.severity]);
  return <main className={styles.main}>
    <Link className={styles.back} href="/home/admin">← Admin</Link>
    <header className={styles.header}><div><p className={styles.eyebrow}>MORRIS AI · SECURITY</p><h1>Keep the family protected.</h1><p>Daily code and dependency reviews. Clear fixes. No silent failures.</p></div><a className={styles.button} href={`${github}/actions/workflows/security-review.yml`} target="_blank" rel="noreferrer">Open GitHub reviews ↗</a></header>
    <nav className={styles.quickNav} aria-label="Security navigation"><a className={`${styles.button} ${styles.primary}`} href="#pull-reviews">Review fixes →</a><a className={styles.button} href="#vulnerabilities">View findings</a><a className={styles.button} href="#cyber-agent">Cyber agent</a></nav>
    <PullQueue/>
    <section className={styles.stats} aria-label="Open vulnerability counts">{(["critical","high","medium","low"] as const).map(s => <Link key={s} href={`?severity=${s}`} className={styles.stat}><span className={styles[s]}>{s}</span><strong>{open.filter(f => f.severity === s).length}</strong><span>open findings</span></Link>)}</section>
    <section id="cyber-agent" className={styles.panel}><div className={styles.heading}><h2>Cyber agent</h2><FixNow pending={requests.some(r => r.kind === "repair" && (r.status === "queued" || r.status === "running"))} /></div><p>Request supported repairs when the routine workflow leaves findings open. The agent attempts compatible dependency fixes and GitHub code-fix generation, opens code PRs, and checks them in isolated jobs. Code PRs require review before merging.</p><p className={styles.muted}>Up to three code-fix generation attempts per request. Unsupported fixes, major upgrades and failed validation stay visible and trigger email alerts. Fix now does not mark a finding resolved.</p></section>
    <SecurityControls config={config} pending={requests.some(r => r.status === "queued" || r.status === "running")} />
    <section className={styles.panel}>
      <h2>{stale ? "Review needs attention" : latest?.completed.length === 2 && !latest.errors.length ? "Review received" : "Review has coverage gaps"}</h2>
      <p>{latest ? `Last report: ${date(latest.received_at)} Eastern · ${latest.completed.join(" + ") || "no completed scans"}` : "Waiting for the first GitHub review. Zero findings does not yet mean a clean scan."}</p>
      <p>{config.enabled ? `Scheduled ${config.frequency} at ${config.time} Eastern. Next due: ${config.next_due ? date(config.next_due) : "being calculated"}.` : "Scheduled reviews are paused."} Every push to main still triggers a review. A separate daily watchdog checks for missed reports.</p>
      {latest?.errors.map((e,i) => <p role="alert" className={styles.issue} key={i}>{e}</p>)}
      {latest?.fix_url && <a className={styles.button} href={reviewHref(latest.fix_url)}>Review dependency fix →</a>}
      <p className={styles.muted}>Compatible dependency fixes are installed and tested before a PR opens. Validated lockfile fixes merge automatically when repository policy permits; CodeQL findings and major upgrades require review. Findings close only after a completed scan confirms resolution.</p>
    </section>
    <section id="vulnerabilities" className={styles.panel}>
      <div className={styles.heading}><h2>Vulnerabilities</h2><span>{shown.length} shown{filters.state === "resolved" ? " · latest 200" : ""}</span></div>
      <form className={styles.filters} method="get"><label>Status<select name="state" defaultValue={filters.state ?? "open"}><option value="open">Open</option><option value="resolved">Resolved</option></select></label><label>Severity<select name="severity" defaultValue={filters.severity ?? ""}><option value="">All severities</option>{["critical","high","medium","low"].map(s => <option key={s} value={s}>{s}</option>)}</select></label><button className={styles.button} type="submit">Apply filters</button><Link className={styles.actionLink} href="/home/admin/security">Clear</Link></form>
      {!shown.length && <p className={styles.empty}>{latest ? "No findings match these filters. Check review coverage above." : "Findings will appear after the first completed review."}</p>}
      {shown.map(f => <article className={styles.finding} key={f.key}><div className={styles.heading}><span className={styles[f.severity]}>{f.severity}</span><span className={styles.muted}>{f.source === "codeql" ? "CodeQL" : "Dependencies"}</span></div><h3>{f.title}</h3><code>{f.location}</code><p>{f.remediation}</p>
        {(() => { const repair = runs.flatMap(r => r.repairs ?? []).find(r => r.key === f.key); return repair ? <p><strong>{repair.status.replaceAll("_", " ")}</strong> · {repair.message} {repair.url && <Link className={styles.actionLink} href={reviewHref(repair.url)}>Review fix →</Link>}</p> : null; })()}
        {!f.resolved_at && <FixNow finding={f.key} pending={requests.some(r => r.kind === "repair" && (!r.target_key || r.target_key === f.key) && (r.status === "queued" || r.status === "running"))} />}<div className={styles.heading}><a className={styles.actionLink} href={f.url || `${github}/security`}>View advisory / code review ↗</a><small>{f.resolved_at ? `Resolved ${date(f.resolved_at)}` : `First seen ${date(f.first_seen)}`}</small></div></article>)}
    </section>
    <section className={styles.panel}><h2>Email alerts</h2><p>Sent to <strong>{RECIPIENT}</strong> for medium, high, or critical findings and review or fix failures. Open issues receive daily reminders. Pending PRs stay open findings until merged and rescanned.</p><p className={styles.muted}>Provider acceptance is recorded below; inbox delivery depends on the email provider.</p>{!mail.length && <p>No security emails queued yet.</p>}{mail.map(m => <article className={styles.finding} key={m.id}><strong>{m.subject}</strong><p>{m.sent_at ? `Accepted by email provider ${date(m.sent_at)}` : `Pending · ${m.attempts} attempts`}</p>{m.last_error && <p role="alert" className={styles.issue}>{m.last_error}</p>}</article>)}</section>
    <section className={styles.panel}><h2>Requested scans</h2>{!requests.length && <p>No ad hoc scans requested yet.</p>}{requests.map(r => <article className={styles.finding} key={r.id}><strong>{r.kind === "repair" ? "Repair · " : "Scan · "}{r.status === "failed" ? "Completed with issues / failed" : r.status}</strong><p>Requested {date(r.requested_at)} Eastern {r.claimed_run && <a className={styles.actionLink} href={`${github}/actions/runs/${r.claimed_run}`}>Open run ↗</a>}</p></article>)}</section>
    <section className={styles.panel}><h2>Review history</h2>{!runs.length && <p>No reviews received yet.</p>}{runs.map(r => <article className={styles.finding} key={r.run_id}><a className={styles.actionLink} href={`${github}/actions/runs/${r.run_id}`}>Run {r.run_id} · attempt {r.attempt} ↗</a><p>{date(r.received_at)} Eastern · {r.completed.join(" + ") || "Incomplete"} · {r.errors.length} issues</p><code>{r.sha.slice(0,12)}</code></article>)}</section>
  </main>;
}
