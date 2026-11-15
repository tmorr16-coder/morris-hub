import "server-only";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

// Fetching a URL a person typed in.
//
// A server that fetches whatever URL it is handed will fetch its own
// internals too: the cloud metadata endpoint, a database on a private
// address, localhost. Checking the hostname as text does not stop that —
// "2130706433", "0x7f.1", a public name that resolves to 10.0.0.5, or a
// harmless page that redirects to 169.254.169.254 all get past a string test.
//
// So the check is made on the address actually connected to. The DNS lookup
// used for the connection itself rejects any non-public address, which also
// closes the rebinding gap between "check" and "connect". Literal IPs skip
// DNS, so they are checked before the request. Redirects are followed by
// hand, each one re-checked from the top.

const BLOCKED = new net.BlockList();
for (const [range, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) BLOCKED.addSubnet(range, bits, "ipv4");
for (const [range, bits] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) BLOCKED.addSubnet(range, bits, "ipv6");

/** True only for an address on the public internet. Anything unparseable is not. */
export function isPublicAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").split("%")[0];
  const v4mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped) return isPublicAddress(v4mapped[1]);
  const family = net.isIP(ip);
  if (family === 4) return !BLOCKED.check(ip, "ipv4");
  if (family === 6) {
    // ::ffff:7f00:1 is 127.0.0.1 written in hex.
    if (/^::ffff:/i.test(ip)) return false;
    return !BLOCKED.check(ip, "ipv6");
  }
  return false;
}

export class UnsafeUrlError extends Error {}

/** Parse and vet a URL before any network activity. Throws UnsafeUrlError. */
export function vetPublicUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(String(raw).trim()); } catch { throw new UnsafeUrlError("That is not a valid URL."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http and https links can be fetched.");
  if (url.username || url.password) throw new UnsafeUrlError("Links with embedded credentials are not fetched.");
  if (url.port && !["80", "443"].includes(url.port)) throw new UnsafeUrlError("Only standard web ports are fetched.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("That address is not on the public internet.");
  }
  // WHATWG URL already turned "2130706433" and "0x7f.1" into dotted form.
  if (net.isIP(host) && !isPublicAddress(host)) throw new UnsafeUrlError("That address is not on the public internet.");
  return url;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

function publicOnlyLookup(hostname: string, options: { all?: boolean } & Record<string, unknown>, cb: LookupCb) {
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return cb(err, "");
    if (!addresses.length) return cb(Object.assign(new Error(`No address for ${hostname}`), { code: "ENOTFOUND" }), "");
    // One private answer poisons the lot: a resolver returning a mix is exactly
    // what a rebinding attack looks like.
    if (addresses.some((a) => !isPublicAddress(a.address))) {
      return cb(Object.assign(new UnsafeUrlError("That address is not on the public internet."), { code: "EUNSAFE" }), "");
    }
    if (options?.all) return cb(null, addresses);
    cb(null, addresses[0].address, addresses[0].family);
  });
}

export interface PublicFetchResult {
  ok: boolean;
  status: number;
  contentType: string;
  text: string;
  finalUrl: string;
  truncated: boolean;
}

/**
 * GET a user-supplied URL, as text, refusing anything that is not on the
 * public internet at every hop. Bounded in time, size and redirects.
 */
export async function fetchPublicText(
  raw: string,
  { timeoutMs = 8000, maxBytes = 2_000_000, maxRedirects = 3, headers = {} as Record<string, string> } = {},
): Promise<PublicFetchResult> {
  const deadline = Date.now() + timeoutMs;
  let url = vetPublicUrl(raw);

  for (let hop = 0; ; hop++) {
    const res = await requestOnce(url, Math.max(1, deadline - Date.now()), maxBytes, headers);
    if (res.status >= 300 && res.status < 400 && res.location) {
      if (hop >= maxRedirects) throw new UnsafeUrlError("Too many redirects.");
      url = vetPublicUrl(new URL(res.location, url).toString());
      continue;
    }
    return { ok: res.status >= 200 && res.status < 300, status: res.status, contentType: res.contentType, text: res.body, finalUrl: url.toString(), truncated: res.truncated };
  }
}

function requestOnce(url: URL, timeoutMs: number, maxBytes: number, headers: Record<string, string>) {
  return new Promise<{ status: number; location: string | null; contentType: string; body: string; truncated: boolean }>((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(url, {
      method: "GET",
      headers: { Accept: "text/html,text/plain;q=0.9,*/*;q=0.5", ...headers },
      lookup: publicOnlyLookup as unknown as typeof dnsLookup,
      timeout: timeoutMs,
    }, (res) => {
      const status = res.statusCode ?? 0;
      const location = typeof res.headers.location === "string" ? res.headers.location : null;
      const contentType = String(res.headers["content-type"] ?? "");
      if (status >= 300 && status < 400) { res.resume(); return resolve({ status, location, contentType, body: "", truncated: false }); }
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      res.on("data", (c: Buffer) => {
        if (truncated) return;
        size += c.length;
        if (size > maxBytes) { truncated = true; chunks.push(c.subarray(0, c.length - (size - maxBytes))); res.destroy(); return; }
        chunks.push(c);
      });
      const done = () => resolve({ status, location, contentType, body: Buffer.concat(chunks).toString("utf8"), truncated });
      res.on("end", done);
      res.on("close", () => { if (truncated) done(); });
      res.on("error", (e) => (truncated ? done() : reject(e)));
    });
    const timer = setTimeout(() => req.destroy(new Error("Timed out fetching the link.")), timeoutMs);
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", () => req.destroy(new Error("Timed out fetching the link.")));
    req.on("error", reject);
    req.end();
  });
}
