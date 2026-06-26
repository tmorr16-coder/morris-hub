"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveManualBalance } from "../actions";

export default function QuickEntryForm() {
  const [name, setName] = useState("Lilly Employee 401(k) Plan");
  const [institution, setInstitution] = useState("Alight / Eli Lilly");
  const [accountType, setAccountType] = useState("401k");
  const [balance, setBalance] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [historyText, setHistoryText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const TYPES = [
    { value: "401k", label: "401(k)" },
    { value: "roth_ira", label: "Roth IRA" },
    { value: "traditional_ira", label: "Traditional IRA" },
    { value: "hsa", label: "HSA" },
    { value: "brokerage", label: "Brokerage" },
    { value: "pension", label: "Pension" },
    { value: "other_investment", label: "Other investment" },
  ];

  function handleSubmit() {
    const bal = parseFloat(balance.replace(/[,$]/g, ""));
    if (!name.trim() || isNaN(bal) || bal <= 0) {
      setError("Account name and a valid balance are required");
      return;
    }

    // Parse optional balance history pasted from Alight
    // Expected: lines of "MM-DD-YYYY  $1,234,567.89  3.07%"
    // or CSV header "Date,Closing Balance,Rate of Return"
    const history: { date: string; balance: number; rate: number | null }[] = [];
    if (historyText.trim()) {
      for (const line of historyText.split("\n")) {
        const clean = line.replace(/,/g, "").trim();
        // Match date like 05-22-2026 or 2026-05-22
        const dateMatch = clean.match(/(\d{2}-\d{2}-\d{4}|\d{4}-\d{2}-\d{2})/);
        const balMatch = clean.match(/\$?([\d.]+)/);
        const rateMatch = clean.match(/([-\d.]+)%/);
        if (dateMatch && balMatch) {
          const raw = dateMatch[1];
          // normalise MM-DD-YYYY → YYYY-MM-DD
          const iso = raw.includes("-") && raw.length === 10 && raw[2] === "-"
            ? `${raw.slice(6)}-${raw.slice(0, 2)}-${raw.slice(3, 5)}`
            : raw;
          history.push({
            date: iso,
            balance: parseFloat(balMatch[1]),
            rate: rateMatch ? parseFloat(rateMatch[1]) : null,
          });
        }
      }
    }

    setError(null);
    startTransition(async () => {
      const res = await saveManualBalance({
        name: name.trim(),
        institution: institution.trim() || null,
        accountType,
        balance: bal,
        asOfDate,
        history: history.length > 0 ? history : null,
      });
      if (res.error) { setError(res.error); }
      else { setSuccess(true); router.refresh(); }
    });
  }

  if (success) {
    return (
      <div style={{ padding: "16px", background: "rgba(77,107,58,0.08)", border: "1px solid var(--color-green)", borderRadius: 10, fontSize: 13, color: "var(--color-green)" }}>
        ✓ Account saved. Scroll down to see it.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Account name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Lilly 401(k)" />
        </div>
        <div>
          <label style={labelStyle}>Institution</label>
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} style={inputStyle} placeholder="e.g. Alight" />
        </div>
        <div>
          <label style={labelStyle}>Account type</label>
          <select value={accountType} onChange={(e) => setAccountType(e.target.value)} style={inputStyle}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>As-of date</label>
          <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Current balance</label>
        <input
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="e.g. 1,322,659.63"
          style={{ ...inputStyle, fontSize: 20, fontFamily: "var(--font-mono)" }}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Balance history (optional) — paste rows from Alight Balance History table
        </label>
        <div style={{ fontSize: 11, color: "var(--color-ink-4)", marginBottom: 6 }}>
          Copy the Date / Closing Balance / Rate of Return rows and paste below. Each line is parsed automatically.
        </div>
        <textarea
          value={historyText}
          onChange={(e) => setHistoryText(e.target.value)}
          placeholder={"05-22-2026  $1,322,659.63  3.07%\n04-30-2026  $1,280,289.69  9.39%\n03-31-2026  $1,166,158.00  -5.68%"}
          rows={6}
          style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12, resize: "vertical" }}
        />
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(154,59,42,0.08)", border: "1px solid var(--color-red)", borderRadius: 8, fontSize: 13, color: "var(--color-red)" }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        style={{
          padding: "12px", borderRadius: 10, border: "none",
          background: isPending ? "var(--color-paper-deep)" : "var(--color-bronze)",
          color: isPending ? "var(--color-ink-3)" : "#fff",
          fontSize: 14, fontWeight: 600, cursor: isPending ? "default" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {isPending ? "Saving…" : "Save account"}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--color-ink-3)", marginBottom: 4,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", border: "1px solid var(--color-rule)",
  borderRadius: 8, background: "var(--color-paper)", color: "var(--color-ink)",
  fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
