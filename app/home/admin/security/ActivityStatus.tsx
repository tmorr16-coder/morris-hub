"use client";
import {useEffect,useState} from "react";
import {elapsedLabel,type SecurityActivity} from "@/lib/security/activity";
import {PullRefresh} from "./PullActions";
import styles from "./security.module.css";
const stamp=(v:string|number)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Indiana/Indianapolis',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date(v));
export default function ActivityStatus({activity}:{activity:SecurityActivity}){
 const[now,setNow]=useState(activity.checkedAt);
 useEffect(()=>{if(!activity.active)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[activity.active]);
 const elapsed=elapsedLabel(activity.startedAt,Math.max(now,activity.checkedAt));
 return <section className={`${styles.activityStatus} ${activity.state==='attention'?styles.activityAttention:''}`} aria-labelledby="activity-status-title"><PullRefresh active/>
  <div role="status" aria-live="polite" aria-atomic="true"><p className={styles.activityLabel}>{activity.state==='attention'?'NEEDS ATTENTION':activity.active?'IN PROGRESS':'CURRENT STATUS'}</p><h3 id="activity-status-title">{activity.active&&<span className={styles.activityDot} aria-hidden="true"/>}{activity.title}</h3><p>{activity.message}</p></div>
  <dl className={styles.activityFacts}>{activity.startedAt&&<div><dt>{activity.state==='queued'?'Waiting':'Elapsed'}</dt><dd>{elapsed??'—'}</dd></div>}<div><dt>Last worker report</dt><dd>{activity.reportedAt?`${stamp(activity.reportedAt)} Eastern`:'Awaiting first report'}</dd></div><div><dt>Page checked</dt><dd>{stamp(activity.checkedAt)} Eastern · refreshes every 15s</dd></div>{activity.queued>0&&activity.state!=='queued'&&<div><dt>Also queued</dt><dd>{activity.queued} request{activity.queued===1?'':'s'}</dd></div>}</dl>
  {activity.runId&&<a className={styles.actionLink} href={`https://github.com/tmorr16-coder/morris-hub/actions/runs/${activity.runId}`} target="_blank" rel="noreferrer">{activity.active?'View active run and job stages ↗':'View latest run ↗'}</a>}
 </section>;
}
