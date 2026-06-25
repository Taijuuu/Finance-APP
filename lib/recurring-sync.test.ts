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
  it('deletes future-dated recurring instances', async () => {
    const { supabase, calls } = makeSupabase({
      recurring_transactions: [],
      transactions: [],
    })

    await syncRecurring(supabase, 'user-1', new Date('2026-07-01'))

    const futureDelete = calls.find(
      c =>
        c.table === 'transactions' &&
        c.op === 'delete' &&
        typeof c.args[0] === 'object' &&
        (c.args[0] as Record<string, unknown>)['eq:is_recurring_instance'] === true &&
        'gt:date' in (c.args[0] as Record<string, unknown>),
    )
    expect(futureDelete).toBeTruthy()
  })
})

describe('syncUpTo', () => {
  it('never exceeds today for the current or a future month', () => {
    const now = new Date()
    const upTo = syncUpTo(now.getFullYear(), now.getMonth() + 1)
    expect(upTo.getTime()).toBeLessThanOrEqual(now.getTime() + 1000)
  })
})
