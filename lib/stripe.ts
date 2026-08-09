// Minimal Stripe helper for travel booking (Phase 2). Uses the REST API via
// fetch so no SDK dependency is required. Gated on STRIPE_SECRET_KEY — every
// caller must check stripeConfigured() first, so nothing can charge until keys
// are set. The app collects the traveler's payment here, then funds the Duffel
// order from the Duffel balance.

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  status: string;
}

/** Create a PaymentIntent for a booking amount (in major units, e.g. 429.00). */
export async function createPaymentIntent(
  amountMajor: number,
  currency: string,
  metadata: Record<string, string>,
): Promise<PaymentIntent> {
  const form = new URLSearchParams();
  form.set("amount", String(Math.round(amountMajor * 100))); // Stripe uses minor units
  form.set("currency", currency.toLowerCase());
  form.set("automatic_payment_methods[enabled]", "true");
  for (const [k, v] of Object.entries(metadata)) form.set(`metadata[${k}]`, v);

  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Stripe failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const pi = await res.json();
  return { id: pi.id, clientSecret: pi.client_secret, status: pi.status };
}
