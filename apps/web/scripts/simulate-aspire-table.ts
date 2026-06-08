/**
 * Simulates Aspire search → table row mapping (no browser required).
 * Run: pnpm --filter @vantera/web exec tsx scripts/simulate-aspire-table.ts
 */
import {
  extractEmail,
  extractLinkedIn,
  extractPhone,
  readProspectContact,
} from '../lib/aspire/contact-fields'
import { normalizeProspectFilters } from '../lib/aspire/filters'
import { toEnrichedAspireSearchResult } from '../lib/aspire/enrich-prospect'
import { hydrateAspireSearchResult } from '../lib/aspire/hydrate-result'
import { stubResults } from '../lib/aspire/prospect-stubs'
import type { AspireSearchResult } from '../lib/aspire/types'

function companyName(row: AspireSearchResult): string {
  return row.organizationName ?? row.company ?? 'Unknown'
}

/** Mirrors AspirePageClient row mapping. */
function toTableRows(results: AspireSearchResult[]) {
  return results.map((r, i) => ({
    ...r,
    id: r.id || `${r.email ?? r.linkedinUrl ?? i}-${companyName(r)}`,
    icpScore: r.icpScore ?? r.intentScore ?? 0,
  }))
}

function printTable(rows: ReturnType<typeof toTableRows>) {
  console.log('\nAspire output table simulation')
  console.log('─'.repeat(100))
  console.log(
    ['Name', 'Title', 'Company', 'Email', 'Phone', 'LinkedIn', 'ICP'].map((h) => h.padEnd(16)).join(''),
  )
  console.log('─'.repeat(100))
  for (const row of rows) {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown'
    console.log(
      [
        name.slice(0, 16),
        (row.title || '—').slice(0, 16),
        companyName(row).slice(0, 16),
        (row.email || '—').slice(0, 16),
        (row.phone || '—').slice(0, 16),
        row.linkedinUrl ? 'yes' : '—',
        String(row.icpScore),
      ]
        .map((c) => c.padEnd(16))
        .join(''),
    )
  }
  console.log('─'.repeat(100))
  console.log(`Rows: ${rows.length}`)
}

function mapApifySample(raw: Record<string, unknown>): AspireSearchResult {
  const contact = readProspectContact(raw)
  return toEnrichedAspireSearchResult(
    {
      id: `email:${contact.email}`,
      firstName: String(raw.first_name ?? ''),
      lastName: String(raw.last_name ?? ''),
      title: String(raw.job_title ?? ''),
      email: contact.email,
      phone: contact.phone,
      linkedinUrl: contact.linkedinUrl,
      organizationName: String(raw.company_name ?? 'Unknown'),
      organizationId: null,
      websiteUrl: null,
      city: typeof raw.city === 'string' ? raw.city : null,
      state: typeof raw.state === 'string' ? raw.state : null,
      employeeCount: null,
      revenue: null,
      industry: typeof raw.industry === 'string' ? raw.industry : null,
      technologies: [],
      photoUrl: null,
    },
    80,
    ['Has email', 'Has phone', 'LinkedIn profile'],
  )
}

async function main() {
  let passed = 0
  let failed = 0

  function assert(label: string, ok: boolean, detail?: string) {
    if (ok) {
      passed += 1
      console.log(`✓ ${label}`)
    } else {
      failed += 1
      console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
    }
  }

  console.log('=== Aspire table simulation ===\n')

  // 1) Stub path (no APIFY_API_TOKEN — same as production fallback)
  const filters = normalizeProspectFilters('agency', { q: 'marketing' }, { interactive: true })
  const stubPeople = stubResults(filters)
  const stubRows = toTableRows(
    stubPeople.map((p) => toEnrichedAspireSearchResult(p, 72, ['Has email'])),
  )

  assert('Stub search returns leads for table', stubRows.length > 0, `got ${stubRows.length}`)
  assert('Table rows have stable ids', stubRows.every((r) => r.id.length > 0))
  assert(
    'Contact columns populated (email / phone / LinkedIn)',
    stubRows.some((r) => r.email) &&
      stubRows.some((r) => r.phone) &&
      stubRows.some((r) => r.linkedinUrl),
  )

  printTable(stubRows.slice(0, 5))

  // 2) Apify payload → table columns
  const apifyRaw = {
    first_name: 'Casey',
    last_name: 'Nguyen',
    job_title: 'Marketing Director',
    email: 'casey@acme.io',
    mobile_number: '+1 555 0100',
    linkedin: 'linkedin.com/in/caseynguyen',
    company_name: 'Acme Co',
    industry: 'Marketing',
  }

  assert('Extract email from Apify row', extractEmail(apifyRaw) === 'casey@acme.io')
  assert('Extract phone from Apify row', Boolean(extractPhone(apifyRaw)))
  assert('Extract LinkedIn from Apify row', Boolean(extractLinkedIn(apifyRaw)?.includes('linkedin.com')))

  const apifyRow = mapApifySample(apifyRaw)
  printTable(toTableRows([apifyRow]))

  // 3) Stored aspire_results → hydrate → table (saved search / scout inbox path)
  const hydrated = hydrateAspireSearchResult({
    id: 'db-row-1',
    apifyId: apifyRow.id,
    icpScore: 80,
    icpSignals: ['Has email', 'Has phone'],
    status: 'found',
    rawData: apifyRow,
  })
  const hydratedRows = toTableRows([hydrated])
  assert('Hydrated DB row appears in table', hydratedRows.length === 1)
  assert('Hydrated row shows email column', hydratedRows[0]?.email === 'casey@acme.io')
  assert('Hydrated row shows phone column', hydratedRows[0]?.phone === '+1 555 0100')
  assert('Hydrated row shows LinkedIn column', Boolean(hydratedRows[0]?.linkedinUrl))

  printTable(hydratedRows)

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
  console.log('Aspire UI uses displayLeads → rows → OperationalTable with these same fields.\n')

  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
