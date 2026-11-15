import { createHash } from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { recordFailure, clearFailures } from "@/lib/system-events";
import { childForGuardian, listChildrenForParent } from "@/app/children/_lib/children";
import { readSchoolDocument, MAX_PAGES, MAX_TOTAL, type DocumentPart } from "@/app/children/_lib/read-document";
import { createDocumentFor } from "@/app/children/_lib/learning-core";
import { receivingDomain, intendedInboundDomain } from "@/lib/inbound-email";
import { publicOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
export const maxDuration = 300;

/* eslint-disable @typescript-eslint/no-explicit-any */

// The email door for a child's school documents.
//
// The teacher's weekly newsletter arrives in a parent's inbox. Forwarding it
// to the child's address — jaxon@in.morrisai.family — puts it through the
// same read as a photographed page: the spelling list, the dates, the
// teacher's requests, the practice that follows. A Gmail filter can forward
// every email from the teacher automatically, so nobody has to remember.
//
// How it is wired: a subdomain's MX record points at Resend, which stores the
// email and POSTs an `email.received` event here, signed. Only the metadata
// comes in the event; the body and attachments are fetched from Resend's API.
//
// Who may use it: the sender must be a signed-up parent, and the address must
// name one of that parent's children. Anyone else's email is logged on the
// status page and dropped — an inbound address is public the moment it is
// used, and this one creates reminders and to-dos in a family's home.
//
// Needs only RESEND_API_KEY, which the platform already holds for sending;
// the domain and the webhook are created from Home → Admin → Email door.
// RESEND_WEBHOOK_SECRET is optional: with it, every event's signature is
// checked; without it, an event is still only a pointer to an email in our
// own Resend inbox — the body and attachments are fetched back from Resend
// by id, so a forged event can at most make us re-read our own mail, which
// the duplicate checks below make a no-op.

/** Unsigned events are throttled per source address so a flood costs nothing. */
const unsignedHits = new Map<string, number[]>();
function allowUnsigned(ip: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (unsignedHits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  unsignedHits.set(ip, arr);
  return true;
}
/** Gmail sends a confirmation email before it will forward anywhere. The code in it is what the parent needs. */
const GMAIL_FORWARDING = /forwarding-noreply@google\.com/i;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function addressOf(s: string): string {
  const m = /<([^>]+)>/.exec(s);
  return (m ? m[1] : s).trim().toLowerCase();
}

/** HTML newsletter → readable text. Rough, and enough for a reader that sees prose. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Tell the parent who forwarded it what happened. The email door works out
 * of sight, so without this the only way to know a newsletter had landed was
 * to go and look. Sent as a reply in the same thread, so it sits under the
 * newsletter in the parent's inbox. Never throws.
 */
async function replyTo(resend: Resend, mail: { from: string; subject: string; message_id: string }, subject: string, lines: string[], link?: { href: string; label: string }) {
  try {
    const from = process.env.RESEND_FROM_EMAIL ?? "noreply@resend.dev";
    const html = `<div style="font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#1c1c1e">${lines.map((l) => `<p style="margin:0 0 10px">${l}</p>`).join("")}${link ? `<p style="margin:16px 0"><a href="${link.href}" style="background:#007aff;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">${esc(link.label)}</a></p>` : ""}<p style="margin:16px 0 0;color:#8e8e93;font-size:13px">Sent by morrisai.family because you forwarded this to a child's school address.</p></div>`;
    await resend.emails.send({
      from, to: mail.from, subject,
      html,
      headers: { "In-Reply-To": mail.message_id, References: mail.message_id },
    });
  } catch (e) {
    console.error(JSON.stringify({ inbound: "reply-failed", detail: e instanceof Error ? e.message : String(e) }));
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const resend = new Resend(apiKey);
  const payload = await req.text();
  let event: any;
  if (secret) {
    try {
      event = resend.webhooks.verify({
        payload,
        headers: {
          id: req.headers.get("svix-id") ?? "",
          timestamp: req.headers.get("svix-timestamp") ?? "",
          signature: req.headers.get("svix-signature") ?? "",
        },
        webhookSecret: secret,
      });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!allowUnsigned(ip)) return NextResponse.json({ error: "Slow down" }, { status: 429 });
    try { event = JSON.parse(payload); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  }
  if (event?.type !== "email.received") return NextResponse.json({ ok: true, ignored: event?.type ?? "unknown" });

  const emailId = String(event?.data?.email_id ?? event?.data?.id ?? "");
  if (!emailId) return NextResponse.json({ error: "No email id" }, { status: 400 });

  // Answer now; read the document afterwards. The read takes up to a minute
  // and a webhook that waits for it would be retried, which would mean the
  // same newsletter twice.
  after(() => processEmail(resend, emailId));
  return NextResponse.json({ ok: true });
}

async function processEmail(resend: Resend, emailId: string) {
  const svc = createServiceClient() as any;
  const note = (message: string, detail: Record<string, unknown> = {}, severity: "warning" | "error" = "warning") =>
    recordFailure({ source: "children", subject: "inbound-email", severity, message, detail: { emailId, ...detail } });

  const { data: mail, error } = await resend.emails.receiving.get(emailId);
  if (error || !mail) { await note(`Forwarded email could not be fetched: ${error?.message ?? "no data"}`); return; }
  // The door's domain, as Resend has it; the intended name if the cache is cold.
  const DOMAIN = ((await receivingDomain()) ?? intendedInboundDomain()).toLowerCase();

  const from = addressOf(mail.from ?? "");
  const subject = (mail.subject ?? "").trim();
  const bodyText = (mail.text?.trim() || htmlToText(mail.html ?? "")).slice(0, 12_000);

  // Gmail's forwarding handshake: surface the code where the parent will see it.
  if (GMAIL_FORWARDING.test(from)) {
    const code = /\b(\d{6,10})\b/.exec(bodyText)?.[1] ?? null;
    await note(code ? `Gmail forwarding confirmation code: ${code}` : `Gmail forwarding confirmation received — open it in Resend to read the code`, { subject, code });
    return;
  }

  // Who sent it — a parent on the platform, or nobody we act for.
  const { data: usersPage } = await svc.auth.admin.listUsers({ perPage: 200 });
  const sender = ((usersPage?.users ?? []) as any[]).find((u) => (u.email ?? "").toLowerCase() === from);
  if (!sender) { await note(`Email from ${from} ignored: not a parent on the platform`, { subject }); return; }

  // Which child — the address names one: first name, optionally "-" and the
  // start of the child's id for a household with two of the same name.
  const ours = [...(mail.to ?? []), ...((mail as any).received_for ?? []), ...(mail.cc ?? [])]
    .map(addressOf).filter((a) => a.endsWith(`@${DOMAIN}`));
  const local = ours[0]?.split("@")[0]?.split("+")[0] ?? "";
  const [nameToken, idToken] = local.split(/[-.]/);
  const children = await listChildrenForParent(sender.id, new Date());
  const matches = children.filter((c) => {
    const first = (c.name.split(/\s+/)[0] ?? "").toLowerCase();
    if (first !== (nameToken ?? "").toLowerCase()) return false;
    return !idToken || c.childId.replace(/-/g, "").toLowerCase().startsWith(idToken.toLowerCase());
  });
  const re = `Re: ${subject || "your forwarded email"}`;
  const fail = async (why: string) => replyTo(resend, mail, re, [`<strong>That one didn't go in.</strong>`, esc(why)], { href: `${publicOrigin()}/home/admin/status`, label: "Open platform status" });
  if (matches.length !== 1) {
    await fail(matches.length === 0 ? `No child of yours matches ${ours[0] ?? "that address"}.` : `Two children match ${ours[0]}; the address needs the longer form shown on the import screen.`);
    await note(matches.length === 0 ? `No child matches the address ${ours[0] ?? "(none at our domain)"}` : `The address ${ours[0]} matches ${matches.length} children — add the id: ${matches.map((c) => `${nameToken}-${c.childId.slice(0, 8)}`).join(", ")}`, { subject, from, userId: sender.id });
    return;
  }
  const childId = matches[0].childId;
  const child = await childForGuardian(svc, childId, sender.id);
  if (!child) { await fail("You are not set up as a guardian for that child."); await note(`Sender may not act for the child named in ${ours[0]}`, { subject, from }); return; }

  // Already have this one? The message id is the surest sign; the bytes of the
  // attachments come next (the same PDF forwarded twice has a new message id).
  const { data: dupe } = await svc.schema("hub").from("child_documents")
    .select("id").eq("child_id", childId).eq("extracted->email->>message_id", mail.message_id).limit(1);
  if (dupe?.[0]) { await replyTo(resend, mail, re, ["Already have this one — it was read the first time it arrived, so nothing was added twice."], { href: `${publicOrigin()}/children/${childId}`, label: `Open ${matches[0].name.split(" ")[0]}'s page` }); console.log(JSON.stringify({ inbound: "duplicate-message", childId, emailId })); return; }

  // The document: PDFs and real pictures first, then the email's own text.
  // Inline images are mostly logos and signatures; only a big one is a page.
  const parts: DocumentPart[] = [];
  const hashes: string[] = [];
  let total = 0;
  const { data: list } = await resend.emails.receiving.attachments.list({ emailId });
  const attachments = ((list as any)?.data ?? (Array.isArray(list) ? list : [])) as { id: string; filename?: string; content_type: string; content_disposition?: string; size: number; download_url: string }[];
  const ranked = attachments
    .filter((a) => a.content_type === "application/pdf" || IMAGE_TYPES.has(a.content_type))
    .filter((a) => a.content_disposition !== "inline" || a.size > 150_000)
    .sort((a, b) => Number(b.content_type === "application/pdf") - Number(a.content_type === "application/pdf") || b.size - a.size);
  for (const a of ranked) {
    if (parts.length >= MAX_PAGES) break;
    if (total + a.size > MAX_TOTAL) continue;
    const res = await fetch(a.download_url);
    if (!res.ok) continue;
    const data = Buffer.from(await res.arrayBuffer());
    total += data.byteLength;
    hashes.push(sha(data));
    parts.push(a.content_type === "application/pdf" ? { type: "pdf", data } : { type: "image", mediaType: a.content_type as any, data });
  }
  if (bodyText.length > 40) {
    parts.push({ type: "text", text: `Subject: ${subject}\n\n${bodyText}` });
    hashes.push(sha(bodyText.replace(/\s+/g, " ").toLowerCase()));
  }
  if (parts.length === 0) { await fail("There was nothing to read in it — no PDF, no pictures, and almost no text."); await note(`Email "${subject}" had nothing to read (no PDF, pictures or text)`, { from, childId }); return; }

  const { data: sameBytes } = await svc.schema("hub").from("child_documents")
    .select("id, title").eq("child_id", childId).overlaps("page_hashes", hashes).limit(1);
  if (sameBytes?.[0]) { await replyTo(resend, mail, re, [`Already have this one — it matches “${esc(sameBytes[0].title)}”, so nothing was added twice.`], { href: `${publicOrigin()}/children/${childId}`, label: `Open ${matches[0].name.split(" ")[0]}'s page` }); console.log(JSON.stringify({ inbound: "duplicate-bytes", childId, emailId, as: sameBytes[0].id })); return; }

  const read = await readSchoolDocument(child, parts, { userId: sender.id, source: "email" });
  if ("error" in read) { await fail(`It could not be read: ${read.error}`); await note(`Could not read "${subject}": ${read.error}`, { from, childId }, "error"); return; }

  // Everything the reader proposed is adopted, with the dates as reminders and
  // the practice as to-dos — the same defaults the import screen starts with.
  // The parent can prune on the workspace, exactly as after an upload.
  const x = read.extraction;
  const saved = await createDocumentFor(svc, sender.id, child, {
    childId,
    extraction: x,
    exerciseIndexes: x.exercises.map((_, i) => i),
    addDateReminders: true,
    addPracticeTodos: true,
    pageHashes: hashes,
    provenance: { email: { message_id: mail.message_id, from, subject, received_at: mail.created_at, email_id: emailId } },
  });
  if ("error" in saved) { await fail(`It was read but could not be saved: ${saved.error}`); await note(`Could not save "${subject}": ${saved.error}`, { from, childId }, "error"); return; }

  await clearFailures("children", "inbound-email").catch(() => undefined);

  const first = matches[0].name.split(" ")[0];
  const sp = x.spelling;
  const lines = [
    `<strong>${esc(x.title || "The newsletter")}</strong> is on ${esc(first)}'s page.`,
    ...(x.summary ? [esc(x.summary)] : []),
    ...(sp && sp.words.length ? [`Spelling${sp.pattern ? ` (${esc(sp.pattern)})` : ""}: ${esc(sp.words.join(", "))}${sp.test_on ? ` — test ${esc(sp.test_on)}` : ""}.`] : []),
    `Added ${saved.reminders} reminder${saved.reminders === 1 ? "" : "s"} and ${saved.todos} to-do${saved.todos === 1 ? "" : "s"}${x.exercises.length ? `, and ${x.exercises.length} practice idea${x.exercises.length === 1 ? "" : "s"}` : ""}. Remove anything you don't want from ${esc(first)}'s page.`,
    ...(saved.rolledOver && saved.rolledOver.exerciseIds.length + saved.rolledOver.taskIds.length + saved.rolledOver.todoIds.length > 0
      ? [`It's a new week, so last week's ${saved.rolledOver.exerciseIds.length} practice item${saved.rolledOver.exerciseIds.length === 1 ? "" : "s"}, ${saved.rolledOver.taskIds.length} unfinished job${saved.rolledOver.taskIds.length === 1 ? "" : "s"} and ${saved.rolledOver.todoIds.length} to-do${saved.rolledOver.todoIds.length === 1 ? "" : "s"} were put away. Nothing was deleted.`]
      : []),
  ];
  await replyTo(resend, mail, `Added: ${x.title || subject}`, lines, { href: `${publicOrigin()}/children/${childId}`, label: `Open ${first}'s page` });
  console.log(JSON.stringify({ inbound: "saved", childId, documentId: saved.documentId, kind: x.kind, reminders: saved.reminders, todos: saved.todos }));
}
