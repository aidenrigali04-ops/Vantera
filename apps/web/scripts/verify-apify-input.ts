/**
 * Verifies Apify actor input uses API enum values (e.g. functional_level: marketing).
 * Run: pnpm --filter @vantera/web exec tsx scripts/verify-apify-input.ts
 */
import { normalizeApifyLocations } from '../lib/aspire/apify-locations'
import { resolveApifyKeywordTargeting } from '../lib/aspire/apify-targeting'

function assert(label: string, ok: boolean) {
  console.log(ok ? `✓ ${label}` : `✗ ${label}`)
  if (!ok) process.exitCode = 1
}

const targeting = resolveApifyKeywordTargeting('marketing')

assert(
  'functional_level uses Apify enum (marketing)',
  targeting.functional_level?.[0] === 'marketing',
)
assert(
  'functional_level is not Title Case Marketing',
  (targeting.functional_level?.[0] as string | undefined) !== 'Marketing',
)
assert('HR maps to human_resources', resolveApifyKeywordTargeting('hr').functional_level?.[0] === 'human_resources')

assert('United States → united states', normalizeApifyLocations(['United States'])[0] === 'united states')
assert('US alias → united states', normalizeApifyLocations(['US'])[0] === 'united states')
assert('Phoenix AZ → arizona, us', normalizeApifyLocations(['Phoenix AZ'])[0] === 'arizona, us')
assert('Dallas, TX → texas, us', normalizeApifyLocations(['Dallas, TX'])[0] === 'texas, us')
assert('invalid city falls back to united states', normalizeApifyLocations(['Springfield'])[0] === 'united states')
assert('empty list falls back to united states', normalizeApifyLocations(undefined)[0] === 'united states')
assert(
  'multiple scout cities resolve together',
  JSON.stringify(normalizeApifyLocations(['Phoenix AZ', 'Dallas TX'])) ===
    JSON.stringify(['arizona, us', 'texas, us']),
)

console.log('\nmarketing targeting:', JSON.stringify(targeting, null, 2))
