import { db } from '@/lib/db/client'
import { featureFlags } from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import { FLAG_DEFAULTS, type FlagName, type Plan, getPlanDefault } from './flags'

const cache = new Map<string, { value: boolean; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

// Hard wall-time budget for evaluating the full flag set in one layout render.
// If Drizzle can't reach the DB within this window we fall back to plan
// defaults so the layout still renders — flags should never be the reason a
// signed-in user can't see the app.
const EVALUATE_ALL_TIMEOUT_MS = 2500

function getCacheKey(accountId: string, flagName: FlagName): string {
  return `${accountId}:${flagName}`
}

export async function evaluateFlag({
  accountId,
  plan,
  flagName,
}: {
  accountId: string
  plan: Plan
  flagName: FlagName
}): Promise<boolean> {
  try {
    const cacheKey = getCacheKey(accountId, flagName)
    const cached = cache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    const [row] = await db
      .select({ isEnabled: featureFlags.isEnabled })
      .from(featureFlags)
      .where(and(eq(featureFlags.accountId, accountId), eq(featureFlags.flagName, flagName)))
      .limit(1)

    const result = row ? row.isEnabled : getPlanDefault(flagName, plan)

    cache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return result
  } catch {
    return false
  }
}

export async function evaluateAllFlags({
  accountId,
  plan,
}: {
  accountId: string
  plan: Plan
}): Promise<Record<FlagName, boolean>> {
  const flagNames = Object.keys(FLAG_DEFAULTS) as FlagName[]

  const planDefaults = Object.fromEntries(
    flagNames.map((flagName) => [flagName, getPlanDefault(flagName, plan)]),
  ) as Record<FlagName, boolean>

  const evaluatePromise = (async () => {
    const entries = await Promise.all(
      flagNames.map(async (flagName) => {
        const value = await evaluateFlag({ accountId, plan, flagName })
        return [flagName, value] as const
      }),
    )
    return Object.fromEntries(entries) as Record<FlagName, boolean>
  })()

  const timeoutPromise = new Promise<Record<FlagName, boolean>>((resolve) => {
    setTimeout(() => resolve(planDefaults), EVALUATE_ALL_TIMEOUT_MS)
  })

  try {
    return await Promise.race([evaluatePromise, timeoutPromise])
  } catch {
    return planDefaults
  }
}

export function invalidateFlagCache(accountId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${accountId}:`)) {
      cache.delete(key)
    }
  }
}
