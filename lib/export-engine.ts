import { utils, type WorkBook, type WorkSheet } from 'xlsx'

export interface ExportTx {
  date: string
  type: 'income' | 'expense'
  amount: number
  description: string | null
  is_recurring_instance: boolean
  categories: { name: string } | { name: string }[] | null
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function categoryName(r: ExportTx): string {
  const c = r.categories
  if (!c) return ''
  return Array.isArray(c) ? (c[0]?.name ?? '') : c.name
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

// Apply the 1 234,56 number format to a column range so Excel shows clean money.
function formatMoneyColumn(ws: WorkSheet, col: string, lastRow: number) {
  for (let r = 2; r <= lastRow; r++) {
    const cell = ws[`${col}${r}`]
    if (cell && typeof cell.v === 'number') cell.z = '#,##0.00'
  }
}

// Build the complete multi-sheet workbook (pure — no DOM, no I/O, fully testable).
export function buildTransactionsWorkbook(rows: ExportTx[]): WorkBook {
  const wb = utils.book_new()

  // ── Sheet 1: Transactions ────────────────────────────────────────
  const txHeader = ['Date', 'Type', 'Catégorie', 'Description', 'Montant (€)', 'Récurrent']
  const txBody = rows.map(r => [
    r.date,
    r.type === 'income' ? 'Revenu' : 'Dépense',
    categoryName(r),
    r.description ?? '',
    Number(r.amount),
    r.is_recurring_instance ? 'Oui' : 'Non',
  ])
  const wsTx = utils.aoa_to_sheet([txHeader, ...txBody])
  wsTx['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 22 }, { wch: 34 }, { wch: 14 }, { wch: 11 }]
  wsTx['!autofilter'] = { ref: `A1:F${txBody.length + 1}` }
  formatMoneyColumn(wsTx, 'E', txBody.length + 1)
  utils.book_append_sheet(wb, wsTx, 'Transactions')

  // ── Sheet 2: Résumé mensuel ──────────────────────────────────────
  const byMonth = new Map<string, { rev: number; dep: number }>()
  for (const r of rows) {
    const ym = r.date.slice(0, 7)
    const e = byMonth.get(ym) ?? { rev: 0, dep: 0 }
    if (r.type === 'income') e.rev += Number(r.amount); else e.dep += Number(r.amount)
    byMonth.set(ym, e)
  }
  const monthBody = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, e]) => [monthLabel(ym), e.rev, e.dep, e.rev - e.dep])
  const wsMonth = utils.aoa_to_sheet([['Mois', 'Revenus', 'Dépenses', 'Solde'], ...monthBody])
  wsMonth['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  formatMoneyColumn(wsMonth, 'B', monthBody.length + 1)
  formatMoneyColumn(wsMonth, 'C', monthBody.length + 1)
  formatMoneyColumn(wsMonth, 'D', monthBody.length + 1)
  utils.book_append_sheet(wb, wsMonth, 'Résumé mensuel')

  // ── Sheet 3: Par catégorie ───────────────────────────────────────
  const byCat = new Map<string, { type: 'income' | 'expense'; total: number; n: number }>()
  for (const r of rows) {
    const name = categoryName(r) || 'Sans catégorie'
    const key = `${name}␟${r.type}`
    const e = byCat.get(key) ?? { type: r.type, total: 0, n: 0 }
    e.total += Number(r.amount); e.n += 1
    byCat.set(key, e)
  }
  const catBody = [...byCat.entries()]
    .map(([key, e]) => [key.split('␟')[0], e.type === 'income' ? 'Revenu' : 'Dépense', e.total, e.n])
    .sort((a, b) => (b[2] as number) - (a[2] as number))
  const wsCat = utils.aoa_to_sheet([['Catégorie', 'Type', 'Total (€)', "Nb d'opérations"], ...catBody])
  wsCat['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 16 }]
  formatMoneyColumn(wsCat, 'C', catBody.length + 1)
  utils.book_append_sheet(wb, wsCat, 'Par catégorie')

  return wb
}

export function exportFilename(today = new Date()): string {
  return `finances-${today.toISOString().split('T')[0]}.xlsx`
}
