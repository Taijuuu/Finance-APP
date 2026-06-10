'use server'

import { createClient } from '@/lib/supabase/server'
import { recurringSchema } from '@/lib/validations/recurring'
import { revalidatePath } from 'next/cache'
import { computeMissingOccurrences } from '@/lib/recurring-engine'

export async function getRecurring() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('recurring_transactions')
    .select('*, categories(id, name, icon_name, color)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  return data ?? []
}

async function generateOccurrences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  recurringId: string,
  params: { frequency: 'weekly' | 'monthly' | 'yearly'; start_date: string },
  amount: number,
  type: 'expense' | 'income',
  categoryId: string | null,
  name: string
) {
  const all = computeMissingOccurrences({ ...params, last_generated: null }, new Date())
  if (all.length === 0) return
  const { data: existing } = await supabase
    .from('transactions').select('date')
    .eq('recurring_id', recurringId).eq('user_id', userId).in('date', all)
  const existingSet = new Set((existing ?? []).map(t => t.date))
  const missing = all.filter(d => !existingSet.has(d))
  if (missing.length === 0) return
  await supabase.from('transactions').insert(
    missing.map(date => ({
      user_id: userId, amount: Number(amount), type,
      category_id: categoryId, description: name,
      date, is_recurring_instance: true, recurring_id: recurringId,
    }))
  )
}

export async function createRecurring(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = recurringSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { data: inserted, error } = await supabase.from('recurring_transactions').insert({
    user_id: user.id,
    name: parsed.data.name,
    amount: parsed.data.amount,
    type: parsed.data.type,
    category_id: parsed.data.category_id ?? null,
    frequency: parsed.data.frequency,
    start_date: parsed.data.start_date,
  }).select('id').single()
  if (error || !inserted) return { error: error?.message ?? 'Erreur création' }
  await generateOccurrences(supabase, user.id, inserted.id, {
    frequency: parsed.data.frequency,
    start_date: parsed.data.start_date,
  }, parsed.data.amount, parsed.data.type, parsed.data.category_id ?? null, parsed.data.name)
  revalidatePath('/recurring')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateRecurring(id: string, input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = recurringSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('transactions')
    .delete()
    .eq('recurring_id', id)
    .eq('user_id', user.id)
    .gt('date', today)
  const { error } = await supabase.from('recurring_transactions').update({
    name: parsed.data.name,
    amount: parsed.data.amount,
    type: parsed.data.type,
    category_id: parsed.data.category_id ?? null,
    frequency: parsed.data.frequency,
    start_date: parsed.data.start_date,
    last_generated: null,
  }).eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  await generateOccurrences(supabase, user.id, id, {
    frequency: parsed.data.frequency,
    start_date: parsed.data.start_date,
  }, parsed.data.amount, parsed.data.type, parsed.data.category_id ?? null, parsed.data.name)
  revalidatePath('/recurring')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function toggleRecurring(id: string, is_active: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('recurring_transactions').update({ is_active }).eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/recurring')
  return { success: true }
}

export async function deleteRecurring(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const today = new Date().toISOString().split('T')[0]
  // Remove future pre-generated instances before deleting the recurring
  await supabase.from('transactions')
    .delete()
    .eq('recurring_id', id)
    .eq('user_id', user.id)
    .gt('date', today)
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/recurring')
  revalidatePath('/dashboard')
  return { success: true }
}
