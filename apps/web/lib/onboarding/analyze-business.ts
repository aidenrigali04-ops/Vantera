import 'server-only'

import { callModel, parseJsonResponse } from '@/lib/ai/client'

export const ONBOARDING_VERTICALS = [
  'agency',
  'hvac',
  'landscaping',
  'plumbing',
  'construction',
  'property_mgmt',
  'real_estate',
] as const

export type OnboardingVertical = (typeof ONBOARDING_VERTICALS)[number]

export type BusinessAnalysis = {
  industry: string
  industryLabel: string
  vertical: OnboardingVertical
  icpSummary: string
  icpDescription: string
  valueProposition: string
}

const VERTICAL_LABELS: Record<OnboardingVertical, string> = {
  agency: 'Marketing & creative agency',
  hvac: 'HVAC & mechanical services',
  landscaping: 'Landscaping & lawn care',
  plumbing: 'Plumbing & water services',
  construction: 'Construction & trades',
  property_mgmt: 'Property management',
  real_estate: 'Real estate',
}

const KEYWORD_VERTICAL: Array<{ pattern: RegExp; vertical: OnboardingVertical }> = [
  { pattern: /\b(hvac|heating|cooling|air condition)\b/i, vertical: 'hvac' },
  { pattern: /\b(plumb|drain|sewer|water heater)\b/i, vertical: 'plumbing' },
  { pattern: /\b(landscap|lawn|mow|irrigation|tree)\b/i, vertical: 'landscaping' },
  { pattern: /\b(construc|contractor|build|roof|electric)\b/i, vertical: 'construction' },
  { pattern: /\b(property manag|tenant|lease|landlord)\b/i, vertical: 'property_mgmt' },
  { pattern: /\b(real estate|realtor|broker|homes for sale)\b/i, vertical: 'real_estate' },
  { pattern: /\b(agency|marketing|advertis|creative|digital)\b/i, vertical: 'agency' },
]

function normalizeVertical(value: unknown): OnboardingVertical {
  if (typeof value === 'string' && ONBOARDING_VERTICALS.includes(value as OnboardingVertical)) {
    return value as OnboardingVertical
  }
  return 'agency'
}

function inferVerticalFromText(...parts: string[]): OnboardingVertical {
  const blob = parts.filter(Boolean).join(' ')
  for (const rule of KEYWORD_VERTICAL) {
    if (rule.pattern.test(blob)) return rule.vertical
  }
  return 'agency'
}

function heuristicAnalysis(
  businessName: string,
  websiteUrl: string,
  manualVertical?: OnboardingVertical | null,
): BusinessAnalysis {
  const vertical = manualVertical ?? inferVerticalFromText(businessName, websiteUrl)
  const industryLabel = VERTICAL_LABELS[vertical]
  const host = (() => {
    try {
      return new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`).hostname
    } catch {
      return websiteUrl
    }
  })()

  const icpByVertical: Record<OnboardingVertical, { summary: string; description: string; value: string }> = {
    agency: {
      summary: 'Growth-focused SMBs that need predictable pipeline and campaign ROI.',
      description:
        'Marketing leaders and founders at B2B or local service brands spending on ads but struggling to convert interest into qualified meetings.',
      value:
        'Full-funnel lead generation, campaign management, and conversion-focused outreach that turns ad spend into booked calls.',
    },
    hvac: {
      summary: 'Homeowners and property managers needing fast, reliable HVAC service.',
      description:
        'Residential homeowners and small commercial property managers in your service area who need installs, maintenance, or emergency repairs.',
      value:
        'Same-day response, maintenance plans, and equipment installs with clear pricing and follow-through on every job.',
    },
    landscaping: {
      summary: 'Property owners who want consistent curb appeal without managing crews.',
      description:
        'Homeowners, HOAs, and small commercial sites looking for recurring lawn care, seasonal cleanups, and landscape maintenance.',
      value:
        'Reliable recurring service, seasonal upsells, and spotless properties without the owner chasing vendors.',
    },
    plumbing: {
      summary: 'Homeowners and businesses with urgent or planned plumbing needs.',
      description:
        'Local homeowners and light commercial accounts that need emergency dispatch, repipes, water heaters, or drain work.',
      value:
        'Fast emergency response, upfront estimates, and durable fixes that reduce callbacks and earn repeat business.',
    },
    construction: {
      summary: 'Owners planning remodels, builds, or trade projects with clear milestones.',
      description:
        'Homeowners and small developers running renovation or new-build projects who value transparent timelines and change-order control.',
      value:
        'End-to-end project delivery, milestone billing, and proactive communication from estimate through punch list.',
    },
    property_mgmt: {
      summary: 'Owners and investors who need responsive tenant and maintenance operations.',
      description:
        'Individual landlords and boutique property managers with 5–200 doors who need leasing, maintenance, and tenant communication handled.',
      value:
        'Lower vacancy, faster maintenance resolution, and owner reporting that makes portfolio performance visible.',
    },
    real_estate: {
      summary: 'Buyers and sellers who need a responsive agent and fast follow-up.',
      description:
        'Move-up buyers, first-time sellers, and investors in your market who respond to speed, local expertise, and clear next steps.',
      value:
        'Speed-to-lead, nurtured pipelines, and transaction coordination that wins listings and closes deals faster.',
    },
  }

  const icp = icpByVertical[vertical]

  return {
    industry: vertical,
    industryLabel,
    vertical,
    icpSummary: icp.summary,
    icpDescription: `${businessName} serves ${icp.description} Website: ${host}.`,
    valueProposition: icp.value,
  }
}

const SYSTEM_PROMPT = `You analyze businesses for a sales intelligence platform. Given a business name and website,
infer the industry vertical and ideal customer profile. Be concise and practical — no mention of AI or analysis process.

Return ONLY JSON:
{
  "vertical": one of ${ONBOARDING_VERTICALS.join('|')},
  "industryLabel": "human-readable industry",
  "icpSummary": "one sentence ideal customer",
  "icpDescription": "2-3 sentences describing who they sell to",
  "valueProposition": "1-2 sentences on outcomes they deliver"
}`

export async function analyzeBusinessFromDetails(args: {
  accountId: string
  businessName: string
  websiteUrl: string
  manualVertical?: OnboardingVertical | null
}): Promise<BusinessAnalysis> {
  const fallback = heuristicAnalysis(args.businessName, args.websiteUrl, args.manualVertical)

  const result = await callModel({
    accountId: args.accountId,
    toolName: 'onboarding-analyze-business',
    system: SYSTEM_PROMPT,
    user: [
      `Business name: ${args.businessName}`,
      `Website: ${args.websiteUrl}`,
      args.manualVertical ? `Owner-selected vertical hint: ${args.manualVertical}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    maxTokens: 512,
    timeoutMs: 8_000,
  })

  if (!result.ok) {
    return fallback
  }

  const parsed = parseJsonResponse<BusinessAnalysis>(result.text, (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const vertical = args.manualVertical ?? normalizeVertical(r.vertical)
    const industryLabel =
      typeof r.industryLabel === 'string' && r.industryLabel.trim()
        ? r.industryLabel.trim()
        : VERTICAL_LABELS[vertical]
    const icpSummary =
      typeof r.icpSummary === 'string' && r.icpSummary.trim() ? r.icpSummary.trim() : fallback.icpSummary
    const icpDescription =
      typeof r.icpDescription === 'string' && r.icpDescription.trim()
        ? r.icpDescription.trim()
        : fallback.icpDescription
    const valueProposition =
      typeof r.valueProposition === 'string' && r.valueProposition.trim()
        ? r.valueProposition.trim()
        : fallback.valueProposition

    return {
      industry: vertical,
      industryLabel,
      vertical,
      icpSummary,
      icpDescription,
      valueProposition,
    }
  })

  return parsed ?? fallback
}

export { VERTICAL_LABELS }
