import type { ApolloPersonResult, ApolloSearchFilters } from '@/lib/aspire/types'

/** Sample leads when Apify is not configured or returns no matches (interactive search). */
export function stubResults(filters: ApolloSearchFilters): ApolloPersonResult[] {
  const keyword = (filters.q ?? filters.keywords?.join(' ') ?? '').trim().toLowerCase()
  const company = filters.company?.trim() || 'Northstar SaaS'

  const pool: ApolloPersonResult[] = [
    {
      id: 'stub-alex-chen',
      firstName: 'Alex',
      lastName: 'Chen',
      title: 'Founder',
      email: 'alex@northstar.io',
      linkedinUrl: 'https://linkedin.com/in/example',
      industry: 'Software',
      organizationName: company,
      organizationId: null,
      websiteUrl: null,
      city: 'Phoenix',
      state: 'AZ',
      employeeCount: 25,
      revenue: null,
      phone: '+1 (602) 555-0142',
      technologies: [],
      photoUrl: null,
    },
    {
      id: 'stub-jordan-reeves',
      firstName: 'Jordan',
      lastName: 'Reeves',
      title: 'VP Marketing',
      email: 'jordan@atlas.co',
      linkedinUrl: 'https://linkedin.com/in/jordan-reeves-example',
      industry: 'Marketing',
      organizationName: 'Atlas Agency',
      organizationId: null,
      websiteUrl: null,
      city: 'Dallas',
      state: 'TX',
      employeeCount: 40,
      revenue: null,
      phone: '+1 (214) 555-0198',
      technologies: [],
      photoUrl: null,
    },
    {
      id: 'stub-sam-ortiz',
      firstName: 'Sam',
      lastName: 'Ortiz',
      title: 'Marketing Director',
      email: 'sam@brightpath.co',
      linkedinUrl: null,
      industry: 'Marketing',
      organizationName: 'Brightpath Digital',
      organizationId: null,
      websiteUrl: null,
      city: 'Austin',
      state: 'TX',
      employeeCount: 55,
      revenue: null,
      phone: null,
      technologies: [],
      photoUrl: null,
    },
    {
      id: 'stub-riley-park',
      firstName: 'Riley',
      lastName: 'Park',
      title: 'Head of Growth Marketing',
      email: 'riley@growthlane.io',
      linkedinUrl: null,
      industry: 'Marketing',
      organizationName: 'Growthlane',
      organizationId: null,
      websiteUrl: null,
      city: 'Denver',
      state: 'CO',
      employeeCount: 32,
      revenue: null,
      phone: null,
      technologies: [],
      photoUrl: null,
    },
  ]

  if (!keyword) return pool

  const matched = pool.filter(
    (p) =>
      p.title.toLowerCase().includes(keyword) ||
      (p.industry?.toLowerCase().includes(keyword) ?? false) ||
      p.organizationName.toLowerCase().includes(keyword),
  )

  if (matched.length > 0) return matched

  return [
    {
      id: `stub-${keyword.replace(/\s+/g, '-')}`,
      firstName: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      lastName: 'Prospect',
      title: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Manager`,
      email: `prospect@${keyword.replace(/\s+/g, '')}.example`,
      linkedinUrl: null,
      industry: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      organizationName: company,
      organizationId: null,
      websiteUrl: null,
      city: null,
      state: null,
      employeeCount: null,
      revenue: null,
      phone: null,
      technologies: [],
      photoUrl: null,
    },
    {
      id: `stub-${keyword.replace(/\s+/g, '-')}-2`,
      firstName: 'Taylor',
      lastName: 'Morgan',
      title: `Director of ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`,
      email: `taylor@${keyword.replace(/\s+/g, '')}.example`,
      linkedinUrl: null,
      industry: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      organizationName: `${keyword} Co.`,
      organizationId: null,
      websiteUrl: null,
      city: 'Chicago',
      state: 'IL',
      employeeCount: 18,
      revenue: null,
      phone: null,
      technologies: [],
      photoUrl: null,
    },
  ]
}
