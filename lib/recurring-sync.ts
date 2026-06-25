import { computeMissingOccurrences } from './recurring-engine'
import type { createClient } from './supabase/server'

type SupabaseServer = Awaited<ReturnType<typeof createClient>>

/**
 * Materialise any missing recurring occurrences up to `upTo`, and clean up
 * orphaned instances (whose recurring template was deleted, leaving recurring_id
 * null via ON DELETE SET NULL) so they stop counting in totals and charts.
 *
 * Safe to call on every page load: inserts are de-duplicated by date and the
 * orphan cleanup only ever targets generated instances.
 */
export async function syncRecurring(supabase: SupabaseServer, userId: string, upTo: Date) {
  // 1. Remove ALL orphaned generated instances: any recurring instance whose
  // template no longer exists — whether recurring_id is null (ON DELETE SET NULL)
  // OR still points to a deleted template (dangling reference). This is robust to
  // however the DB handled the foreign key on deletion.
  const { data: templates } = await supabase
    .from('recurring_transactions')
    .select('id')
    .eq('user_id', userId)
  const validIds = new Set((templates ?? []).map((t) => t.id))

  const { data: instances } = await supabase
    .from('transactions')
    .select('id, recurring_id')
    .eq('user_id', userId)
    .eq('is_recurring_instance', true)
  const orphanIds = (instances ?? [])
    .filter((t) => !t.recurring_id || !validIds.has(t.recurring_id))
    .map((t) => t.id)
  if (orphanIds.length) {
    await supabase.from('transactions').delete().eq('user_id', userId).in('id', orphanIds)
  }

  // 1b. Remove any FUTURE-dated recurring instances. A recurring expense must only
  // appear/count on its actual debit day, never before. Generation below is capped
  // at today, so this only ever clears instances left over from earlier versions
  // (or a wider horizon); they are regenerated when their date arrives.
  const todayStr = new Date().toISOString().split('T')[0]
  await supabase
    .from('transactions')
    .delete()
    .eq('user_id', userId)
    .eq('is_recurring_instance', true)
    .gt('date', todayStr)

  // 2. Generate missing occurrences for active recurrings
  const recurrings = (templates && templates.length)
    ? (await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)).data
    : null
  if (!recurrings?.length) return

  await Promise.all(
    recurrings.map(async (r) => {
      // Recompute from start_date (last_generated: null) to catch any gaps
      const all = computeMissingOccurrences(
        { frequency: r.frequency, start_date: r.start_date, last_generated: null },
        upTo,
      )
      if (all.length === 0) return
      const { data: existing } = await supabase
        .from('transactions')
        .select('date')
        .eq('recurring_id', r.id)
        .eq('user_id', userId)
        .in('date', all)
      const existingSet = new Set((existing ?? []).map((t) => t.date))
      const missing = all.filter((d) => !existingSet.has(d))
      if (missing.length === 0) return
      await supabase.from('transactions').insert(
        missing.map((date) => ({
          user_id: userId,
          amount: Number(r.amount),
          type: r.type,
          category_id: r.category_id,
          description: r.name,
          date,
          is_recurring_instance: true,
          recurring_id: r.id,
        })),
      )
    }),
  )
}

/** upTo = end of the viewed month, but never beyond today (no future occurrences). */
export function syncUpTo(year: number, month: number): Date {
  const monthEnd = new Date(year, month, 0) // last day of viewed month, local time
  const now = new Date()
  return monthEnd < now ? monthEnd : now
}
