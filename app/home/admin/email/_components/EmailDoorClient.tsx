"use client";

import { useState } from "react";
import { Group, Cell, IconBadge, Icons } from "@/components/ios";
import type { InboundStatus } from "@/lib/inbound-email";
import { setUpEmailDoor, checkEmailDoor } from "../actions";

// Setting up the email door is three things in two places: a domain and a
// webhook on Resend, which the button below does, and DNS records at the
// registrar, which only the person with that login can do. So the screen
// does what it can and then shows exactly what to paste, with Copy buttons,
// and a Check button that asks Resend whether the records have landed.

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ios-btn--plain"
      style={{ color: "var(--ios-tint)", fontWeight: 600, flexShrink: 0 }}
      onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => undefined); }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** GoDaddy wants the host relative to the zone: "in" rather than "in.morrisai.family". */
function zoneHost(name: string, apex: string): string {
  const n = name.toLowerCase().replace(/\.$/, "");
  if (n === apex) return "@";
  return n.endsWith(`.${apex}`) ? n.slice(0, -(apex.length + 1)) : n;
}

export default function EmailDoorClient({ initial, apex, kids }: {
  initial: InboundStatus;
  apex: string;
  kids: { name: string; address: string }[];
}) {
  const [status, setStatus] = useState<InboundStatus>(initial);
  const [busy, setBusy] = useState<"setup" | "check" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [secret, setSecret] = useState<string | null>(null);

  async function setup() {
    setBusy("setup"); setError(null);
    const r = await setUpEmailDoor();
    setBusy(null);
    if (r.error) { setError(r.error); return; }
    if (r.status) setStatus(r.status);
    setNotes(r.notes ?? []);
    if (r.signingSecret) setSecret(r.signingSecret);
  }
  async function check() {
    setBusy("check"); setError(null);
    const r = await checkEmailDoor();
    setBusy(null);
    if (r.error) { setError(r.error); return; }
    if (r.status) setStatus(r.status);
  }

  const mx = status.records.filter((r) => r.record === "Receiving");
  const others = status.records.filter((r) => r.record !== "Receiving");
  const stage = !status.configured ? "no-key" : !status.domainId ? "fresh" : status.live ? "live" : "dns";

  return (
    <>
      <Group header="Where it stands">
        <Cell
          chevron={false}
          lead={<IconBadge color={stage === "live" ? "var(--ios-green)" : stage === "no-key" ? "var(--ios-red)" : "var(--ios-orange)"}><Icons.ComposeIcon /></IconBadge>}
          title={
            stage === "no-key" ? "Resend is not configured on the server"
            : stage === "fresh" ? "Not set up yet"
            : stage === "live" ? `Live at ${status.domain}`
            : `Waiting for DNS at ${status.domain}`
          }
          subtitle={
            stage === "no-key" ? "RESEND_API_KEY is missing, so nothing here can run."
            : stage === "fresh" ? "One tap creates the receiving domain and the webhook on Resend."
            : stage === "live" ? "Emails forwarded to a child's address are read and filed."
            : `Domain ${status.domainStatus ?? "pending"} · receiving ${status.receiving ? "on" : "off"} · webhook ${status.webhookId ? "added" : "missing"}`
          }
        />
        {stage !== "no-key" && (
          <div style={{ display: "flex", gap: 10, padding: "10px 16px 14px", flexWrap: "wrap" }}>
            {stage !== "live" && (
              <button type="button" className="ios-btn" onClick={setup} disabled={busy != null}>
                {busy === "setup" ? "Setting up…" : stage === "fresh" ? "Set up on Resend" : "Repair on Resend"}
              </button>
            )}
            {stage !== "fresh" && (
              <button type="button" className="ios-btn ios-btn--secondary" onClick={check} disabled={busy != null}>
                {busy === "check" ? "Checking…" : "Check DNS now"}
              </button>
            )}
          </div>
        )}
        {error && <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: "0 16px 12px" }}>{error}</p>}
        {notes.length > 0 && <p className="ios-footnote" style={{ color: "var(--ios-label-2)", margin: "0 16px 12px" }}>{notes.join(" ")}</p>}
      </Group>

      {secret && (
        <Group header="Optional: signature checks" footer="Resend shows this once. Add it in Vercel as RESEND_WEBHOOK_SECRET to have each event's signature verified. Without it the door still works — every event is only a pointer to an email already in your Resend inbox, which is fetched back from Resend by id.">
          <div style={{ padding: "10px 16px" }}><Row label="Secret" value={secret} /></div>
        </Group>
      )}

      {stage === "dns" && (
        <Group
          header="Add these at GoDaddy"
          footer={`GoDaddy → My Products → ${apex} → DNS → Add record. Use the Host exactly as shown (GoDaddy adds “.${apex}” itself). The MX record is what makes mail arrive; the TXT record proves the domain is yours. Records usually show as verified within a few minutes; some take an hour.`}
        >
          {[...mx, ...others].map((r, i) => (
            <div key={i} style={{ padding: "10px 16px", borderBottom: "1px solid var(--ios-separator)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>{r.type}</span>
                <span className="ios-footnote" style={{ color: "var(--ios-label-2)" }}>{r.record}</span>
                <span className="ios-footnote" style={{ marginLeft: "auto", color: r.status === "verified" ? "var(--ios-green)" : "var(--ios-orange)" }}>{r.status.replace("_", " ")}</span>
              </div>
              <Row label="Host" value={zoneHost(r.name, apex)} />
              <Row label="Value" value={r.value} />
              {r.priority != null && <Row label="Priority" value={String(r.priority)} />}
              <Row label="TTL" value={r.ttl === "Auto" ? "1 hour (default)" : r.ttl} copy={false} />
            </div>
          ))}
        </Group>
      )}

      {stage === "live" && (
        <Group header="Addresses" footer="Forward the teacher's email to the child's address. In Gmail, Settings → Forwarding adds it (the confirmation code lands on Platform status), then a filter on the teacher's address forwards every newsletter. Only email from a parent on the platform is accepted.">
          {kids.length === 0 && <Cell chevron={false} title="No children yet" subtitle="Add a child in Student Success and the address appears here." />}
          {kids.map((c) => (
            <Cell key={c.address} chevron={false} lead={<IconBadge color="var(--ios-tint)"><Icons.PeopleIcon /></IconBadge>} title={c.address} subtitle={c.name} trailing={<CopyButton text={c.address} />} />
          ))}
        </Group>
      )}

      <Group header="Webhook">
        <div style={{ padding: "10px 16px" }}>
          <Row label="URL" value={status.webhookEndpoint} copy={false} />
          <div className="ios-footnote" style={{ color: "var(--ios-label-2)", marginTop: 4 }}>{status.webhookId ? "Registered on Resend for email.received" : "Not registered yet"}</div>
        </div>
      </Group>
    </>
  );
}

function Row({ label, value, copy = true }: { label: string; value: string; copy?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "3px 0" }}>
      <span className="ios-footnote" style={{ color: "var(--ios-label-3)", width: 56, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, wordBreak: "break-all", flex: 1 }}>{value}</span>
      {copy && <CopyButton text={value} />}
    </div>
  );
}
