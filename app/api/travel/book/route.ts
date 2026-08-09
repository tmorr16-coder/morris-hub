import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { duffelConfigured, confirmOffer } from "@/lib/duffel";
import { stripeConfigured, createPaymentIntent } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Start a booking. This is the Phase-2 purchase entry point, deliberately GATED:
 * until BOTH a Duffel token and Stripe keys are configured it returns
 * `booking_not_live` and never touches money. When live, it re-prices the offer,
 * records a draft booking, and creates a Stripe PaymentIntent for the client to
 * confirm; ticket issuance (Duffel createOrder) happens after payment succeeds.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const missing: string[] = [];
  if (!duffelConfigured()) missing.push("Duffel");
  if (!stripeConfigured()) missing.push("Stripe");
  if (missing.length) {
    return NextResponse.json({
      error: "booking_not_live",
      message: `In-app booking isn't live yet — waiting on ${missing.join(" + ")}. You can still book via the one-tap handoff links.`,
    }, { status: 503 });
  }

  let body: { kind?: string; offer_id?: string; traveler_ids?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (body.kind !== "flight" || !body.offer_id) {
    return NextResponse.json({ error: "Provide kind:'flight' and offer_id" }, { status: 400 });
  }

  // Re-price the offer (prices can move or expire before purchase).
  const priced = await confirmOffer(body.offer_id).catch(() => null);
  if (!priced) return NextResponse.json({ error: "offer_expired", message: "That fare is no longer available — please search again." }, { status: 409 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any;
  const { data: booking, error: bErr } = await service
    .schema("travel").from("bookings")
    .insert({
      user_id: user.id, // scoping-ok: user-scoped write
      kind: "flight", status: "awaiting_payment", provider: "duffel",
      offer_id: body.offer_id, traveler_ids: body.traveler_ids ?? [],
      amount: priced.price, currency: priced.currency,
    })
    .select("id").single();
  if (bErr) return NextResponse.json({ error: "Failed to start booking" }, { status: 500 });

  const pi = await createPaymentIntent(priced.price, priced.currency, { booking_id: booking.id, user_id: user.id });
  await service.schema("travel").from("bookings")
    .update({ stripe_payment_intent: pi.id }).eq("id", booking.id).eq("user_id", user.id); // scoping-ok: user-scoped write

  return NextResponse.json({
    booking_id: booking.id,
    amount: priced.price,
    currency: priced.currency,
    client_secret: pi.clientSecret, // client confirms payment; ticket issues after
  });
}
