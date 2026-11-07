"use client";
import { useActionState } from "react";
import { requestSecurityFix } from "./actions";
import styles from "./security.module.css";
export default function FixNow({ finding, pending = false }: { finding?: string; pending?: boolean }) {
  const [state, action, submitting] = useActionState(requestSecurityFix, {});
  return <div><form action={action}>{finding && <input type="hidden" name="finding" value={finding} />}<button className={styles.button} disabled={submitting || pending} type="submit">{submitting ? "Queueing repair…" : pending ? "Repair requested" : "Fix now"}</button></form>{state.message && <p role="status">{state.message}</p>}{state.error && <p role="alert" className={styles.issue}>{state.error}</p>}</div>;
}
