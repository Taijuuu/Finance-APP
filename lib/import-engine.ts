export function computeImportHash(date: string, amount: number, description: string): string {
  return `${date}|${amount.toFixed(2)}|${description.trim().toLowerCase()}`
}

interface ImportRow {
  date: string
  amount: number
  description: string
  [key: string]: unknown
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
  if (format === 'DD/MM/YYYY') return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
  return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
}
