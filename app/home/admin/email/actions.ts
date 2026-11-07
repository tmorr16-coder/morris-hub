"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/supabase/auth-utils";
import { setUpInboundEmail, verifyInboundDomain, type InboundStatus } from "@/lib/inbound-email";

/** Create the receiving domain and the webhook on Resend. Admins only. */
export async function setUpEmailDoor(): Promise<{ error?: string; status?: InboundStatus; signingSecret?: string | null; notes?: string[] }> {
  try {
    await requireAdmin();
    const r = await setUpInboundEmail();
    revalidateTag("inbound-receiving-domain", "max");
    revalidatePath("/home/admin/email");
    return r;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not set up the email door" };
  }
}

/** Re-check the DNS records with Resend. Admins only. */
export async function checkEmailDoor(): Promise<{ error?: string; status?: InboundStatus }> {
  try {
    await requireAdmin();
    const status = await verifyInboundDomain();
    revalidateTag("inbound-receiving-domain", "max");
    revalidatePath("/home/admin/email");
    return { status };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not check the email door" };
  }
}
