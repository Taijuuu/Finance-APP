import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeMissingOccurrences } from '@/lib/recurring-engine'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: recurrings } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (!recurrings?.length) return NextResponse.json({ generated: 0 })

  // A recurring expense must not appear before its actual debit day, so it's
  // capped at today. A recurring income counts from the 1st of its month, so
  // it's capped at the end of the current month instead. Never generate past
  // the current month either way.
  const today = new Date()
  // Built in UTC (not local midnight) so its ISO date string doesn't shift back
  // a day for timezones ahead of UTC.
  const currentMonthEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0))
  let totalGenerated = 0

  for (const r of recurrings) {
    const cap = r.type === 'income' ? currentMonthEnd : today
    const dates = computeMissingOccurrences(
      { frequency: r.frequency, start_date: r.start_date, last_generated: r.last_generated },
      cap
    )
    if (dates.length === 0) continue

    const toInsert = dates.map(date => ({
      user_id: user.id,
      amount: r.amount,
      type: r.type,
      category_id: r.category_id,
      description: r.name,
      date,
      is_recurring_instance: true,
      recurring_id: r.id,
    }))

    const { error } = await supabase.from('transactions').insert(toInsert)
    if (!error) {
      await supabase
        .from('recurring_transactions')
        .update({ last_generated: dates[dates.length - 1] })
        .eq('id', r.id)
      totalGenerated += dates.length
    }
  }

  return NextResponse.json({ generated: totalGenerated })
}
