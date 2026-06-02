import { env } from '@/lib/env'
import Stripe from 'stripe'

const API_VERSION = '2024-04-10' as const

/** Vantera platform billing — charges workspace owners for Team / Enterprise plans. */
export function getPlatformStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null
  return new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: API_VERSION })
}

export function assertPlatformStripe(): Stripe {
  const stripe = getPlatformStripe()
  if (!stripe) {
    throw new Error('Stripe is not configured. Add STRIPE_SECRET_KEY to your environment.')
  }
  return stripe
}

export function isPlatformStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET)
}
