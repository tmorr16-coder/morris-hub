"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/ios";
import { saveManualBalance } from "../actions";

export default function QuickEntryForm() {
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
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

    // Parse optional balance history
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
      <p className="ios-subhead" style={{ color: "var(--ios-green)", display: "flex", alignItems: "center", gap: 6 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 16, height: 16 }}>
          <path d="M5 12.5 10 17.5 19 6.5" />
        </svg>
        Account saved. Scroll down to see it.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <label style={labelStyle}>Account name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. My 401(k) Plan" />
      </div>

      <div>
        <label style={labelStyle}>Institution</label>
        <input value={institution} onChange={(e) => setInstitution(e.target.value)} style={inputStyle} placeholder="e.g. Fidelity, Vanguard, Alight" />
      </div>

      <div>
        <label style={labelStyle}>Account type</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TYPES.map((t) => (
            <Chip key={t.value} small selected={accountType === t.value} onClick={() => setAccountType(t.value)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>As-of date</label>
        <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} style={{ ...inputStyle, colorScheme: "light dark" }} />
      </div>

      <div>
        <label style={labelStyle}>Current balance</label>
        <input
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="e.g. 54,320.00"
          inputMode="decimal"
          className="ios-num"
          style={{ ...inputStyle, fontSize: 22, fontWeight: 600 }}
        />
      </div>

      <div>
        <label style={labelStyle}>Balance history (optional)</label>
        <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginBottom: 8 }}>
          Paste monthly balance rows — one per line in <span className="ios-num">date  $balance  return%</span> format. Each line is parsed automatically.
        </div>
        <textarea
          value={historyText}
          onChange={(e) => setHistoryText(e.target.value)}
          placeholder={"05-22-2026  $54,320.00  2.14%\n04-30-2026  $53,200.50  1.89%\n03-31-2026  $52,100.00  -1.22%"}
          rows={6}
          className="ios-num"
          style={{ ...inputStyle, fontSize: 13, lineHeight: 1.6, resize: "vertical" }}
        />
      </div>

      {error && (
        <p className="ios-subhead" style={{ color: "var(--ios-red)" }}>{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="ios-btn ios-btn--primary"
        style={{ opacity: isPending ? 0.5 : 1 }}
      >
        {isPending ? "Saving…" : "Save account"}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600, letterSpacing: "0.04em",
  textTransform: "uppercase", color: "var(--ios-label-2)", marginBottom: 8,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", border: "none",
  borderRadius: 10, background: "var(--ios-fill)", color: "var(--ios-label)",
  fontSize: 17, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
