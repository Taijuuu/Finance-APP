import { describe, it, expect } from 'vitest'
import { computeMissingOccurrences } from './recurring-engine'

describe('computeMissingOccurrences', () => {
  it('generates monthly occurrences since last_generated', () => {
    const dates = computeMissingOccurrences({
      frequency: 'monthly',
      start_date: '2024-01-15',
      last_generated: '2024-02-15',
    }, new Date('2024-04-20'))
    expect(dates).toEqual(['2024-03-15', '2024-04-15'])
  })

  it('uses start_date when last_generated is null', () => {
    const dates = computeMissingOccurrences({
      frequency: 'monthly',
      start_date: '2024-03-01',
      last_generated: null,
    }, new Date('2024-04-10'))
    expect(dates).toEqual(['2024-03-01', '2024-04-01'])
  })

  it('returns empty when up to date', () => {
    const dates = computeMissingOccurrences({
      frequency: 'monthly',
      start_date: '2024-01-01',
      last_generated: '2024-04-01',
    }, new Date('2024-04-15'))
    expect(dates).toEqual([])
  })

  it('generates weekly occurrences', () => {
    const dates = computeMissingOccurrences({
      frequency: 'weekly',
      start_date: '2024-04-01',
      last_generated: null,
    }, new Date('2024-04-22'))
    expect(dates).toEqual(['2024-04-01', '2024-04-08', '2024-04-15', '2024-04-22'])
  })

  it('generates yearly occurrence', () => {
    const dates = computeMissingOccurrences({
      frequency: 'yearly',
      start_date: '2023-06-15',
      last_generated: '2023-06-15',
    }, new Date('2024-07-01'))
    expect(dates).toEqual(['2024-06-15'])
  })
})
