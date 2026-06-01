export type ParsedCsv = {
  headers: string[]
  rows: string[][]
}

/**
 * Minimal RFC 4180 CSV parser — handles quoted fields and commas.
 */
export function parseCsv(text: string): ParsedCsv {
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      if (current.length > 0 || lines.length === 0) lines.push(current)
      current = ''
      continue
    }

    current += char
  }

  if (current.length > 0 || lines.length === 0) lines.push(current)

  const nonEmpty = lines.filter((line) => line.trim().length > 0)
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] }
  }

  const parsedLines = nonEmpty.map(parseCsvLine)
  const [headerRow, ...dataRows] = parsedLines

  return {
    headers: headerRow ?? [],
    rows: dataRows.filter((row) => row.some((cell) => cell.trim().length > 0)),
  }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

export function rowsToObjects(
  headers: string[],
  rows: string[][],
): Record<string, string>[] {
  return rows.map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((header, index) => {
      obj[header] = row[index]?.trim() ?? ''
    })
    return obj
  })
}

export function applyColumnMapping(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): Record<string, string>[] {
  return rows.map((row) => {
    const mapped: Record<string, string> = {}
    for (const [fieldKey, csvColumn] of Object.entries(mapping)) {
      if (!csvColumn || csvColumn === '__skip__') continue
      mapped[fieldKey] = row[csvColumn]?.trim() ?? ''
    }
    return mapped
  })
}
