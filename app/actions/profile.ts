'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const profileSchema = z.object({
  full_name: z.string().min(1).max(100),
  currency: z.string().length(3),
  reconcile_expenses: z.boolean().optional().default(false),
  monthly_savings_goal: z.coerce.number().min(0).max(1_000_000_000).optional().default(0),
})

export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data
}

export async function updateProfile(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('profiles').update({ full_name: parsed.data.full_name, currency: parsed.data.currency, reconcile_expenses: parsed.data.reconcile_expenses, monthly_savings_goal: parsed.data.monthly_savings_goal }).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/profile')
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}
