"use client";
import {useActionState} from "react";
import {protectSecurityNow,pauseSecurityAutomation} from "./actions";
import styles from "./security.module.css";
export default function AutopilotControls({enabled,pending}:{enabled:boolean;pending:boolean}){
 const[start,startAction,starting]=useActionState(protectSecurityNow,{});
 const[pause,pauseAction,pausing]=useActionState(pauseSecurityAutomation,{});
 return <div className={styles.autopilotControls}><form action={startAction}><button className={`${styles.button} ${styles.primary}`} disabled={starting||pending} type="submit">{starting?"Starting protection…":pending?"Protection in progress":"Protect now"}</button></form><p className={styles.muted}>Scan → prioritize → fix → verify. Requests usually start within five minutes; GitHub may take longer.</p>{start.message&&<p role="status">{start.message}</p>}{start.error&&<p role="alert" className={styles.issue}>{start.error}</p>}<details className={styles.automationOptions}><summary>Automation controls</summary><p>{enabled?"Risk-based repairs are enabled for scheduled and push reviews.":"Automatic repairs are paused. Protect now resumes them and starts a review."}</p>{enabled&&<form action={pauseAction}><button className={styles.button} disabled={pausing} type="submit">{pausing?"Pausing…":"Pause automatic repairs"}</button></form>}{pause.message&&<p role="status">{pause.message}</p>}{pause.error&&<p role="alert" className={styles.issue}>{pause.error}</p>}</details></div>;
}
