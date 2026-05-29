import { describe, it, expect } from 'vitest'
import { computeImportHash, detectDuplicates } from './import-engine'

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
