export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireFinanceAccess } from "@/lib/finance/access";
import { createServiceClient } from "@/lib/supabase/server";
import ImportClient from "./_components/ImportClient";
import QuickEntryForm from "./_components/QuickEntryForm";
import ManualAccountsList from "./_components/ManualAccountsList";

interface ManualAccount {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number | null;
  as_of_date: string | null;
  currency: string;
  holdings: { name: string; value: number; pct: number | null; shares: number | null; price: number | null }[] | null;
  source: string;
  created_at: string;
  visible_to_family: boolean;
}

export default async function ImportPage() {
  const { user } = await requireFinanceAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;

  const { data: rows } = await service
    .schema("finance")
    .from("manual_accounts")
    .select("id, name, institution, account_type, balance, as_of_date, currency, holdings, source, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch sharing flags separately — fails gracefully if migration not yet run
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharingMap = new Map<string, boolean>();
  try {
    const { data: sharingRows } = await service
      .schema("finance").from("manual_accounts")
      .select("id, visible_to_family").eq("user_id", user.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((sharingRows ?? []) as any[]).forEach((r) => sharingMap.set(r.id, r.visible_to_family ?? false));
  } catch { /* column not yet added */ }

  const accounts: ManualAccount[] = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rows ?? []) as any[]
  ).map((r) => ({ ...r, visible_to_family: sharingMap.get(r.id) ?? false }));

  return (
    <div>
      <header style={{ borderBottom: "1px solid var(--color-rule)", background: "var(--color-paper)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--color-bronze)", alignSelf: "center" }} />
            <span className="serif" style={{ fontSize: 22 }}>morrisai</span>
            <span className="serif" style={{ color: "var(--color-bronze-dark)", fontStyle: "italic" }}>.family</span>
            <span style={{ color: "var(--color-ink-3)", fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", marginLeft: 14, paddingLeft: 14, borderLeft: "1px solid var(--color-rule)" }}>
              finance · import
            </span>
          </div>
          <Link href="/finance/dashboard" style={{ fontSize: 12, color: "var(--color-ink-3)", textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--color-rule)" }}>
            ← Dashboard
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "32px 28px 80px" }}>

        {/* Quick entry — primary path */}
        <section style={{ marginBottom: 40 }}>
          <h1 className="serif" style={{ fontSize: 32, marginBottom: 6 }}>Manual account entry</h1>
          <p style={{ fontSize: 14, color: "var(--color-ink-3)", lineHeight: 1.55, marginBottom: 24, maxWidth: 560 }}>
            Enter your 401k or other account balance directly. Paste the balance history rows from Alight to track monthly trends.
          </p>
          <div style={{ background: "var(--color-paper-card)", border: "1px solid var(--color-rule)", borderRadius: 12, padding: "24px 28px", boxShadow: "var(--shadow-card)" }}>
            <QuickEntryForm />
          </div>
        </section>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 40 }}>
          <div style={{ flex: 1, height: 1, background: "var(--color-rule)" }} />
          <span style={{ fontSize: 11, color: "var(--color-ink-4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            or import from a file
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--color-rule)" }} />
        </div>

        {/* File upload — secondary path */}
        <section style={{ marginBottom: 40 }}>
          <h2 className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Upload statement</h2>
          <p style={{ fontSize: 13, color: "var(--color-ink-3)", marginBottom: 16, maxWidth: 560 }}>
            Upload a PDF or CSV — Morris will extract the balance and holdings. Works best with holdings summaries, not transaction logs.
          </p>
          <ImportClient userId={user.id} />
        </section>

        {/* Saved accounts */}
        {accounts.length > 0 && (
          <section>
            <h2 className="serif" style={{ fontSize: 24, marginBottom: 16 }}>Saved accounts</h2>
            <ManualAccountsList initialAccounts={accounts} />
          </section>
        )}
      </main>
    </div>
  );
}
