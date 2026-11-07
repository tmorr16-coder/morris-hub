"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestSecurityScan, saveSecuritySchedule } from "./actions";
import type { ReviewConfig } from "@/lib/security/schedule";
import styles from "./security.module.css";
export default function SecurityControls({ config, pending }: { config: ReviewConfig; pending: boolean }) {
  const [request, requestAction, requesting] = useActionState(requestSecurityScan, {});
  const [schedule, saveAction, saving] = useActionState(saveSecuritySchedule, {});
  const router = useRouter();
  useEffect(() => { if (!pending) return; const timer = setInterval(() => router.refresh(), 30_000); return () => clearInterval(timer); }, [pending, router]);
  return <section id="scan-controls" className={styles.panel} aria-labelledby="scan-title">
    <div className={styles.heading}><h2 id="scan-title">Scans and schedule</h2><form action={requestAction}><button className={styles.button} disabled={requesting || pending} type="submit">{requesting ? "Queueing…" : pending ? "Scan requested" : "Scan now"}</button></form></div>
    <p>Request a full review at any time. GitHub checks the queue every five minutes; scheduled runs may be delayed by GitHub.</p>
    {request.message && <p role="status">{request.message}</p>}{request.error && <p role="alert" className={styles.issue}>{request.error}</p>}
    <form action={saveAction}><fieldset className={styles.scheduleFields}><legend>Automatic review schedule</legend><div className={styles.filters}>
      <input type="hidden" name="version" value={config.version} />
      <label><span>Scheduled reviews</span><input name="enabled" type="checkbox" defaultChecked={config.enabled} /></label>
      <label>Frequency<select name="frequency" defaultValue={config.frequency}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
      <label>Time · Eastern<input type="time" name="time" defaultValue={config.time} required /></label>
      <label>Weekday · weekly only<select name="weekday" defaultValue={config.weekday}>{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,i) => <option value={i} key={day}>{day}</option>)}</select></label>
      <button className={styles.button} disabled={saving} type="submit">{saving ? "Saving…" : "Save schedule"}</button>
    </div></fieldset></form>
    {schedule.message && <p role="status">{schedule.message}</p>}{schedule.error && <p role="alert" className={styles.issue}>{schedule.error}</p>}
    <p className={styles.muted}>Uses America/Indiana/Indianapolis, including daylight saving changes. Pushes to main still trigger reviews when the schedule is paused.</p>
  </section>;
}
