import { db } from '@/lib/db/client'
import { activities, aspireSearchRuns, leads } from '@vantera/db'

export type AspireSearchResult = {
  firstName: string
  lastName: string
  title: string
  company: string
  email?: string
  linkedinUrl?: string
  industry?: string
  intentScore: number
}

/** MVP stub — replace with Apollo/Clay API integration */
export async function searchProspects(
  accountId: string,
  query: Record<string, unknown>,
): Promise<AspireSearchResult[]> {
  return [
    {
      firstName: 'Alex',
      lastName: 'Chen',
      title: 'Founder',
      company: 'Northstar SaaS',
      email: 'alex@northstar.io',
      linkedinUrl: 'https://linkedin.com/in/example',
      industry: 'Software',
      intentScore: 82,
    },
    {
      firstName: 'Jordan',
      lastName: 'Reeves',
      title: 'VP Sales',
      company: 'Atlas Agency',
      email: 'jordan@atlas.co',
      industry: 'Marketing',
      intentScore: 71,
    },
  ]
}

export async function addAspireResultToPipeline(
  accountId: string,
  userId: string,
  result: AspireSearchResult,
) {
  const [lead] = await db
    .insert(leads)
    .values({
      accountId,
      firstName: result.firstName,
      lastName: result.lastName,
      title: result.title,
      company: result.company,
      email: result.email,
      linkedinUrl: result.linkedinUrl,
      source: 'aspire',
      score: result.intentScore,
      ownerId: userId,
      enrichment: { industry: result.industry },
    })
    .returning()

  await db.insert(activities).values({
    accountId,
    leadId: lead!.id,
    actorType: 'system',
    actorId: userId,
    activityType: 'aspire_added',
    body: `Added from Aspire search`,
    metadata: { company: result.company },
  })

  await db.insert(aspireSearchRuns).values({
    accountId,
    query: result,
    resultCount: 1,
  })

  return lead!
}
