import type { leads } from '@vantera/db'

type LeadRow = typeof leads.$inferSelect

const CSV_HEADERS = [
  'first_name',
  'last_name',
  'company',
  'email',
  'phone',
  'title',
  'status',
  'source',
  'score',
] as const

function escapeCsv(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function leadsToCsv(rows: LeadRow[]): string {
  const lines = [CSV_HEADERS.join(',')]

  for (const lead of rows) {
    lines.push(
      [
        escapeCsv(lead.firstName),
        escapeCsv(lead.lastName),
        escapeCsv(lead.company),
        escapeCsv(lead.email),
        escapeCsv(lead.phone),
        escapeCsv(lead.title),
        escapeCsv(lead.relationshipStatus),
        escapeCsv(lead.source),
        escapeCsv(lead.score),
      ].join(','),
    )
  }

  return lines.join('\n')
}
