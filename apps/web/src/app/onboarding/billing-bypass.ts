/**
 * Local dev without Stripe: the subscription step can't open Checkout, so the flow offers a
 * clearly-labelled dev-only finish. Never true in production — STRIPE_SECRET_KEY is required
 * there and NODE_ENV is "production". Plain module (not a server action) on purpose.
 */
export function billingBypassAllowed(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.STRIPE_SECRET_KEY;
}
