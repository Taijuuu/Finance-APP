'use server'

import { createClient } from '@/lib/supabase/server'
import { budgetSchema } from '@/lib/validations/budget'
import { revalidatePath } from 'next/cache'

export async function getBudgets(month: number, year: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('budgets')
    .select('*, categories(id, name, icon_name, color)')
    .eq('user_id', user.id)
    .eq('month', month)
    .eq('year', year)
  return data ?? []
}

export async function upsertBudget(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = budgetSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase
    .from('budgets')
    .upsert(
      { category_id: parsed.data.category_id, amount: parsed.data.amount, month: parsed.data.month, year: parsed.data.year, user_id: user.id },
      { onConflict: 'user_id,category_id,month,year' }
    )
  if (error) return { error: error.message }
  revalidatePath('/budgets')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteBudget(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('budgets').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/budgets')
  return { success: true }
}
