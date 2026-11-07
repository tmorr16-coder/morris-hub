"use client";
import {useActionState,useEffect} from "react";
import {useRouter} from "next/navigation";
import {refreshSecurityPulls,mergeSecurityPull} from "./actions";
import styles from "./security.module.css";
export function RefreshPulls({pending=false,number}:{pending?:boolean;number?:number}){
 const[state,action,submitting]=useActionState(refreshSecurityPulls,{});
 return <div><form action={action}>{number&&<input type="hidden" name="number" value={number}/>}<button className={styles.button} type="submit" disabled={submitting||pending}>{pending?"Refresh queued":"Refresh reviews"}</button></form>{state.message&&<p role="status">{state.message}</p>}{state.error&&<p role="alert" className={styles.issue}>{state.error}</p>}</div>;
}
export function PullRefresh({active}:{active:boolean}){const router=useRouter();useEffect(()=>{if(!active)return;const t=setInterval(()=>router.refresh(),15000);return()=>clearInterval(t);},[active,router]);return null;}
export function MergePull({number,head,base,disabled,pending}:{number:number;head:string;base:string;disabled:boolean;pending:boolean}){
 const[state,action,submitting]=useActionState(mergeSecurityPull,{});
 return <div><form action={action}><input type="hidden" name="number" value={number}/><input type="hidden" name="head" value={head}/><input type="hidden" name="base" value={base}/><button className={`${styles.button} ${styles.primary}`} disabled={disabled||pending||submitting} type="submit">{pending?"Merge requested":submitting?"Requesting merge…":"Merge after checks"}</button></form>{state.message&&<p role="status">{state.message}</p>}{state.error&&<p role="alert" className={styles.issue}>{state.error}</p>}</div>;
}
