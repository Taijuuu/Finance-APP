import { describe, it, expect } from 'vitest'
import { syncRecurring, syncUpTo } from './recurring-sync'

/**
 * Minimal chainable Supabase mock. Each call records the operation; filter
 * methods return `this`, and the builder is awaitable (resolves to { data }).
 */
function makeSupabase(tables: Record<string, unknown[]>) {
  const calls: { table: string; op: string; args: unknown[] }[] = []

  function builder(table: string) {
    const filters: Record<string, unknown> = {}
    let op = 'select'
    const b: Record<string, unknown> = {
      select(..._a: unknown[]) { op = 'select'; return b },
      insert(rows: unknown[]) { calls.push({ table, op: 'insert', args: [rows] }); return Promise.resolve({ data: null, error: null }) },
      delete() { op = 'delete'; calls.push({ table, op: 'delete', args: [] }); return b },
      update(..._a: unknown[]) { op = 'update'; return b },
      eq(col: string, val: unknown) { filters[`eq:${col}`] = val; record(); return b },
      in(col: string, val: unknown) { filters[`in:${col}`] = val; record(); return b },
      gt(col: string, val: unknown) { filters[`gt:${col}`] = val; record(); return b },
      gte() { record(); return b },
      lte() { record(); return b },
      then(resolve: (v: { data: unknown[] }) => unknown) {
        return Promise.resolve({ data: tables[table] ?? [] }).then(resolve)
      },
    }
    function record() {
      const existing = calls.find(c => c.table === table && c.op === op && c.args[0] === filters)
      if (!existing) calls.push({ table, op, args: [filters] })
    }
    return b
  }

  return {
    supabase: { from: (table: string) => builder(table) } as never,
    calls,
  }
}

describe('syncRecurring', () => {
  it('deletes future-dated expense instances capped at today', async () => {
    const { supabase, calls } = makeSupabase({
      recurring_transactions: [],
      transactions: [],
    })

    await syncRecurring(supabase, 'user-1', new Date('2026-07-01'))

    const expenseDelete = calls.find(
      c =>
        c.table === 'transactions' &&
        c.op === 'delete' &&
        typeof c.args[0] === 'object' &&
        (c.args[0] as Record<string, unknown>)['eq:is_recurring_instance'] === true &&
        (c.args[0] as Record<string, unknown>)['eq:type'] === 'expense' &&
        'gt:date' in (c.args[0] as Record<string, unknown>),
    )
    expect(expenseDelete).toBeTruthy()
  })

  it('deletes future-dated income instances only past the current month end', async () => {
    const { supabase, calls } = makeSupabase({
      recurring_transactions: [],
      transactions: [],
    })

    await syncRecurring(supabase, 'user-1', new Date('2026-07-01'))

    const now = new Date()
    const expectedMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0))
      .toISOString()
      .split('T')[0]

    const incomeDelete = calls.find(
      c =>
        c.table === 'transactions' &&
        c.op === 'delete' &&
        typeof c.args[0] === 'object' &&
        (c.args[0] as Record<string, unknown>)['eq:is_recurring_instance'] === true &&
        (c.args[0] as Record<string, unknown>)['eq:type'] === 'income',
    )
    expect(incomeDelete).toBeTruthy()
    expect((incomeDelete!.args[0] as Record<string, unknown>)['gt:date']).toBe(expectedMonthEnd)
  })

  it('generates a recurring income occurrence for later this month even before its day arrives', async () => {
    const now = new Date()
    const lateDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() // last day of month
    // Only meaningful when today isn't already the last day of the month.
    if (lateDayThisMonth === now.getDate()) return

    const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lateDayThisMonth).padStart(2, '0')}`
    const { supabase, calls } = makeSupabase({
      recurring_transactions: [
        { id: 'r1', user_id: 'user-1', is_active: true, type: 'income', frequency: 'monthly', start_date: startDate, amount: 1000, category_id: null, name: 'Salaire' },
      ],
      transactions: [],
    })

    await syncRecurring(supabase, 'user-1', now)

    const insertCall = calls.find(c => c.table === 'transactions' && c.op === 'insert')
    expect(insertCall).toBeTruthy()
    const rows = insertCall!.args[0] as { date: string; type: string }[]
    expect(rows.some(r => r.date === startDate && r.type === 'income')).toBe(true)
  })
})

describe('syncUpTo', () => {
  it('never exceeds today for the current or a future month', () => {
    const now = new Date()
    const upTo = syncUpTo(now.getFullYear(), now.getMonth() + 1)
    expect(upTo.getTime()).toBeLessThanOrEqual(now.getTime() + 1000)
  })
})
