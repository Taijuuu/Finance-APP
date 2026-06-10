import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeMissingOccurrences } from '@/lib/recurring-engine'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ step: 'auth', error: authErr?.message ?? 'Not authenticated' })

  // 1. Fetch recurring transactions
  const { data: recurrings, error: rErr } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', user.id)

  if (rErr) return NextResponse.json({ step: 'fetch_recurrings', error: rErr.message })

  // 2. Fetch existing transactions sample
  const { data: txSample, error: txErr } = await supabase
    .from('transactions')
    .select('id, date, amount, type, is_recurring_instance, recurring_id')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(10)

  // 3. Try generation for each recurring
  const today = new Date()
  const generationResults = []

  for (const r of recurrings ?? []) {
    const all = computeMissingOccurrences({
      frequency: r.frequency, start_date: r.start_date, last_generated: null,
    }, today)

    const { data: existing, error: existErr } = await supabase
      .from('transactions')
      .select('date')
      .eq('recurring_id', r.id)
      .eq('user_id', user.id)

    const existingDates = (existing ?? []).map(t => t.date)
    const existingSet = new Set(existingDates)
    const missing = all.filter(d => !existingSet.has(d))

    let insertResult: { data: unknown; error: string | null } = { data: null, error: null }
    if (missing.length > 0) {
      const { data: ins, error: iErr } = await supabase.from('transactions').insert(
        missing.map(date => ({
          user_id: user.id,
          amount: Number(r.amount),
          type: r.type,
          category_id: r.category_id,
          description: r.name,
          date,
          is_recurring_instance: true,
          recurring_id: r.id,
        }))
      ).select('id, date')
      insertResult = { data: ins, error: iErr?.message ?? null }
    }

    generationResults.push({
      recurring: { id: r.id, name: r.name, frequency: r.frequency, start_date: r.start_date, is_active: r.is_active, amount: r.amount },
      computed_occurrences: all,
      already_in_db: existingDates,
      missing_to_insert: missing,
      insert_result: insertResult,
      existing_fetch_error: existErr?.message ?? null,
    })
  }

  return NextResponse.json({
    user_id: user.id,
    recurrings_count: recurrings?.length ?? 0,
    transactions_sample: txSample ?? [],
    transactions_fetch_error: txErr?.message ?? null,
    generation: generationResults,
    today: today.toISOString(),
  }, { status: 200 })
}
