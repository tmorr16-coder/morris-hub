export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/supabase/auth-utils";
import { IOSScreen, LargeTitle, TabBar } from "@/components/ios";
import { publicOrigin } from "@/lib/site-url";
import { readInboundStatus, type InboundStatus } from "@/lib/inbound-email";
import { listChildrenForParent } from "@/app/children/_lib/children";
import { inboundAddressFor } from "@/app/children/_lib/inbound-address";
import EmailDoorClient from "./_components/EmailDoorClient";

/**
 * The email door — forwarded school email becomes a read document.
 *
 * Admin-only because it creates things on the Resend account and names the
 * registrar's records. The screen does the Resend half itself and lays out
 * the DNS half for the one person who can do it.
 */
export default async function EmailDoorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(await isCurrentUserAdmin())) redirect("/home");

  const apex = new URL(publicOrigin()).host.replace(/^www\./, "");
  let status: InboundStatus;
  let readError: string | null = null;
  try {
    status = await readInboundStatus();
  } catch (e) {
    readError = e instanceof Error ? e.message : String(e);
    status = { configured: true, domain: null, domainId: null, domainStatus: null, receiving: false, records: [], webhookEndpoint: `${publicOrigin()}/api/email/inbound`, webhookId: null, live: false };
  }
  const kids = status.live && status.domain
    ? (await listChildrenForParent(user.id, new Date())).map((c, _i, all) => ({ name: c.name, address: inboundAddressFor(c.childId, c.name, all, status.domain!) }))
    : [];

  return (
    <IOSScreen>
      <LargeTitle title="Email door" subtitle="Forward a teacher's email; the platform reads it" />
      {readError && <p className="ios-footnote" style={{ color: "var(--ios-red)", margin: "0 16px 8px" }}>Resend could not be read: {readError}</p>}
      <EmailDoorClient initial={status} apex={apex} kids={kids} />
      <div style={{ height: 24 }} />
      <TabBar current="more" currentUserId={user.id} sourceApp="hub" />
    </IOSScreen>
  );
}
