import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import { sendSMSReminder } from "@/lib/sms";

export const runtime = "nodejs";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

// Send the trip nudges that have come due — check-in opening, time to leave for
// the airport, hotel check-in tomorrow. Alerts are rows queued when a segment is
// saved, so this job only decides "is it time, and did we already send it".
// Runs hourly; a missed hour still sends late rather than never.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient() as any;
  const now = new Date();
  // Don't send anything that came due more than a day ago — a check-in reminder
  // after the flight has left is worse than silence.
  const floor = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: due, error } = await db
    .schema("travel").from("trip_alerts")
    .select("*")
    .is("sent_at", null)
    .lte("send_at", now.toISOString())
    .gte("send_at", floor)
    .order("send_at", { ascending: true })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ ok: true, sent: 0 });

  const admin = createAdminClient();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@resend.dev";

  // One preferences read per user, not per alert.
  const userIds = [...new Set(due.map((a: any) => a.user_id))];
  const { data: prefRows } = await db
    .schema("travel").from("preferences")
    .select("user_id, notify_email, notify_sms, notify_checkin, notify_trip_summary")
    .in("user_id", userIds);
  const prefs = new Map((prefRows ?? []).map((p: any) => [p.user_id, p]));

  let sent = 0, skipped = 0;

  for (const alert of due) {
    const p: any = prefs.get(alert.user_id) ?? {};
    const wantsKind = alert.kind === "checkin" || alert.kind === "leave_for_airport"
      ? p.notify_checkin !== false
      : p.notify_trip_summary !== false;
    if (!wantsKind) {
      // Mark handled so it isn't reconsidered every hour.
      await db.schema("travel").from("trip_alerts").update({ sent_at: now.toISOString(), channel: "skipped" }).eq("id", alert.id);
      skipped++;
      continue;
    }

    const { data: authUser } = await admin.auth.admin.getUserById(alert.user_id);
    const email = authUser?.user?.email;
    const phone = authUser?.user?.phone ?? authUser?.user?.user_metadata?.phone;

    let channel: string | null = null;
    if (resend && email && p.notify_email !== false) {
      try {
        await resend.emails.send({
          from,
          to: email,
          subject: alert.title,
          text: `${alert.body}\n\n— morrisai.family`,
        });
        channel = "email";
      } catch (err) {
        console.error("[travel-alerts] email failed", (err as Error).message);
      }
    }
    if (p.notify_sms && phone) {
      const dueDate = new Date(alert.send_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const res = await sendSMSReminder(phone, alert.title, dueDate, undefined, alert.body).catch((err) => ({
        success: false, error: (err as Error).message,
      }));
      if (res.success) channel = channel ? `${channel}+sms` : "sms";
      else console.error("[travel-alerts] sms failed", res.error);
    }

    if (channel) {
      await db.schema("travel").from("trip_alerts").update({ sent_at: now.toISOString(), channel }).eq("id", alert.id);
      sent++;
    } else {
      // Nothing delivered — leave it unsent so the next run retries, unless it
      // is about to age out of the window anyway.
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, due: due.length, sent, skipped });
}
