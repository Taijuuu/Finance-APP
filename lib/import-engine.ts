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

export function parseAmount(raw: string | number, positiveIsExpense: boolean): { amount: number; type: 'expense' | 'income' } {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.').replace(/\s/g, ''))
  if (isNaN(n)) throw new Error(`Montant invalide: ${raw}`)
  const isExpense = positiveIsExpense ? n > 0 : n < 0
  return { amount: Math.abs(n), type: isExpense ? 'expense' : 'income' }
}

export function parseRowDate(raw: string, format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'ISO'): string {
  if (format === 'ISO') {
    const d = new Date(raw)
    if (isNaN(d.getTime())) throw new Error(`Date invalide: ${raw}`)
    return d.toISOString().split('T')[0]
  }
  const parts = raw.split(/[\/\-]/)
  if (parts.length !== 3) throw new Error(`Format date invalide: ${raw}`)
  const [a, b, c] = parts
  if (format === 'DD/MM/YYYY') return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`
  return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`
}
