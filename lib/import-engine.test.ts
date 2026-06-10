import { describe, it, expect } from 'vitest'
import { read, utils, write } from 'xlsx'
import {
  computeImportHash, detectDuplicates,
  parseNumeric, looksLikeDate, detectHeaderRow, autoMapColumns,
  analyzeSheet, parseRows, parseRowDate, isMappingUsable,
} from './import-engine'

describe('computeImportHash', () => {
  it('produces consistent hash for same inputs', () => {
    const h1 = computeImportHash('2024-03-15', 42.50, 'Carrefour')
    const h2 = computeImportHash('2024-03-15', 42.50, 'Carrefour')
    expect(h1).toBe(h2)
  })
  it('produces different hash for different inputs', () => {
    const h1 = computeImportHash('2024-03-15', 42.50, 'Carrefour')
    const h2 = computeImportHash('2024-03-15', 42.50, 'Lidl')
    expect(h1).not.toBe(h2)
  })
})

describe('detectDuplicates', () => {
  it('marks rows that match existing hashes', () => {
    const existing = [computeImportHash('2024-01-05', 100, 'Loyer')]
    const rows = [
      { date: '2024-01-05', amount: 100, description: 'Loyer' },
      { date: '2024-02-01', amount: 50, description: 'Courses' },
    ]
    const result = detectDuplicates(rows, existing)
    expect(result[0].isDuplicate).toBe(true)
    expect(result[1].isDuplicate).toBe(false)
  })
})

describe('parseNumeric', () => {
  it('handles French formatting, currency symbols and blanks', () => {
    expect(parseNumeric('2 500,00')).toBe(2500)
    expect(parseNumeric('14,19')).toBe(14.19)
    expect(parseNumeric('-14.19')).toBe(-14.19)
    expect(parseNumeric('1 234,56')).toBe(1234.56) // non-breaking space thousands
    expect(parseNumeric('12,00 €')).toBe(12)
    expect(parseNumeric('')).toBeNull()
    expect(parseNumeric('   ')).toBeNull()
    expect(parseNumeric(42)).toBe(42)
  })
})

describe('looksLikeDate', () => {
  it('recognises common date shapes, rejects amounts', () => {
    expect(looksLikeDate('05/01/2024')).toBe(true)
    expect(looksLikeDate('2024-01-05')).toBe(true)
    expect(looksLikeDate('05-01-24')).toBe(true)
    expect(looksLikeDate(new Date())).toBe(true)
    expect(looksLikeDate('VIREMENT')).toBe(false)
    expect(looksLikeDate(2500)).toBe(false) // an amount, not a serial date
  })
})

describe('parseRowDate', () => {
  it('normalises 2-digit years', () => {
    expect(parseRowDate('05/01/24', 'DD/MM/YYYY')).toBe('2024-01-05')
  })
})

// A realistic French bank export: preamble rows, the real header buried at
// row 2, separate crédit/débit columns, French numbers, and a trailing total.
const BANK_MATRIX: unknown[][] = [
  ['Relevé de compte', '', '', '', '', ''],
  ['Solde reporté', '', '', '', '1 000,00', ''],
  ['date', 'objet', 'crédit', 'débit', 'solde', 'n° chèque'],
  ['05/01/2024', 'VIREMENT SALAIRE', '2 500,00', '', '3 500,00', ''],
  ['06/01/2024', 'CB CARREFOUR', '', '14,19', '3 485,81', ''],
  ['07/01/2024', 'PRLV EDF', '', '89,90', '3 395,91', ''],
  ['', 'Total', '', '', '', ''],
]

describe('analyzeSheet', () => {
  it('finds the real header row past the preamble', () => {
    const { headerRow, headers, mapping, dataRows } = analyzeSheet(BANK_MATRIX)
    expect(headerRow).toBe(2)
    expect(headers).toEqual(['date', 'objet', 'crédit', 'débit', 'solde', 'n° chèque'])
    expect(mapping['date']).toBe('date')
    expect(mapping['objet']).toBe('description')
    expect(mapping['crédit']).toBe('credit')
    expect(mapping['débit']).toBe('debit')
    expect(mapping['solde']).toBe('ignorer') // running balance must NOT be an amount
    expect(dataRows).toHaveLength(4) // 3 transactions + 1 total row
    expect(isMappingUsable(mapping)).toBe(true)
  })
})

describe('parseRows — bank crédit/débit export', () => {
  it('produces correct signed transactions and skips non-transaction rows', () => {
    const { mapping, dataRows } = analyzeSheet(BANK_MATRIX)
    const { rows, errors } = parseRows(dataRows, mapping, 'auto')
    expect(errors).toBe(0)
    expect(rows).toEqual([
      { date: '2024-01-05', amount: 2500, type: 'income', description: 'VIREMENT SALAIRE' },
      { date: '2024-01-06', amount: 14.19, type: 'expense', description: 'CB CARREFOUR' },
      { date: '2024-01-07', amount: 89.9, type: 'expense', description: 'PRLV EDF' },
    ])
  })
})

describe('analyzeSheet/parseRows — simple single-header file', () => {
  it('reads a normal Date/Libellé/Montant sheet (backward compatible)', () => {
    const matrix: unknown[][] = [
      ['Date', 'Libellé', 'Montant'],
      ['2024-03-15', 'Loyer', '-800'],
      ['2024-03-20', 'Salaire', '2500'],
    ]
    const { headerRow, mapping } = analyzeSheet(matrix)
    expect(headerRow).toBe(0)
    const { rows } = parseRows(matrix.slice(1).map(r => ({ Date: r[0], 'Libellé': r[1], Montant: r[2] })), mapping, 'ISO')
    expect(rows).toEqual([
      { date: '2024-03-15', amount: 800, type: 'expense', description: 'Loyer' },
      { date: '2024-03-20', amount: 2500, type: 'income', description: 'Salaire' },
    ])
  })
})

describe('detectDateColumn fallback', () => {
  it('finds the date column when no header says "date"', () => {
    const matrix: unknown[][] = [
      ['ref', 'objet', 'montant'],
      ['01/02/2024', 'Achat', '-10,00'],
      ['03/02/2024', 'Achat 2', '-20,00'],
      ['05/02/2024', 'Achat 3', '-30,00'],
    ]
    const { mapping } = analyzeSheet(matrix)
    expect(mapping['ref']).toBe('date')
    expect(isMappingUsable(mapping)).toBe(true)
  })
})

// Full integration: build a REAL .xlsx (preamble + buried header + crédit/débit),
// then read it back exactly like ImportWizard does. Catches xlsx-specific issues
// (the __EMPTY problem, cellDates, blank rows) that a hand-built matrix can't.
describe('integration: real .xlsx bank statement → transactions', () => {
  function readLikeWizard(buf: ArrayBuffer): unknown[][] {
    const wb = read(new Uint8Array(buf), { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return utils.sheet_to_json(ws, { header: 1, cellDates: true, blankrows: false, defval: '' } as any) as unknown[][]
  }

  it('reads a generated bank-style workbook end to end', () => {
    const aoa = [
      ['Relevé de compte n°00012345', '', '', '', '', ''],
      ['Période du 01/01/2024 au 31/01/2024', '', '', '', '', ''],
      ['Solde reporté', '', '', '', '1 000,00', ''],
      ['date', 'objet', 'crédit', 'débit', 'solde', 'n° chèque'],
      ['05/01/2024', 'VIREMENT SALAIRE', '2 500,00', '', '3 500,00', ''],
      ['06/01/2024', 'CB CARREFOUR', '', '14,19', '3 485,81', ''],
      ['07/01/2024', 'PRLV EDF', '', '89,90', '3 395,91', ''],
      ['', 'Total des opérations', '', '', '', ''],
    ]
    const ws = utils.aoa_to_sheet(aoa)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Relevé')
    const buf = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const matrix = readLikeWizard(buf)
    const { mapping, dataRows, headerRow } = analyzeSheet(matrix)
    expect(headerRow).toBe(3)
    expect(isMappingUsable(mapping)).toBe(true)

    const { rows, errors } = parseRows(dataRows, mapping, 'auto')
    expect(errors).toBe(0)
    expect(rows).toEqual([
      { date: '2024-01-05', amount: 2500, type: 'income', description: 'VIREMENT SALAIRE' },
      { date: '2024-01-06', amount: 14.19, type: 'expense', description: 'CB CARREFOUR' },
      { date: '2024-01-07', amount: 89.9, type: 'expense', description: 'PRLV EDF' },
    ])
  })
})
