'use server'

import { createClient } from '@/lib/supabase/server'
import { transactionSchema } from '@/lib/validations/transaction'
import { revalidatePath } from 'next/cache'

export async function getTransactions(params: {
  month?: string
  type?: 'expense' | 'income'
  category_id?: string
  q?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], count: 0 }

  const { month, type, category_id, q, sort = 'date', order = 'desc', page = 1 } = params
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('transactions')
    .select('*, categories(id, name, icon_name, color)', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('is_recurring_instance', false)

  if (month) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1).toISOString().split('T')[0]
    const end = new Date(year, m, 0).toISOString().split('T')[0]
    query = query.gte('date', start).lte('date', end)
  }
  if (type) query = query.eq('type', type)
  if (category_id) query = query.eq('category_id', category_id)
  if (q) query = query.ilike('description', `%${q}%`)

  const { data, count } = await query.order(sort, { ascending: order === 'asc' }).range(from, to)
  return { data: data ?? [], count: count ?? 0 }
}

export async function getTransactionsSummary(params: {
  month?: string
  type?: 'expense' | 'income'
  category_id?: string
  q?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { income: 0, expenses: 0, count: 0 }

  const { month, type, category_id, q } = params

  let query = supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', user.id)
    .eq('is_recurring_instance', false)

  if (month) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1).toISOString().split('T')[0]
    const end = new Date(year, m, 0).toISOString().split('T')[0]
    query = query.gte('date', start).lte('date', end)
  }
  if (type) query = query.eq('type', type)
  if (category_id) query = query.eq('category_id', category_id)
  if (q) query = query.ilike('description', `%${q}%`)

  const { data } = await query
  const rows = data ?? []
  const income = rows.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = rows.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  return { income, expenses, count: rows.length }
}

export async function createTransaction(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    amount: parsed.data.amount,
    type: parsed.data.type,
    category_id: parsed.data.category_id ?? null,
    description: parsed.data.description ?? null,
    date: parsed.data.date,
  })
  if (error) return { error: error.message }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateTransaction(id: string, input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const parsed = transactionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { error } = await supabase.from('transactions').update({
    amount: parsed.data.amount,
    type: parsed.data.type,
    category_id: parsed.data.category_id ?? null,
    description: parsed.data.description ?? null,
    date: parsed.data.date,
  }).eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteAllTransactions() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { error } = await supabase.from('transactions').delete().eq('user_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/transactions')
  revalidatePath('/dashboard')
  revalidatePath('/recap')
  return { success: true }
}

export async function getMonthlyTotals(year: number, month: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { income: 0, expenses: 0 }

  const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const end = new Date(year, month, 0).toISOString().split('T')[0]

  const { data } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', user.id)
    .gte('date', start)
    .lte('date', end)

  const income = (data ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = (data ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  return { income, expenses }
}
