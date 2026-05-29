import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, savingsRate, getMonthRange } from './utils'

describe('formatCurrency', () => {
  it('formats EUR by default', () => {
    const result = formatCurrency(1234.5)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('€')
  })
  it('formats with custom currency', () => {
    const result = formatCurrency(1000, 'USD')
    expect(result).toContain('1')
    expect(result).toContain('000')
  })
})

describe('savingsRate', () => {
  it('computes correctly', () => {
    expect(savingsRate(3000, 1800)).toBe(40)
  })
  it('returns null when income is 0', () => {
    expect(savingsRate(0, 0)).toBeNull()
  })
  it('returns null when income is 0 and expenses > 0', () => {
    expect(savingsRate(0, 500)).toBeNull()
  })
})

describe('getMonthRange', () => {
  it('returns correct start and end for May 2024', () => {
    const { start, end } = getMonthRange(2024, 5)
    expect(start).toBe('2024-05-01')
    expect(end).toBe('2024-05-31')
  })
  it('returns correct end for February leap year', () => {
    const { end } = getMonthRange(2024, 2)
    expect(end).toBe('2024-02-29')
  })
  it('returns correct end for February non-leap year', () => {
    const { end } = getMonthRange(2023, 2)
    expect(end).toBe('2023-02-28')
  })
})
