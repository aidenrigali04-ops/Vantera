/**
 * Verifies Apify actor input uses API enum values (e.g. functional_level: marketing).
 * Run: pnpm --filter @vantera/web exec tsx scripts/verify-apify-input.ts
 */
import {
  normalizeApifyLocations,
  resolveApifyKeywordTargeting,
} from '../lib/aspire/apify-targeting'

function assert(label: string, ok: boolean) {
  console.log(ok ? `✓ ${label}` : `✗ ${label}`)
  if (!ok) process.exitCode = 1
}

const targeting = resolveApifyKeywordTargeting('marketing')
const locations = normalizeApifyLocations(['United States'])

assert(
  'functional_level uses Apify enum (marketing)',
  targeting.functional_level?.[0] === 'marketing',
)
assert(
  'functional_level is not Title Case Marketing',
  targeting.functional_level?.[0] !== 'Marketing',
)
assert('contact_location normalizes to united states', locations?.[0] === 'united states')
assert('HR maps to human_resources', resolveApifyKeywordTargeting('hr').functional_level?.[0] === 'human_resources')

console.log('\nmarketing targeting:', JSON.stringify(targeting, null, 2))
