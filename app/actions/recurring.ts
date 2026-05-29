'use server'

import { createClient } from '@/lib/supabase/server'
import { recurringSchema } from '@/lib/validations/recurring'
import { revalidatePath } from 'next/cache'

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

export async function createRecurring(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = recurringSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('recurring_transactions').insert({
    user_id: user.id,
    name: parsed.data.name,
    amount: parsed.data.amount,
    type: parsed.data.type,
    category_id: parsed.data.category_id ?? null,
    frequency: parsed.data.frequency,
    start_date: parsed.data.start_date,
  })
  if (error) return { error: error.message }
  revalidatePath('/recurring')
  return { success: true }
}

export async function updateRecurring(id: string, input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = recurringSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('recurring_transactions').update({
    name: parsed.data.name,
    amount: parsed.data.amount,
    type: parsed.data.type,
    category_id: parsed.data.category_id ?? null,
    frequency: parsed.data.frequency,
    start_date: parsed.data.start_date,
  }).eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/recurring')
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
  const { error } = await supabase.from('recurring_transactions').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/recurring')
  return { success: true }
}
