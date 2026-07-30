export const parseCsv = (text) => {
  const rows = []
  const row = []
  let cur = ''
  let i = 0
  let inQuotes = false

  const pushCell = () => {
    row.push(cur)
    cur = ''
  }

  const pushRow = () => {
    rows.push([...row])
    row.length = 0
  }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1]
        if (next === '"') {
          cur += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      cur += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }

    if (ch === ',') {
      pushCell()
      i += 1
      continue
    }

    if (ch === '\r') {
      i += 1
      continue
    }

    if (ch === '\n') {
      pushCell()
      pushRow()
      i += 1
      continue
    }

    cur += ch
    i += 1
  }

  if (inQuotes) throw new Error('CSV inválido: comillas sin cerrar')

  if (cur.length > 0 || row.length > 0) {
    pushCell()
    pushRow()
  }

  return rows.filter((r) => r.some((c) => String(c || '').trim() !== ''))
}

export const csvToObjects = (rows) => {
  if (!rows?.length) return []
  const header = rows[0].map((h) => String(h || '').trim())
  const out = []
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i]
    const obj = {}
    for (let c = 0; c < header.length; c += 1) {
      const k = header[c]
      if (!k) continue
      obj[k] = r[c] ?? ''
    }
    out.push(obj)
  }
  return out
}

export const normalizeSeedValue = (v) => {
  const s = String(v ?? '').trim()
  if (s === '') return undefined
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  return s
}

