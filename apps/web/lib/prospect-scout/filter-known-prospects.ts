import type { ProspectLead } from '@/lib/aspire/types'
import { filterExistingLeads } from '@/lib/aspire/search'
import { db } from '@/lib/db/client'
import { contacts, leads } from '@vantera/db'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

/**
 * Prospect IDs (email:/linkedin:/name: keys) already in this workspace — skip on new Scout runs.
 */
export async function filterKnownProspectIds(
  accountId: string,
  people: ProspectLead[],
): Promise<Set<string>> {
  if (people.length === 0) return new Set()

  const known = new Set<string>()

  const apifyIds = people.map((person) => person.id)
  for (const id of await filterExistingLeads(accountId, apifyIds)) {
    known.add(id)
  }

  const emails = [
    ...new Set(
      people
        .map((person) => person.email?.toLowerCase().trim())
        .filter((email): email is string => Boolean(email)),
    ),
  ]

  if (emails.length > 0) {
    const [leadHits, contactHits] = await Promise.all([
      db
        .select({ email: leads.email })
        .from(leads)
        .where(
          and(
            eq(leads.accountId, accountId),
            isNull(leads.deletedAt),
            inArray(sql`lower(trim(${leads.email}))`, emails),
          ),
        ),
      db
        .select({ email: contacts.email })
        .from(contacts)
        .where(
          and(
            eq(contacts.accountId, accountId),
            isNull(contacts.deletedAt),
            inArray(sql`lower(trim(${contacts.email}))`, emails),
          ),
        ),
    ])

    const emailToId = new Map<string, string>()
    for (const person of people) {
      const email = person.email?.toLowerCase().trim()
      if (email) emailToId.set(email, person.id)
    }

    for (const row of [...leadHits, ...contactHits]) {
      const email = row.email?.toLowerCase().trim()
      if (!email) continue
      const id = emailToId.get(email)
      if (id) known.add(id)
    }
  }

  return known
}

export function partitionFreshProspects(
  people: ProspectLead[],
  knownIds: Set<string>,
  excludeDomains: Set<string>,
): { fresh: ProspectLead[]; skippedKnown: number; skippedDomain: number } {
  let skippedKnown = 0
  let skippedDomain = 0
  const fresh: ProspectLead[] = []

  for (const person of people) {
    if (knownIds.has(person.id)) {
      skippedKnown += 1
      continue
    }
    const email = person.email?.toLowerCase().trim()
    const domain = email?.split('@')[1]
    if (domain && excludeDomains.has(domain)) {
      skippedDomain += 1
      continue
    }
    fresh.push(person)
  }

  return { fresh, skippedKnown, skippedDomain }
}
