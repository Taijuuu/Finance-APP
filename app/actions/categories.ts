'use server'

import type { Database } from '@/types/database'

type Category = Database['public']['Tables']['categories']['Row']

export async function getCategories(): Promise<Category[]> {
  return []
}

export async function createCategory(_input: unknown): Promise<{ success?: boolean; error?: string }> {
  return { error: 'Non implémenté' }
}

export async function updateCategory(_id: string, _input: unknown): Promise<{ success?: boolean; error?: string }> {
  return { error: 'Non implémenté' }
}

export async function deleteCategory(_id: string): Promise<{ success?: boolean; error?: string }> {
  return { error: 'Non implémenté' }
}
