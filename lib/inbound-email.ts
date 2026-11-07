// The email door's plumbing on Resend: which domain receives, whether its DNS
// is in place, and the webhook that delivers to us. Read-side helpers are
// cached briefly because the import screen asks on every open.
//
// Nothing here is stored in our database. Resend is the source of truth for
// the domain and the webhook, and the inbound route fetches every email back
// from Resend by id, so the only secret involved is the API key the platform
// already holds for sending. A webhook signing secret is optional: set
// RESEND_WEBHOOK_SECRET and events are verified; without it an event is only
// ever a pointer to an email in our own Resend inbox.

import { unstable_cache } from "next/cache";
import { Resend } from "resend";
import { publicOrigin } from "@/lib/site-url";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const INBOUND_WEBHOOK_PATH = "/api/email/inbound";
export const DEFAULT_INBOUND_SUBDOMAIN = "in";

export interface DnsRecord {
  record: string;      // SPF | DKIM | Receiving | Tracking
  type: string;        // MX | TXT | CNAME
  name: string;        // host, as Resend prints it (may be the full hostname)
  value: string;
  priority?: number;
  ttl: string;
  status: string;      // pending | verified | failed | temporary_failure | not_started
}

export interface InboundStatus {
  configured: boolean;        // RESEND_API_KEY present
  domain: string | null;      // e.g. in.morrisai.family
  domainId: string | null;
  domainStatus: string | null;
  receiving: boolean;         // capability on
  records: DnsRecord[];
  webhookEndpoint: string;
  webhookId: string | null;
  live: boolean;              // receiving on, MX verified, webhook present
}

export function inboundConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function hostOf(origin: string): string {
  return new URL(origin).host.replace(/^www\./, "");
}

/** The subdomain the door should live on, e.g. in.morrisai.family. */
export function intendedInboundDomain(): string {
  return (process.env.INBOUND_EMAIL_DOMAIN ?? `${DEFAULT_INBOUND_SUBDOMAIN}.${hostOf(publicOrigin())}`).toLowerCase();
}

/** Uncached read of everything the admin screen shows. */
export async function readInboundStatus(): Promise<InboundStatus> {
  const endpoint = `${publicOrigin()}${INBOUND_WEBHOOK_PATH}`;
  const empty: InboundStatus = { configured: inboundConfigured(), domain: null, domainId: null, domainStatus: null, receiving: false, records: [], webhookEndpoint: endpoint, webhookId: null, live: false };
  if (!empty.configured) return empty;
  const resend = client();
  const want = intendedInboundDomain();

  const { data: list } = await resend.domains.list();
  const domains = ((list as any)?.data ?? []) as { id: string; name: string; status: string; capabilities?: { receiving?: string } }[];
  // Prefer the intended name; otherwise any domain already receiving.
  const found = domains.find((d) => d.name.toLowerCase() === want) ?? domains.find((d) => d.capabilities?.receiving === "enabled") ?? null;

  let records: DnsRecord[] = [];
  let receiving = false;
  let domainStatus: string | null = null;
  if (found) {
    const { data: full } = await resend.domains.get(found.id);
    receiving = (full as any)?.capabilities?.receiving === "enabled";
    domainStatus = (full as any)?.status ?? found.status;
    records = (((full as any)?.records ?? []) as any[]).map((r) => ({
      record: r.record, type: r.type, name: r.name, value: r.value, priority: r.priority, ttl: r.ttl, status: r.status,
    }));
  }

  const { data: hooks } = await resend.webhooks.list();
  const hookList = ((hooks as any)?.data ?? []) as { id: string; endpoint: string; status?: string }[];
  const hook = hookList.find((h) => h.endpoint === endpoint) ?? null;

  const mxOk = records.some((r) => r.record === "Receiving" && r.status === "verified");
  return {
    ...empty,
    domain: found?.name ?? null,
    domainId: found?.id ?? null,
    domainStatus,
    receiving,
    records,
    webhookId: hook?.id ?? null,
    live: receiving && mxOk && !!hook,
  };
}

/**
 * The domain children's addresses are on, or null until the door is live.
 * Cached five minutes: it is read on every open of the import screen.
 */
export const receivingDomain = unstable_cache(
  async (): Promise<string | null> => {
    try {
      const s = await readInboundStatus();
      return s.live ? s.domain : null;
    } catch {
      return null;
    }
  },
  ["inbound-receiving-domain"],
  { revalidate: 300 },
);

/**
 * Create what is missing on Resend: the receiving domain and the webhook.
 * Idempotent — safe to press twice. Returns the one-time webhook signing
 * secret when a webhook was just created, since Resend shows it only once.
 */
export async function setUpInboundEmail(): Promise<{ status: InboundStatus; signingSecret: string | null; notes: string[] }> {
  const resend = client();
  const notes: string[] = [];
  const want = intendedInboundDomain();
  const endpoint = `${publicOrigin()}${INBOUND_WEBHOOK_PATH}`;

  const { data: list } = await resend.domains.list();
  const domains = ((list as any)?.data ?? []) as { id: string; name: string; capabilities?: { receiving?: string } }[];
  const existing = domains.find((d) => d.name.toLowerCase() === want) ?? null;
  if (!existing) {
    // Receiving only: this subdomain never sends, so nothing is lost by
    // leaving sending off, and the DKIM record Resend still asks for is the
    // domain's proof of ownership.
    let created = await resend.domains.create({ name: want, capabilities: { receiving: "enabled", sending: "disabled" } });
    if (created.error) created = await resend.domains.create({ name: want, capabilities: { receiving: "enabled" } });
    if (created.error) throw new Error(`Resend would not add ${want}: ${created.error.message}`);
    notes.push(`Added ${want} to Resend.`);
  } else if (existing.capabilities?.receiving !== "enabled") {
    const upd = await resend.domains.update({ id: existing.id, capabilities: { receiving: "enabled" } });
    if (upd.error) throw new Error(`Could not turn on receiving for ${want}: ${upd.error.message}`);
    notes.push(`Turned on receiving for ${want}.`);
  } else {
    notes.push(`${want} is already set up on Resend.`);
  }

  let signingSecret: string | null = null;
  const { data: hooks } = await resend.webhooks.list();
  const hookList = ((hooks as any)?.data ?? []) as { id: string; endpoint: string }[];
  if (!hookList.some((h) => h.endpoint === endpoint)) {
    const made = await resend.webhooks.create({ endpoint, events: ["email.received"] });
    if (made.error) throw new Error(`Could not add the webhook: ${made.error.message}`);
    signingSecret = made.data?.signing_secret ?? null;
    notes.push("Added the webhook that delivers each email to the platform.");
  } else {
    notes.push("The webhook already exists.");
  }

  return { status: await readInboundStatus(), signingSecret, notes };
}

/** Ask Resend to re-check the DNS records now. */
export async function verifyInboundDomain(): Promise<InboundStatus> {
  const resend = client();
  const before = await readInboundStatus();
  if (before.domainId) await resend.domains.verify(before.domainId).catch(() => undefined);
  return readInboundStatus();
}
