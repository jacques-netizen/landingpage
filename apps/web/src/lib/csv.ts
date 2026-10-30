// A small CSV reader for staff uploads (RFC 4180: quoted fields, doubled quotes, commas and line breaks
// inside quotes). Also takes semicolons, as spreadsheets in many countries export them.

/** Rows of cells; empty lines are dropped. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell)
  if (row.some((c) => c.trim())) rows.push(row)
  return rows.map((r) => r.map((c) => c.trim()))
}

/** Rows as objects keyed by the header row, in lower case. */
export function csvRecords(text: string): { header: string[]; records: Record<string, string>[] } {
  const [head, ...body] = parseCsv(text)
  const header = (head ?? []).map((h) =>
    h
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, ''),
  )
  return {
    header,
    records: body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))),
  }
}
