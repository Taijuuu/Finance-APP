'use server'

import { createClient } from '@/lib/supabase/server'
import { categorySchema } from '@/lib/validations/category'
import { revalidatePath } from 'next/cache'

export async function getCategories() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('name')
  return data ?? []
}

export async function createCategory(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('categories').insert({
    user_id: user.id,
    name: parsed.data.name,
    icon_name: parsed.data.icon_name,
    color: parsed.data.color,
    type: parsed.data.type,
  })
  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function updateCategory(id: string, input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('categories').update({
    name: parsed.data.name,
    icon_name: parsed.data.icon_name,
    color: parsed.data.color,
    type: parsed.data.type,
  }).eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id).eq('is_default', false)
  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { success: true }
}
