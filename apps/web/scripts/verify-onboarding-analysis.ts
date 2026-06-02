/**
 * Quick sanity checks for onboarding URL analysis helpers.
 * Run: pnpm exec tsx apps/web/scripts/verify-onboarding-analysis.ts
 */
import { parseWebsiteSnapshotHtml } from '../lib/onboarding/parse-website-snapshot'
import { buildAnalysisFromAccount } from '../lib/onboarding/onboarding-analysis-utils'

const sampleHtml = `<!doctype html>
<html>
  <head>
    <title>Cool Air HVAC | Denver Heating & Cooling</title>
    <meta name="description" content="Residential and commercial HVAC repair, install, and maintenance in Denver." />
  </head>
  <body>
    <h1>Denver's trusted HVAC team</h1>
    <h2>24/7 emergency service</h2>
    <p>We help homeowners and property managers stay comfortable year-round with fast response times.</p>
  </body>
</html>`

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const snapshot = parseWebsiteSnapshotHtml('https://coolairhvac.com', sampleHtml)

assert(snapshot.title?.includes('HVAC') === true, 'expected HVAC in parsed title')
assert(snapshot.description?.includes('HVAC') === true, 'expected HVAC in meta description')
assert(snapshot.headings.length >= 2, 'expected headings from sample HTML')
assert(snapshot.excerpt?.includes('homeowners') === true, 'expected body excerpt text')

const rebuilt = buildAnalysisFromAccount({
  vertical: 'hvac',
  icp_description: 'Homeowners needing emergency HVAC repair in Denver.',
  icp_summary: 'Denver homeowners with urgent HVAC needs.',
  value_proposition: 'Same-day service and maintenance plans.',
  website_url: 'https://coolairhvac.com',
})

assert(rebuilt?.vertical === 'hvac', 'expected hvac vertical when rebuilding analysis')
assert(rebuilt?.icpSummary.includes('Denver') === true, 'expected persisted icp_summary')
assert(rebuilt?.icpDescription.includes('Homeowners') === true, 'expected icp_description')

console.log('verify-onboarding-analysis: all checks passed')
console.log(JSON.stringify({ snapshot, rebuilt }, null, 2))
