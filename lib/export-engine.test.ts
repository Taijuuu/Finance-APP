import { describe, it, expect } from 'vitest'
import { read, utils, write } from 'xlsx'
import { buildTransactionsWorkbook, categoryName, monthLabel, exportFilename, type ExportTx } from './export-engine'

const ROWS: ExportTx[] = [
  { date: '2026-06-05', type: 'income', amount: 2500, description: 'SNCF', is_recurring_instance: true, categories: { name: 'Salaire' } },
  { date: '2026-06-06', type: 'expense', amount: 14.19, description: 'Carrefour', is_recurring_instance: false, categories: { name: 'Alimentation' } },
  { date: '2026-05-20', type: 'expense', amount: 50, description: 'Resto', is_recurring_instance: false, categories: [{ name: 'Restaurants & Bars' }] },
  { date: '2026-05-01', type: 'income', amount: 100, description: 'Remboursement', is_recurring_instance: false, categories: null },
]

describe('categoryName', () => {
  it('handles object, array, and null shapes', () => {
    expect(categoryName(ROWS[0])).toBe('Salaire')
    expect(categoryName(ROWS[2])).toBe('Restaurants & Bars')
    expect(categoryName(ROWS[3])).toBe('')
  })
})

describe('monthLabel / exportFilename', () => {
  it('formats month and filename', () => {
    expect(monthLabel('2026-06')).toBe('juin 2026')
    expect(exportFilename(new Date('2026-06-11T10:00:00Z'))).toBe('finances-2026-06-11.xlsx')
  })
})

describe('buildTransactionsWorkbook — round-trip through a real .xlsx', () => {
  // Build → write to buffer → read back, exactly like Excel would open it.
  const wb = buildTransactionsWorkbook(ROWS)
  const buf = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const reread = read(new Uint8Array(buf), { type: 'array' })

  it('has the three named sheets', () => {
    expect(reread.SheetNames).toEqual(['Transactions', 'Résumé mensuel', 'Par catégorie'])
  })

  it('Transactions sheet: one row per transaction + total row, correct columns', () => {
    const aoa = utils.sheet_to_json<unknown[]>(reread.Sheets['Transactions'], { header: 1 })
    expect(aoa[0]).toEqual(['Date', 'Type', 'Catégorie', 'Description', 'Montant (€)', 'Récurrent'])
    expect(aoa).toHaveLength(6) // header + 4 rows + total
    expect(aoa[1]).toEqual(['2026-06-05', 'Revenu', 'Salaire', 'SNCF', 2500, 'Oui'])
    expect(aoa[2]).toEqual(['2026-06-06', 'Dépense', 'Alimentation', 'Carrefour', 14.19, 'Non'])
    // amount stays a real number (calculable in Excel)
    expect(typeof aoa[1][4]).toBe('number')
    // total row: income(2500+100) − expenses(14.19+50) = 2535.81
    const totalRow = aoa[5] as unknown[]
    expect(totalRow[3]).toBe('TOTAL (Revenu − Dépenses)')
    expect(totalRow[4]).toBeCloseTo(2535.81, 2)
  })

  it('Résumé mensuel: aggregates income/expense/balance per month, sorted', () => {
    const rows = utils.sheet_to_json<Record<string, unknown>>(reread.Sheets['Résumé mensuel'])
    expect(rows).toEqual([
      { Mois: 'mai 2026', Revenus: 100, Dépenses: 50, Solde: 50 },
      { Mois: 'juin 2026', Revenus: 2500, Dépenses: 14.19, Solde: 2485.81 },
    ])
  })

  it('Par catégorie: totals and counts per category, sorted by total desc', () => {
    const rows = utils.sheet_to_json<Record<string, unknown>>(reread.Sheets['Par catégorie'])
    expect(rows[0]).toEqual({ 'Catégorie': 'Salaire', Type: 'Revenu', 'Total (€)': 2500, "Nb d'opérations": 1 })
    expect(rows.find(r => r['Catégorie'] === 'Sans catégorie')).toEqual({ 'Catégorie': 'Sans catégorie', Type: 'Revenu', 'Total (€)': 100, "Nb d'opérations": 1 })
    expect(rows).toHaveLength(4)
  })
})
