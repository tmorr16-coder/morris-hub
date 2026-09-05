"use client";

// The document's only interactive parts: print/share, and asking for a
// written summary. Everything else on the page is plain server-rendered
// markup so it prints as-is.

import { useState } from "react";
import Link from "next/link";
import MarkdownMessage from "@/components/MarkdownMessage";
import styles from "./plan.module.css";

export function PlanToolbar() {
  return (
    <div className={styles.toolbar}>
      <Link href="/finance/retirement" className={styles.toolbarBtn}>
        ‹ Back to plan
      </Link>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className={styles.toolbarBtnPrimary} onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}

/**
 * A written summary in plain language, generated on request rather than on
 * every open: it costs a model call, and a person reviewing numbers does not
 * always want prose. Once written it sits at the top of the document and
 * prints with it.
 */
export function PlanNarrative() {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function write() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/retirement/plan-narrative", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not write the summary");
      setText(data.narrative);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>Summary</h2>
      {text ? (
        <div className={styles.narrative}>
          <MarkdownMessage content={text} />
          <p className={`${styles.fine} ${styles.noPrint}`} style={{ marginTop: 8 }}>
            Written by Claude from the figures on this page. Read it against the tables; it does not see anything they don&rsquo;t show.
          </p>
        </div>
      ) : (
        <div className={styles.noPrint}>
          <p className={styles.lede}>
            Add a plain-language summary of where the plan stands, what carries it, and what to discuss. Written from the numbers below.
          </p>
          <button type="button" className={styles.toolbarBtn} onClick={write} disabled={busy}>
            {busy ? "Writing…" : "Write summary"}
          </button>
          {error && <p style={{ color: "var(--warn)", marginTop: 8 }}>{error}</p>}
        </div>
      )}
    </section>
  );
}
