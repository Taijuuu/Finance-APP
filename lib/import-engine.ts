export function computeImportHash(date: string, amount: number, description: string): string {
  return `${date}|${amount.toFixed(2)}|${description.trim().toLowerCase()}`
}

interface ImportRow {
  date: string
  amount: number
  description: string
}

export function detectDuplicates<T extends ImportRow>(
  rows: T[],
  existingHashes: string[]
): (T & { isDuplicate: boolean; hash: string })[] {
  const existingSet = new Set(existingHashes)
  return rows.map(row => {
    const hash = computeImportHash(row.date, row.amount, row.description)
    return { ...row, hash, isDuplicate: existingSet.has(hash) }
  })
}

export function parseAmount(raw: string | number): { amount: number; type: 'expense' | 'income' } {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.').replace(/\s/g, ''))
  if (isNaN(n)) throw new Error(`Montant invalide: ${raw}`)
  return { amount: Math.abs(n), type: n < 0 ? 'expense' : 'income' }
}

// ── Robust layout detection for messy bank exports ─────────────────────────
// Bank files often have preamble rows before the real header, separate
// crédit/débit columns, and French-formatted numbers. These helpers locate the
// header row and map columns so the wizard can read (almost) any layout.

export type ImportRole = 'montant' | 'credit' | 'debit' | 'date' | 'description' | 'ignorer'

const RE_DATE = /date|jour/i
const RE_DESC = /objet|libell|description|nature|motif|intitul|d[ée]tail/i
const RE_CREDIT = /cr[ée]dit/i
const RE_DEBIT = /d[ée]bit/i
const RE_MONTANT = /montant|valeur|somme/i

// Tolerant numeric parser: handles "1 234,56", "-14,19", "12.00 €", "", etc.
export function parseNumeric(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'number') return isNaN(raw) ? null : raw
  let s = String(raw).trim()
  if (!s) return null
  s = s.replace(/[\s  ]/g, '')
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.')
  else s = s.replace(/,/g, '')
  s = s.replace(/[^0-9.\-]/g, '')
  if (s === '' || s === '-' || s === '.' || s === '-.') return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

export function looksLikeDate(raw: unknown): boolean {
  if (raw instanceof Date) return !isNaN(raw.getTime())
  if (typeof raw === 'number') return raw > 30000 && raw < 60000 // Excel serial ≈ 1982–2064
  if (typeof raw === 'string') {
    const s = raw.trim()
    return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(s)
  }
  return false
}

// Find the row that actually holds column headers (skips preamble rows).
// A header row contains an amount keyword AND a date/description keyword.
export function detectHeaderRow(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 30)
  for (let i = 0; i < limit; i++) {
    const joined = (matrix[i] ?? []).map(c => String(c ?? '')).join(' ')
    const hasAmount = RE_CREDIT.test(joined) || RE_DEBIT.test(joined) || RE_MONTANT.test(joined)
    const hasContext = RE_DATE.test(joined) || RE_DESC.test(joined)
    if (hasAmount && hasContext) return i
  }
  return 0
}

// Best-effort role per header. Crédit/débit map to their own roles so the
// wizard can derive a signed amount from two columns.
export function autoMapColumns(headers: string[]): Record<string, ImportRole> {
  const m: Record<string, ImportRole> = {}
  let date = false, desc = false, credit = false, debit = false, montant = false
  for (const h of headers) {
    if (!date && RE_DATE.test(h)) { m[h] = 'date'; date = true }
    else if (!desc && RE_DESC.test(h)) { m[h] = 'description'; desc = true }
    else if (!credit && RE_CREDIT.test(h)) { m[h] = 'credit'; credit = true }
    else if (!debit && RE_DEBIT.test(h)) { m[h] = 'debit'; debit = true }
    else if (!montant && RE_MONTANT.test(h)) { m[h] = 'montant'; montant = true }
    else m[h] = 'ignorer'
  }
  return m
}

// Fallback when no header literally says "date": pick the column whose values
// mostly look like dates.
export function detectDateColumn(rows: Record<string, unknown>[], headers: string[]): string | null {
  let best: string | null = null
  let bestRatio = 0
  for (const h of headers) {
    let count = 0, total = 0
    for (const r of rows.slice(0, 40)) {
      const v = r[h]
      if (v === null || v === undefined || v === '') continue
      total++
      if (looksLikeDate(v)) count++
    }
    if (total >= 3) {
      const ratio = count / total
      if (ratio > 0.6 && ratio > bestRatio) { bestRatio = ratio; best = h }
    }
  }
  return best
}

// Excel serial date: days since 1900-01-01 (with Lotus 1-2-3 leap year bug)
function excelSerialToDate(serial: number): Date {
  const MS_PER_DAY = 86400000
  const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30))
  return new Date(EXCEL_EPOCH.getTime() + serial * MS_PER_DAY)
}

export function parseRowDate(raw: string | number | Date, format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO'): string {
  // JS Date object (from xlsx cellDates:true)
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) throw new Error('Date invalide')
    return raw.toISOString().split('T')[0]
  }
  // Excel serial number
  if (typeof raw === 'number') {
    const d = excelSerialToDate(raw)
    if (isNaN(d.getTime())) throw new Error(`Numéro de date invalide: ${raw}`)
    return d.toISOString().split('T')[0]
  }
  // String
  const str = String(raw).trim()
  if (format === 'ISO') {
    const d = new Date(str)
    if (isNaN(d.getTime())) throw new Error(`Date invalide: ${str}`)
    return d.toISOString().split('T')[0]
  }
  const parts = str.split(/[\/\-\.]/)
  if (parts.length !== 3) throw new Error(`Format date invalide: ${str}`)
  const [a, b, c] = parts
  const yr = c.length === 2 ? `20${c}` : c.padStart(4, '0')
  if (format === 'DD/MM/YYYY') return `${yr}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
  return `${yr}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
}

// ── End-to-end pipeline (pure, fully testable) ─────────────────────────────

export interface ParsedRow { amount: number; type: 'expense' | 'income'; date: string; description: string }
export type DateFmt = 'auto' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO'

export function autoDetectDateFormat(sample: string): 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO' {
  if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'ISO'
  const parts = sample.split(/[\/\-.]/)
  if (parts.length === 3 && Number(parts[0]) > 12) return 'DD/MM/YYYY'
  return 'DD/MM/YYYY'
}

// A mapping is usable once it has a date column and at least one amount source.
export function isMappingUsable(mapping: Record<string, ImportRole>): boolean {
  const roles = Object.values(mapping)
  return roles.includes('date') && (roles.includes('montant') || roles.includes('credit') || roles.includes('debit'))
}

// Locate the header row, name the columns, and auto-map roles — all in one step.
export function analyzeSheet(matrix: unknown[][]): {
  headerRow: number
  headers: string[]
  dataRows: Record<string, unknown>[]
  mapping: Record<string, ImportRole>
} {
  const headerRow = matrix.length ? detectHeaderRow(matrix) : 0
  const seen: Record<string, number> = {}
  const headers = (matrix[headerRow] ?? []).map((c, i) => {
    let s = String(c ?? '').trim() || `Colonne ${i + 1}`
    if (seen[s]) { seen[s] += 1; s = `${s} (${seen[s]})` } else seen[s] = 1
    return s
  })
  const dataRows = matrix.slice(headerRow + 1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, (row as unknown[])[i] ?? ''])) as Record<string, unknown>
  )
  let mapping = autoMapColumns(headers)
  if (!Object.values(mapping).includes('date')) {
    const dcol = detectDateColumn(dataRows, headers)
    if (dcol) mapping = { ...mapping, [dcol]: 'date' }
  }
  return { headerRow, headers, dataRows, mapping }
}

// Turn data rows + a column mapping into clean transactions.
// Non-transaction rows (blank dates, balance/total lines) are skipped silently;
// only genuine parse failures count as errors.
export function parseRows(
  rows: Record<string, unknown>[],
  mapping: Record<string, ImportRole>,
  dateFormat: DateFmt = 'auto'
): { rows: ParsedRow[]; errors: number } {
  const colOf = (role: ImportRole) => Object.keys(mapping).find(k => mapping[k] === role) ?? null
  const dateCol = colOf('date')
  const montantCol = colOf('montant')
  const creditCol = colOf('credit')
  const debitCol = colOf('debit')
  const descCol = colOf('description')
  if (!dateCol || (!montantCol && !creditCol && !debitCol)) return { rows: [], errors: 0 }

  const firstDate = rows.find(r => r[dateCol] !== '' && r[dateCol] != null)?.[dateCol]
  const fmt: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO' = dateFormat !== 'auto'
    ? dateFormat
    : firstDate instanceof Date || typeof firstDate === 'number'
      ? 'ISO'
      : autoDetectDateFormat(String(firstDate ?? ''))

  let errors = 0
  const out: ParsedRow[] = []
  for (const r of rows) {
    const rawDate = r[dateCol]
    if (rawDate === '' || rawDate === null || rawDate === undefined) continue
    let date: string
    try { date = parseRowDate(rawDate as string | number | Date, fmt) } catch { errors++; continue }

    let amount: number
    let type: 'expense' | 'income'
    if (montantCol) {
      const raw = r[montantCol]
      if (raw === '' || raw === null || raw === undefined) continue
      try { const a = parseAmount(raw as string | number); amount = a.amount; type = a.type } catch { errors++; continue }
    } else {
      const credit = creditCol ? parseNumeric(r[creditCol]) : null
      const debit = debitCol ? parseNumeric(r[debitCol]) : null
      if (credit !== null && credit !== 0) { amount = Math.abs(credit); type = 'income' }
      else if (debit !== null && debit !== 0) { amount = Math.abs(debit); type = 'expense' }
      else continue
    }
    out.push({ amount, type, date, description: descCol ? String(r[descCol] ?? '') : '' })
  }
  return { rows: out, errors }
}
