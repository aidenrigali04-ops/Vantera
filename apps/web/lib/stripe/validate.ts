import Stripe from 'stripe'

/** Verify a Stripe secret key (standard account, not Connect-only). */
export async function validateStripeSecretKey(secretKey: string): Promise<boolean> {
  const stripe = new Stripe(secretKey, { apiVersion: '2024-04-10' })
  try {
    await stripe.balance.retrieve()
    return true
  } catch {
    return false
  }
}
