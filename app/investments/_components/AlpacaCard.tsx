"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cell, IconBadge } from "@/components/ios";
import { saveAlpacaCredentials, disconnectAlpaca } from "../actions";

interface Props {
  configured: boolean;
  isPaper?: boolean;
}

const ChartGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M8 15l3.5-4 3 2.5L20 7" />
  </svg>
);

function StatusPill({ on }: { on: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, color: on ? "var(--ios-green)" : "var(--ios-label-2)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "var(--ios-green)" : "var(--ios-label-3)" }} />
      {on ? "Connected" : "Not connected"}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", border: "none", background: "transparent",
  color: "var(--ios-label)", fontSize: 17, outline: "none", padding: 0,
};

export default function AlpacaCard({ configured, isPaper = true }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [paper, setPaper] = useState(true);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  function handleSave() {
    if (!apiKey.trim() || !apiSecret.trim()) return;
    setSaveErr(null);
    startTransition(async () => {
      const result = await saveAlpacaCredentials({ apiKey, apiSecret, isPaper: paper });
      if (result.error) setSaveErr(result.error);
      else { setApiKey(""); setApiSecret(""); router.refresh(); }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectAlpaca();
      router.refresh();
    });
  }

  const canSave = apiKey.trim() && apiSecret.trim() && !isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="ios-list" style={{ margin: 0 }}>
        <Cell
          chevron={false}
          lead={<IconBadge color="var(--ios-finance)"><ChartGlyph /></IconBadge>}
          title="Alpaca brokerage"
          subtitle="Portfolio · positions · paper & live trading"
          trailing={<StatusPill on={configured} />}
        />

        {configured ? (
          <>
            <Cell chevron={false} title="Mode" trailing={<span className="ios-num">{isPaper ? "Paper trading" : "Live trading"}</span>} />
            <Cell chevron={false} title="API secret" trailing={<span className="ios-num" style={{ color: "var(--ios-label-2)" }}>••••••••</span>} />
            <Cell
              chevron={false}
              onClick={handleDisconnect}
              title={<span style={{ color: "var(--ios-red)" }}>{isPending ? "Disconnecting…" : "Disconnect"}</span>}
            />
          </>
        ) : (
          <>
            <div className="ios-cell">
              <input
                type="text"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key ID"
                style={inputStyle}
              />
            </div>
            <div className="ios-cell">
              <input
                type="password"
                autoComplete="off"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="API Secret Key"
                style={inputStyle}
              />
            </div>
            <Cell
              chevron={false}
              title="Paper trading"
              subtitle="Simulated money — recommended to start"
              trailing={
                <button
                  role="switch"
                  aria-checked={paper}
                  onClick={() => setPaper((p) => !p)}
                  style={{
                    width: 51, height: 31, borderRadius: 31, border: "none", cursor: "pointer",
                    padding: 2, background: paper ? "var(--ios-green)" : "var(--ios-label-3)",
                    transition: "background 0.2s", display: "flex",
                    justifyContent: paper ? "flex-end" : "flex-start", alignItems: "center",
                  }}
                >
                  <span style={{ width: 27, height: 27, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                </button>
              }
            />
          </>
        )}
      </div>

      {configured ? (
        <p className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0" }}>
          Your keys are stored securely and used only to load your portfolio and place your trades.
        </p>
      ) : (
        <>
          <button
            className="ios-btn ios-btn--primary"
            onClick={handleSave}
            disabled={!canSave}
            style={{ margin: "0 16px", width: "calc(100% - 32px)", opacity: canSave ? 1 : 0.5 }}
          >
            {isPending ? "Connecting…" : "Connect Alpaca"}
          </button>
          {saveErr && <p className="ios-footnote" style={{ color: "var(--ios-red)", padding: "2px 16px 0" }}>{saveErr}</p>}
          <ol className="ios-footnote" style={{ color: "var(--ios-label-2)", padding: "2px 16px 0 34px", margin: 0, lineHeight: 1.7 }}>
            <li>Create a free account at <b style={{ fontWeight: 600 }}>alpaca.markets</b>.</li>
            <li>In the dashboard, generate an <b style={{ fontWeight: 600 }}>API Key + Secret</b> (choose Paper Trading to start, or Live).</li>
            <li>Paste both above and choose Paper or Live, then Connect.</li>
          </ol>
        </>
      )}
    </div>
  );
}
