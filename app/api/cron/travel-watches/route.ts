import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { amadeusConfigured, cheapestFlightPrice } from "@/lib/amadeus";
import { Resend } from "resend";

export const runtime = "nodejs";
export const maxDuration = 60;

const MONEY = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const RENOTIFY_MS = 24 * 60 * 60 * 1000;

// Re-price active flight watches and email the user when a fare hits target.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!amadeusConfigured()) {
    return NextResponse.json({ ok: true, skipped: "amadeus_not_configured" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: watches } = await service
    .schema("travel").from("price_watches")
    .select("*")
    .eq("active", true)
    .eq("kind", "flight")
    .not("target_price", "is", null)
    .limit(40);

  const admin = createAdminClient();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const from = process.env.RESEND_FROM_EMAIL ?? "noreply@resend.dev";

  let checked = 0, notified = 0;

  for (const w of watches ?? []) {
    if (!w.origin || !w.destination || !w.depart_date) continue;
    let price: number | null = null;
    try {
      price = await cheapestFlightPrice({
        origin: w.origin,
        destination: w.destination,
        departDate: w.depart_date,
        returnDate: w.return_date ?? undefined,
        adults: w.adults ?? 1,
        cabin: w.cabin ?? "ECONOMY",
      });
    } catch {
      continue; // transient — try again next run
    }
    checked++;

    const update: Record<string, unknown> = { last_price: price, last_checked: new Date().toISOString() };

    const hit = price != null && w.target_price != null && price <= Number(w.target_price);
    const recentlyNotified = w.notified_at && Date.now() - new Date(w.notified_at).getTime() < RENOTIFY_MS;

    if (hit && w.notify && !recentlyNotified && resend) {
      try {
        const { data: u } = await admin.auth.admin.getUserById(w.user_id);
        const email = u?.user?.email;
        if (email) {
          const route = `${w.origin} → ${w.destination}`;
          await resend.emails.send({
            from,
            to: email,
            subject: `✈️ Fare alert: ${route} at ${MONEY(price!)}`,
            html: `<p>Good news — a flight you're watching just hit your target.</p>
              <p><strong>${route}</strong><br/>Departs ${w.depart_date}${w.return_date ? ` · returns ${w.return_date}` : ""}<br/>
              Now <strong>${MONEY(price!)}</strong> (your target: ${MONEY(Number(w.target_price))}).</p>
              <p><a href="https://morrisai.family/travel/search">Search & book →</a></p>`,
          });
          update.notified_at = new Date().toISOString();
          notified++;
        }
      } catch { /* email failure shouldn't block the price update */ }
    }

    await service
      .schema("travel").from("price_watches")
      .update(update).eq("id", w.id);
  }

  return NextResponse.json({ ok: true, checked, notified });
}
