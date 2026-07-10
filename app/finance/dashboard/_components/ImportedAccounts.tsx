"use client";

// Imported / manual accounts on the Money dashboard. Owned accounts are
// editable at any time — tap Edit to update the value (and name); the change
// saves via the updateManualAccount server action and revalidates the page.

import { useState, useTransition } from "react";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";
import { updateManualAccount } from "../import/actions";

export interface ImportedAccount {
  id: string;
  name: string;
  account_type: string | null;
  institution: string | null;
  balance: number | null;
  currency: string | null;
  editable: boolean;
}

function fmtMoney(n: number | null, currency = "USD"): string {
  return (n ?? 0).toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

export default function ImportedAccounts({ accounts }: { accounts: ImportedAccount[] }) {
  const [editing, setEditing] = useState<ImportedAccount | null>(null);
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openEdit(a: ImportedAccount) {
    setEditing(a);
    setName(a.name);
    setBalance(String(a.balance ?? 0));
    setError(null);
  }

  function save() {
    if (!editing) return;
    const num = parseFloat(balance.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(num)) { setError("Enter a valid amount"); return; }
    startTransition(async () => {
      const r = await updateManualAccount({ id: editing.id, balance: num, name });
      if (r.error) { setError(r.error); return; }
      setEditing(null);
    });
  }

  if (accounts.length === 0) return null;

  return (
    <>
      <Group header="Imported" footer="Tap Edit to update a value anytime.">
        {accounts.map((a) => (
          <Cell
            key={a.id}
            chevron={false}
            lead={<IconBadge color="#8B6A47"><Icons.ChartIcon /></IconBadge>}
            title={a.name}
            subtitle={[a.account_type, a.institution].filter(Boolean).join(" · ") || undefined}
            trailing={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                <span className="ios-num">{fmtMoney(a.balance, a.currency ?? "USD")}</span>
                {a.editable && (
                  <button onClick={() => openEdit(a)} className="ios-footnote" style={{ color: "var(--ios-tint)", fontWeight: 500 }}>Edit</button>
                )}
              </span>
            }
          />
        ))}
      </Group>

      {editing && (
        <div className="ios-sheet-backdrop" onClick={() => !pending && setEditing(null)}>
          <div className="ios-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ios-grabber" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 12px" }}>
              <button className="ios-footnote" style={{ color: "var(--ios-tint)" }} onClick={() => !pending && setEditing(null)}>Cancel</button>
              <span className="ios-headline">Edit account</span>
              <button className="ios-footnote" style={{ color: "var(--ios-tint)", fontWeight: 600 }} onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</button>
            </div>

            <div className="ios-group-header">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", fontSize: 16, background: "var(--ios-cell)", border: "none", borderRadius: 10, color: "var(--ios-label)", marginBottom: 12 }}
            />

            <div className="ios-group-header">Current value (USD)</div>
            <input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              inputMode="decimal"
              className="ios-num"
              style={{ width: "100%", padding: "12px 14px", fontSize: 16, background: "var(--ios-cell)", border: "none", borderRadius: 10, color: "var(--ios-label)" }}
            />

            {error && <div className="ios-footnote" style={{ color: "var(--ios-red)", marginTop: 8 }}>{error}</div>}
          </div>
        </div>
      )}
    </>
  );
}
